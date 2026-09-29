// RAVIQEN Intelligent Ingestion & Risk Screening Engine
// Processes structured (CSV/Excel) and unstructured (PDF/Word/OCR Image) data,
// extracts metadata, runs automated background verification, and outputs a
// standardized risk-scored payload per record.

import { base44 } from "@/api/base44Client";
import { withoutReplayedTransaction } from "@/lib/scanConsistency";
import { stampTenant } from "@/lib/tenantScope";
import { applyContextualLogic } from "@/lib/contextualRiskEngine";
import { detectAdvancedThreats } from "@/lib/threatDetection";
import { buildLedgerPayload } from "@/lib/ledgerPayload";
import { analyzeProcurementVariance, topProcurementRule } from "@/lib/procurementVariance";
import { applyB2BValidationMandate } from "@/lib/b2bValidationEngine";
import { riskLevelFromScore } from "@/lib/riskSeverity";
import { readXlsxRows } from "@/lib/xlsxRows";

export { riskLevelFromScore };

// ─── Field mapping for tabular normalization ───────────────────────────────
const FIELD_ALIASES = {
  transaction_id: ["transaction_id", "txn_id", "txn id", "id", "reference", "ref", "invoice_number", "invoice_id", "invoice_ref", "receipt_no", "doc_number", "document_id", "doc_id", "document_number", "document_no"],
  vendor: ["vendor", "supplier", "payee", "merchant", "vendor_name", "supplier_name", "seller", "from"],
  counterparty: ["counterparty", "buyer", "customer", "recipient", "billed_to", "client", "to", "bill_to", "customer_name", "client_or_vendor", "vendor_client"],
  amount: ["amount", "total", "total (ngn)", "value", "sum", "amount_paid", "total_amount", "grand_total", "balance_due", "net_amount"],
  currency: ["currency", "curr", "ccy", "currency_code"],
  transaction_date: ["transaction_date", "date", "txn_date", "billing_date", "invoice_date", "payment_date", "issue_date", "document_date"],
  category: ["category", "type", "classification", "expense_type", "expense_category", "gl_account"],
  location: ["location", "city", "country", "region", "address", "jurisdiction"],
  sector: ["sector", "industry_sector", "business_sector"],
  payment_method: ["payment_method", "method", "payment_type", "payment_mode"],
  bank_account: ["bank_account", "account_number", "acct_no", "bank_acct", "iban"],
  tax_id: ["tax_id", "tin", "vat", "vat_number", "tax_number", "registration_number", "rc_number"],
  payment_terms: ["payment_terms", "terms", "due_terms", "net_terms"],
  // ── Document-oriented standard schema (Invoices, Receipts, Ledgers) ──
  document_type: ["document_type", "doc_type", "document_category", "record_type", "invoice_type", "document_kind"],
  due_date: ["due_date", "payment_due_date", "due", "maturity_date", "expected_payment_date"],
  organization: ["organization", "org", "company", "issuer", "our_company", "our_org", "entity_name", "our_organization"],
  item_description: ["item_description", "item", "items", "particulars", "narration", "memo", "line_item", "description_of_goods", "particulars_description", "description", "narrative"],
  bank_name: ["bank_name", "bank", "financial_institution", "bank_branch", "bankers"],
  account_name: ["account_name", "acct_name", "account_holder", "beneficiary_name", "payee_name", "account_holders_name"],
  account_number: ["account_number", "acct_no", "account_no", "bank_acct", "iban", "account_n"],
  balance_due: ["balance_due", "balance", "outstanding", "amount_due", "remaining_balance", "outstanding_balance"],
  status: ["status", "doc_status", "payment_status", "invoice_status", "payment_state"],
  quantity: ["quantity", "qty", "units"],
  unit_price: ["unit_price", "unit price (ngn)", "unit_cost", "rate", "price_per_unit"],
  line_total: ["line_total", "total (ngn)", "extended_price", "item_total"],
  invoice_no: ["invoice_no", "invoice no", "invoice_number"],
  po_no: ["po_no", "po no", "purchase_order_number"],
  requested_by: ["requested_by", "requested by"],
  approved_by: ["approved_by", "approved by"],
  unit: ["unit", "unit_of_measure", "uom"],
  // ── Contextual false-positive prevention fields ──
  vendor_status: ["vendor_status", "vendor_state", "onboarding_status", "vendor_onboarding"],
  account_type: ["account_type", "acct_type", "bank_account_type", "account_kind"],
  vendor_registered_name: ["vendor_registered_name", "registered_name", "vendor_legal_name", "legal_name", "registered_business_name"],
  vendor_category: ["vendor_category", "vendor_industry", "industry", "sector", "vendor_type"],
  vendor_id: ["vendor_id", "vendor_code", "supplier_id", "vendor_number", "supplier_code"],
  trusted_whitelist: ["trusted_whitelist", "whitelist", "trusted_enterprise", "is_trusted"],
  vendor_whitelist: ["vendor_whitelist", "whitelist_status"],
};

const REQUIRED_FIELDS = ["transaction_id", "vendor", "amount"];

// ─── Normalization ──────────────────────────────────────────────────────────

function pickField(raw, canonical) {
  const aliases = FIELD_ALIASES[canonical] || [canonical];
  const keys = Object.keys(raw);
  for (const alias of aliases) {
    const match = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, "") === alias.toLowerCase().replace(/[\s_-]/g, ""));
    if (match && raw[match] != null && raw[match] !== "") return raw[match];
  }
  return null;
}

export function normalizeTabularRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const normalized = {};
  for (const field of Object.keys(FIELD_ALIASES)) {
    const val = pickField(raw, field);
    if (val != null) normalized[field] = val;
  }
  // Preserve individual document lines; each must be compared independently.
  if (Array.isArray(raw.line_items)) normalized.line_items = raw.line_items;
  // A currency-labelled column is direct source evidence, not a guessed default.
  const columns = Object.keys(raw).map((key) => key.toLowerCase());
  if (!normalized.currency && columns.some((key) => /\(ngn\)/.test(key))) normalized.currency = "NGN";
  if (normalized.transaction_date && /^\d{4,5}(?:\.\d+)?$/.test(String(normalized.transaction_date))) {
    const serial = Number(normalized.transaction_date);
    normalized.transaction_date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  // Preserve each source row's quoted quantity, price, and total for arithmetic review.
  if (!normalized.line_items?.length && normalized.item_description && normalized.quantity && normalized.unit_price) {
    normalized.line_items = [{ description: normalized.item_description, quantity: Number(normalized.quantity), unit_price: Number(normalized.unit_price), line_total: normalized.line_total === undefined ? null : Number(normalized.line_total), unit: normalized.unit }];
  }
  // Type coercion
  if (normalized.amount != null) {
    const parsed = typeof normalized.amount === "number" ? normalized.amount : parseFloat(String(normalized.amount).replace(/[^0-9.\-]/g, ""));
    normalized.amount = isNaN(parsed) ? null : parsed;
  }
  if (!normalized.currency) normalized.currency = "";
  // Validate required fields
  const missing = REQUIRED_FIELDS.filter((f) => normalized[f] == null || normalized[f] === "" || (f === "amount" && !Number.isFinite(normalized.amount)));
  return { record: normalized, missing };
}

// ─── Document Extraction (unstructured: PDF, Word, Images via OCR/NER) ──────

const DOCUMENT_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          transaction_id: { type: "string", description: "Invoice/reference number or transaction ID" },
          vendor: { type: "string", description: "Vendor / supplier / payee name" },
          counterparty: { type: "string", description: "Buyer / customer / recipient name" },
          amount: { type: "number", description: "Total invoice/transaction amount" },
          currency: { type: "string", description: "Currency code (e.g. NGN, USD, EUR)" },
          transaction_date: { type: "string", description: "Billing/invoice/transaction date" },
          category: { type: "string", description: "Transaction category or type" },
          sector: { type: "string", description: "Sector if stated in the source; do not infer" },
          location: { type: "string", description: "Location, city, or country" },
          payment_method: { type: "string" },
          bank_account: { type: "string", description: "Bank account number or IBAN if visible" },
          tax_id: { type: "string", description: "TIN, VAT, or registration number if visible" },
          payment_terms: { type: "string", description: "Payment terms (e.g. Net 30)" },
          line_items: {
            type: "array",
            description: "Itemized line items from the invoice. Each item should include description, unit price/rate, quantity, and line total if visible.",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Item description or particulars" },
                rate: { type: "number", description: "Unit price / rate per unit" },
                quantity: { type: "number", description: "Quantity / number of units" },
                line_total: { type: "number", description: "Total for this line (rate × quantity)" },
              },
            },
          },
        },
      },
    },
  },
};

// ─── Format detection & client-side parsers ────────────────────────────────
// The backend ExtractDataFromUploadedFile integration handles CSV, XLSX, JSON,
// HTML, PDF, and images. These additional formats are parsed directly in the
// browser so we can accept a wider range of data sources without a round-trip.

function getFileExt(name) {
  return (name || "").toLowerCase().split(".").pop() || "";
}

// Split a delimited line, honouring double-quoted fields.
function splitDelimitedLine(line, delimiter) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDelimited(text, delimiter) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = splitDelimitedLine(lines[0], delimiter);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitDelimitedLine(lines[i], delimiter);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] != null ? vals[idx] : ""; });
    rows.push(obj);
  }
  return rows;
}

// Parse XML into record objects by locating the first repeating element that
// has child elements (treated as rows) and mapping children/attributes to fields.
function parseXML(text) {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) return [];
    const counts = {};
    doc.querySelectorAll("*").forEach((el) => {
      const tag = el.tagName.toLowerCase();
      counts[tag] = (counts[tag] || 0) + 1;
    });
    let bestTag = null, bestCount = 0;
    for (const [tag, n] of Object.entries(counts)) {
      if (n <= bestCount) continue;
      const sample = doc.querySelector(tag);
      if (sample && sample.children.length > 0) { bestTag = tag; bestCount = n; }
    }
    if (!bestTag) return [];
    const rows = [];
    doc.querySelectorAll(bestTag).forEach((el) => {
      const obj = {};
      Array.from(el.children).forEach((c) => { obj[c.tagName] = c.textContent; });
      Array.from(el.attributes || []).forEach((a) => { obj[a.name] = a.value; });
      rows.push(obj);
    });
    return rows;
  } catch (e) {
    return [];
  }
}

// Parse plain-text logs: detect a delimiter on the first line (tab, pipe,
// semicolon, comma). If the result maps to recognised fields, use it; otherwise
// fall back to LLM extraction over the text content.
// LLM extraction over arbitrary text content (used for unstructured logs and
// document text extracted from .docx files).
async function llmExtractRecords(text) {
  const truncated = text.slice(0, 12000);
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Extract every transaction record from the following text data. Return a JSON object with a "records" array. Each record should include transaction_id, vendor, and amount where available, plus any other fields present (currency, date, category, etc.).\n\nTEXT:\n${truncated}`,
    response_json_schema: DOCUMENT_EXTRACTION_SCHEMA,
  });
  return result?.records || (Array.isArray(result) ? result : []);
}

// Extract plain text from a .docx (Office Open XML) file by reading the ZIP
// archive and stripping tags from word/document.xml. Uses only browser APIs.
async function extractDocxText(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // Locate the End-of-Central-Directory record.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65557; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("Invalid DOCX archive");
  const cdCount = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  let cursor = cdOffset;
  let docOffset = -1, docCompSize = 0, docMethod = 0;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compSize = view.getUint32(cursor + 20, true);
    const fnameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const fname = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + fnameLen));
    if (fname === "word/document.xml") {
      docOffset = localOffset; docCompSize = compSize; docMethod = method;
    }
    cursor += 46 + fnameLen + extraLen + commentLen;
  }
  if (docOffset === -1) throw new Error("DOCX has no document.xml");
  const localFnameLen = view.getUint16(docOffset + 26, true);
  const localExtraLen = view.getUint16(docOffset + 28, true);
  const dataStart = docOffset + 30 + localFnameLen + localExtraLen;
  let xmlText;
  if (docMethod === 0) {
    xmlText = new TextDecoder().decode(bytes.subarray(dataStart, dataStart + docCompSize));
  } else {
    const compressed = bytes.subarray(dataStart, dataStart + docCompSize);
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(compressed); writer.close();
    const reader = ds.readable.getReader();
    const chunks = []; let done = false;
    while (!done) { const { value, done: d } = await reader.read(); done = d; if (value) chunks.push(value); }
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    xmlText = new TextDecoder().decode(out);
  }
  return xmlText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function parseDocx(file) {
  const text = await extractDocxText(file);
  if (!text) return [];
  return await llmExtractRecords(text);
}

async function parseTXT(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
  let delim = null;
  if (firstLine.includes("\t")) delim = "\t";
  else if (firstLine.includes("|")) delim = "|";
  else if (firstLine.includes(";")) delim = ";";
  else if (firstLine.includes(",")) delim = ",";
  if (delim) {
    const rows = parseDelimited(text, delim);
    const anyRecognised = rows.some((r) => {
      const n = normalizeTabularRecord(r);
      return n && (n.record?.transaction_id || n.record?.vendor || n.record?.amount != null);
    });
    if (anyRecognised && rows.length > 0) return rows;
  }
  // Unstructured log — ask the LLM to extract transaction records.
  return await llmExtractRecords(text);
}

// Parse Apache Parquet via the pure-JS hyparquet library (browser, no wasm).
async function parseParquet(file) {
  const { parquetReadObjects } = await import("hyparquet");
  const buffer = await file.arrayBuffer();
  const rows = await parquetReadObjects({ file: buffer });
  return rows || [];
}

const CLIENT_PARSED_EXTS = new Set(["tsv", "xml", "txt", "parquet", "docx"]);

export async function extractRecordsFromFile(fileUrl, file = null) {
  const ext = getFileExt(file?.name || fileUrl || "");
  // Client-side parseable formats
  if (ext === "xlsx" && (file || fileUrl)) {
    const bytes = file ? await file.arrayBuffer() : await (await fetch(fileUrl)).arrayBuffer();
    return (await readXlsxRows(bytes)).map(normalizeTabularRecord).filter(Boolean);
  }
  if (file && CLIENT_PARSED_EXTS.has(ext)) {
    let rawRows = [];
    if (ext === "parquet") rawRows = await parseParquet(file);
    else if (ext === "xml") rawRows = parseXML(await file.text());
    else if (ext === "tsv") rawRows = parseDelimited(await file.text(), "\t");
    else if (ext === "txt") rawRows = await parseTXT(await file.text());
    else if (ext === "docx") rawRows = await parseDocx(file);
    return rawRows.map((r) => normalizeTabularRecord(r)).filter(Boolean);
  }
  // Backend extraction for CSV, XLSX, XLS, JSON, PDF, HTML, images
  const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: DOCUMENT_EXTRACTION_SCHEMA,
  });
  if (result?.status === "error") throw new Error(result.details || "Extraction failed");
  const output = result?.output;
  let records = [];
  if (Array.isArray(output)) records = output;
  else if (output?.records) records = output.records;
  else if (output?.rows) records = output.rows;
  return records.map((r) => normalizeTabularRecord(r)).filter(Boolean);
}

// ─── Automated Background & Risk Verification ───────────────────────────────
// Single LLM call with web context to perform: vendor/entity verification,
// watchlist & sanctions screening, PEP check, and OSINT adverse media scan.

const VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    vendor_verification: { type: "object", properties: {
      legal_exists: { type: "boolean" },
      registry: { type: "string", description: "Corporate registry source (e.g. CAC, BVN, NIBSS, Companies House)" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      notes: { type: "string" },
    } },
    counterparty_verification: { type: "object", properties: {
      legal_exists: { type: "boolean" }, registry: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] }, notes: { type: "string" },
    } },
    sanctions_check: { type: "object", properties: {
      vendor_status: { type: "string", enum: ["clear", "match", "partial_match"] },
      counterparty_status: { type: "string", enum: ["clear", "match", "partial_match"] },
      executive_status: { type: "string", enum: ["clear", "match", "partial_match"] },
      matched_lists: { type: "array", items: { type: "string" } }, details: { type: "string" },
    } },
    pep_check: { type: "object", properties: {
      vendor_pep: { type: "string", enum: ["clear", "match"] },
      counterparty_pep: { type: "string", enum: ["clear", "match"] },
      executive_pep: { type: "string", enum: ["clear", "match"] }, details: { type: "string" },
    } },
    adverse_media: { type: "object", properties: {
      vendor_findings: { type: "array", items: { type: "string" } },
      counterparty_findings: { type: "array", items: { type: "string" } },
      vendor_risk: { type: "string", enum: ["clear", "low", "medium", "high", "critical"] },
      counterparty_risk: { type: "string", enum: ["clear", "low", "medium", "high", "critical"] },
      categories: { type: "array", items: { type: "string" }, description: "e.g. fraud, insolvency, corruption, litigation" },
      summary: { type: "string" },
    } },
    overall_assessment: { type: "string" },
  },
};

export async function runBackgroundVerification(record) {
  const vendor = record.vendor || "Unknown";
  const counterparty = record.counterparty || "Unknown";
  const amount = record.amount ?? 0;
  const currency = record.currency || "USD";

  const prompt = `You are an automated risk and compliance verification engine. Perform a comprehensive background check on the following transaction parties.

VENDOR / SUPPLIER: ${vendor}
COUNTERPARTY / BUYER: ${counterparty}
AMOUNT: ${currency} ${amount}
LOCATION: ${record.location || "Not specified"}
TAX ID / REGISTRATION: ${record.tax_id || "Not provided"}
BANK ACCOUNT: ${record.bank_account || "Not provided"}

Execute the following checks using publicly available information:
1. VENDOR & ENTITY VERIFICATION: Cross-reference the vendor name against corporate registries (CAC Nigeria, BVN, NIBSS, Companies House, OpenCorporates, etc.) to verify legal existence. Note the registry source.
2. COUNTERPARTY VERIFICATION: Same check for the counterparty/buyer entity.
3. WATCHLIST & SANCTIONS SCREENING: Screen both entities and associated executives against global watchlists (OFAC, UN, EU, UK HMT), PEP databases, and regional regulatory enforcement lists.
4. OSINT & ADVERSE MEDIA SCAN: Search public intelligence and news archives for legal disputes, insolvency filings, corruption flags, regulatory actions, or negative press linked to either entity.

Return a structured JSON assessment. If you cannot find information about an entity, set legal_exists to false and confidence to "low". Be conservative — only report "match" for sanctions/PEP when there is a credible match.`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: VERIFICATION_SCHEMA,
  });
  return result || {};
}

// ─── Transaction Anomaly Detection (local rules) ────────────────────────────

export function detectAnomalies(record, baseline = [], orgName = null) {
  const flags = [];
  const details = [];
  const evidence = [];

  // 1. First-time transaction between vendor and counterparty
  if (record.counterparty && record.vendor) {
    const priorMatch = baseline.some(
      (t) =>
        t.vendor &&
        t.vendor.toLowerCase() === record.vendor.toLowerCase() &&
        t.counterparty &&
        t.counterparty.toLowerCase() === record.counterparty.toLowerCase()
    );
    // Also check by vendor only if counterparty not stored historically
    const priorVendor = baseline.some(
      (t) => t.vendor && t.vendor.toLowerCase() === record.vendor.toLowerCase()
    );
    if (!priorMatch && priorVendor) {
      flags.push("First-time counterparty pairing");
      details.push(`${record.vendor} has transacted before, but never with ${record.counterparty}`);
      evidence.push({ flag: "First-time counterparty pairing", rule_id: "ANOMALY-01", evidence_field: "counterparty", evidence_value: record.counterparty, detail: `${record.vendor} has transacted before, but never with ${record.counterparty}` });
    } else if (!priorVendor) {
      flags.push("First-time vendor");
      details.push(`No prior transaction history found for ${record.vendor}`);
      evidence.push({ flag: "First-time vendor", rule_id: "ANOMALY-01", evidence_field: "vendor", evidence_value: record.vendor, detail: `No prior transaction history found for ${record.vendor}` });
    }
  }

  // 2. High-value absolute threshold (each case evaluated individually — no
  //    cross-record statistical baseline, so one record's score is never
  //    inflated by other records' amounts)
  if (record.currency === "USD" && record.amount > 50000) {
    flags.push("High-value threshold exceeded (>50,000)");
    details.push(`Transaction amount exceeds the $50,000 review threshold`);
    evidence.push({ flag: "High-value threshold exceeded (>50,000)", rule_id: "ANOMALY-02", evidence_field: "amount", evidence_value: `${record.currency || "USD"} ${record.amount.toLocaleString()}`, detail: "Transaction amount exceeds the $50,000 review threshold" });
  }

  // 3. Duplicate invoice / transaction identifiers
  if (record.transaction_id) {
    const duplicate = baseline.some(
      (t) => t.transaction_id && t.transaction_id.toLowerCase() === String(record.transaction_id).toLowerCase()
    );
    if (duplicate) {
      flags.push("Duplicate transaction identifier");
      details.push(`Transaction ID "${record.transaction_id}" already exists in the system`);
      evidence.push({ flag: "Duplicate transaction identifier", rule_id: "ANOMALY-03", evidence_field: "transaction_id", evidence_value: record.transaction_id, detail: `Transaction ID "${record.transaction_id}" already exists in the system` });
    }
  }

  // 4. Off-hours / weekend submission
  if (record.transaction_date) {
    const d = new Date(record.transaction_date);
    if (!isNaN(d.getTime())) {
      const hour = d.getUTCHours();
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
        flags.push("Weekend transaction");
        details.push(`Transaction dated on a weekend (${d.toISOString().slice(0, 10)})`);
        evidence.push({ flag: "Weekend transaction", rule_id: "ANOMALY-04", evidence_field: "transaction_date", evidence_value: record.transaction_date, detail: `Transaction dated on a weekend (${d.toISOString().slice(0, 10)})` });
      }
      if (/T\d{2}:\d{2}/.test(record.transaction_date) && (hour < 6 || hour >= 22)) {
        flags.push("Off-hours submission");
        details.push(`Transaction timestamped at ${hour}:00 UTC (outside UTC review window)`);
        evidence.push({ flag: "Off-hours submission", rule_id: "ANOMALY-04", evidence_field: "transaction_date", evidence_value: record.transaction_date, detail: `Transaction timestamped at ${hour}:00 UTC (outside UTC review window)` });
      }
    }
  }

  const ravigen = runRavigenRules(record, orgName);
  for (const r of ravigen) {
    flags.push(r.flag);
    details.push(`[${r.rule_id}] ${r.title}: ${r.detail}`);
    evidence.push({ flag: r.flag, rule_id: r.rule_id, evidence_field: r.evidence_field || "record", evidence_value: r.evidence_value || "", detail: r.detail });
  }

  return { flags, details, ravigen, evidence };
}

// ─── RAVIQEN Mandatory Risk Briefing Rules (v2.4) ───────────────────────────
// RULE-BE-01, RULE-HV-02, RULE-BS-03 — executed during ingestion screening.

const PERSONAL_WALLETS = ["opay", "moniepoint", "palmpay", "paga"];
const CORP_INDICATORS = ["ltd", "limited", "gmbh", "inc", "corp", "corporation", "llc", "llp", "plc", "company", "enterprises", "global", "group", "solutions", "services", "holdings", "ventures", "agency", "associates", "partners", "co.", "co,"];

function looksPersonalName(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  if (CORP_INDICATORS.some((c) => n.includes(c))) return false;
  const words = n.trim().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 4;
}

// Placeholder/absence-of-data values that must NEVER be treated as real
// extracted evidence (e.g. "Not Specified" is the extraction engine's way of
// saying a field was absent from the source document — it is not a personal
// name, account number, or any other real value, and must not trigger a flag).
const PLACEHOLDER_VALUES = new Set([
  "not specified", "n/a", "na", "none", "unknown", "unspecified",
  "not provided", "not available", "tbd", "pending", "-", "--", "n.a.",
]);
export function isPlaceholderValue(value) {
  if (value == null) return true;
  const v = String(value).trim().toLowerCase();
  return v === "" || PLACEHOLDER_VALUES.has(v);
}

export function runRavigenRules(record, orgName = null) {
  const out = [];
  const docType = String(record.document_type || record.category || "").toLowerCase();
  const bankName = String(record.bank_name || "").toLowerCase().trim();
  const acctNameRaw = String(record.account_name || record.bank_account || "").trim();
  // A placeholder value means the field was absent from the document.
  const acctName = isPlaceholderValue(acctNameRaw) ? "" : acctNameRaw;
  const org = String(record.organization || record.vendor || "").trim();
  const itemDesc = String(record.item_description || record.description || "").toLowerCase();
  const amount = Number(record.amount) || 0;
  const balanceDue = record.balance_due != null ? Number(record.balance_due) : null;
  const counterparty = String(record.counterparty || "").trim();

  // RULE-BE-01 — Personal Account on Corporate Invoice
  // Only fire when bank_name or account_name is present in the extracted record.
  const isInvoice = docType.includes("invoice");
  const personalWallet = bankName && PERSONAL_WALLETS.includes(bankName);
  const personalAccount = acctName && org && looksPersonalName(acctName) && !acctName.toLowerCase().includes(org.toLowerCase());
  if (isInvoice && (personalWallet || personalAccount)) {
    out.push({
      rule_id: "RULE-BE-01",
      flag: personalWallet ? "Personal wallet account on corporate invoice" : "Personal account name on corporate invoice",
      severity: "high",
      title: "Personal Account on Corporate Invoice (BEC Indicator)",
      detail: personalWallet
        ? `Invoice routed to a personal wallet (${record.bank_name}) instead of a corporate account — classic BEC, unverified vendor, or tax-avoidance indicator.`
        : `Invoice account name "${acctName}" differs from organization "${org}" and appears personal — possible BEC or unverified vendor onboarding.`,
      mitigation: "Hold disbursement; verify vendor bank details via a known out-of-band channel; perform enhanced due diligence on the vendor; confirm invoice authenticity with the requester.",
      evidence_field: personalWallet ? "bank_name" : "account_name",
      evidence_value: personalWallet ? record.bank_name : acctName,
    });
  }

  // RULE-HV-02 — High-Value Outlier / Non-Standard Terms
  const standbyKeywords = ["standby payment", "standby", "retainer", "advance payment", "mobilization", "mobilization fee", "slush", "facilitation"];
  const hasStandby = standbyKeywords.some((k) => itemDesc.includes(k));
  const nonAligned = /ngo|foundation|trust|charity|initiative|society|association/.test(itemDesc) || /ngo|foundation|trust|charity/.test(org.toLowerCase());
  if (amount > 10000000 && (hasStandby || nonAligned)) {
    out.push({
      rule_id: "RULE-HV-02",
      flag: "High-value outlier with non-standard terms",
      severity: "high",
      title: "High-Value Outlier / Non-Standard Terms",
      detail: `Amount ${record.currency || "USD"} ${amount.toLocaleString()} exceeds 10,000,000 with description "${record.item_description || ""}" — requires source-of-funds verification, AML screening, and contract milestone auditing.`,
      mitigation: "Request source-of-funds documentation; run AML/sanctions screening on all parties; audit contract milestones and delivery evidence; escalate to compliance for approval before disbursement.",
      evidence_field: "amount",
      evidence_value: `${record.currency || "USD"} ${amount.toLocaleString()}`,
    });
  }

  // RULE-BS-03 — Standard Baseline (settled receipt)
  const isReceipt = docType.includes("receipt");
  if (isReceipt && balanceDue === 0) {
    out.push({
      rule_id: "RULE-BS-03",
      flag: "Standard baseline — settled receipt",
      severity: "low",
      title: "Standard Baseline (Normal Receipt)",
      detail: "Receipt with balance due = 0 — normal, fully settled transaction.",
      mitigation: "No action required. Log for record-keeping and audit trail.",
      evidence_field: "balance_due",
      evidence_value: "0",
    });
  }

  // RULE-RM-04 — Invoice Recipient Mismatch
  // Checks whether the invoice's billed-to entity (counterparty) matches the
  // ingesting organization. If not, raises an explicit, named flag with both
  // the actual billed-to and the expected entity. This is a real, verifiable
  // fact from the document — not an inference.
  if (isInvoice && counterparty && orgName) {
    const normCp = normEntityName(counterparty);
    const normOrg = normEntityName(orgName);
    if (normCp && normOrg && normCp !== normOrg && !normCp.includes(normOrg) && !normOrg.includes(normCp)) {
      out.push({
        rule_id: "RULE-RM-04",
        flag: `Invoice recipient mismatch: billed to ${counterparty}, expected ${orgName}`,
        severity: "high",
        title: "Invoice Recipient Mismatch",
        detail: `Invoice billed-to "${counterparty}" does not match the ingesting organization "${orgName}". This invoice may belong to a different entity or may have been ingested against the wrong record.`,
        mitigation: "Verify the invoice is intended for this organization. If it belongs to a different entity, remove it from this record and ingest against the correct transaction. If the counterparty is a legitimate sub-contractor or project partner, add them as a known counterparty.",
        evidence_field: "counterparty",
        evidence_value: counterparty,
      });
    }
  }

  return out;
}

// Normalize an entity name for fuzzy comparison: lowercase, strip legal
// suffixes and punctuation, collapse whitespace.
function normEntityName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b(ltd|limited|llc|inc|corp|corporation|plc|gmbh|co|company|enterprises|global|group|solutions|services|holdings|ventures|the|national|coordinator)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ─── Composite Risk Score Computation (0–100) ──────────────────────────────

const RISK_WEIGHTS = {
  counterparty: 30,
  sanctions: 30,
  adverse_media: 20,
  anomaly: 20,
};

function scoreVerification(verification) {
  let score = 0;
  const v = verification?.vendor_verification;
  const c = verification?.counterparty_verification;
  // Lack of a search result is not evidence that an entity does not exist.
  if (v?.legal_exists === false && v?.verified_absent === true) score += 12;
  if (c?.legal_exists === false && c?.verified_absent === true) score += 12;
  if (v?.confidence === "low") score += 6;
  if (c?.confidence === "low") score += 6;
  return Math.min(score, RISK_WEIGHTS.counterparty);
}

function scoreSanctions(verification) {
  let score = 0;
  const s = verification?.sanctions_check;
  if (!s) return 0;
  const matchValue = (status) => {
    if (status === "match") return 20;
    if (status === "partial_match") return 10;
    return 0;
  };
  score += matchValue(s.vendor_status);
  score += matchValue(s.counterparty_status);
  score += matchValue(s.executive_status);
  return Math.min(score, RISK_WEIGHTS.sanctions);
}

function scoreAdverseMedia(verification) {
  const am = verification?.adverse_media;
  if (!am) return 0;
  const riskValue = { clear: 0, low: 4, medium: 8, high: 14, critical: 20 };
  const vendorRisk = riskValue[am.vendor_risk] || 0;
  const counterpartyRisk = riskValue[am.counterparty_risk] || 0;
  const findingCount = (am.vendor_findings?.length || 0) + (am.counterparty_findings?.length || 0);
  return Math.min(vendorRisk + counterpartyRisk + Math.min(findingCount * 2, 6), RISK_WEIGHTS.adverse_media);
}

function scoreAnomalies(anomalyFlags) {
  const perFlag = RISK_WEIGHTS.anomaly / 4;
  return Math.min(anomalyFlags.length * perFlag, RISK_WEIGHTS.anomaly);
}

export function computeCompositeRiskScore(verification, anomalyFlags) {
  const counterparty = scoreVerification(verification);
  const sanctions = scoreSanctions(verification);
  const adverse_media = scoreAdverseMedia(verification);
  const anomaly = scoreAnomalies(anomalyFlags);
  const total = Math.round(counterparty + sanctions + adverse_media + anomaly);
  return {
    total: Math.min(total, 100),
    breakdown: { counterparty: Math.round(counterparty), sanctions: Math.round(sanctions), adverse_media: Math.round(adverse_media), anomaly: Math.round(anomaly) },
  };
}

// ─── Actionable Next Steps ──────────────────────────────────────────────────

export function determineNextSteps(score, verification, anomalyFlags) {
  const steps = [];
  const level = riskLevelFromScore(score);

  if (level === "critical") {
    steps.push("Quarantine transaction immediately");
    steps.push("Trigger Enhanced Due Diligence (EDD) on vendor and counterparty");
    steps.push("Escalate to Case Management for formal investigation");
    steps.push("Hold disbursement pending compliance approval");
  } else if (level === "high") {
    steps.push("Pass to Case Management for investigation");
    steps.push("Hold disbursement pending manual review");
    steps.push("Request supporting documentation from vendor");
  } else if (level === "medium") {
    steps.push("Flag for manual review by compliance analyst");
    steps.push("Request compliance approval after manual review");
    steps.push("Log for periodic audit review");
  } else {
    steps.push("Review source evidence before any clearance or payment decision");
    steps.push("Log for record-keeping and audit trail");
  }

  // Sanctions-specific escalation
  const sanctions = verification?.sanctions_check;
  if (sanctions && (sanctions.vendor_status === "match" || sanctions.counterparty_status === "match" || sanctions.executive_status === "match")) {
    steps.unshift("BLOCK: Sanctions match detected — mandatory reporting required");
  }
  // PEP-specific
  const pep = verification?.pep_check;
  if (pep && (pep.vendor_pep === "match" || pep.counterparty_pep === "match" || pep.executive_pep === "match")) {
    steps.unshift("Trigger enhanced PEP due diligence and senior management approval");
  }
  // Adverse media escalation
  const am = verification?.adverse_media;
  if (am && (am.vendor_risk === "critical" || am.counterparty_risk === "critical")) {
    steps.unshift("Escalate adverse media findings to compliance officer");
  }

  return steps;
}

// ─── Verification Status Determination ──────────────────────────────────────

export function determineVerificationStatus(score, verification, missing) {
  if (missing && missing.length > 0) return "quarantined";
  if (score >= 75) return "quarantined";
  if (score >= 55) return "flagged";
  const sanctions = verification?.sanctions_check;
  if (sanctions && (sanctions.vendor_status === "match" || sanctions.counterparty_status === "match")) return "flagged";
  return "valid";
}

// ─── Full Pipeline: Process a Single Record ─────────────────────────────────

export async function processRecord(normalized, baseline = [], options = {}) {
  const { record, missing } = normalized;
  const orgName = options.orgName || null;

  // If required fields are missing, quarantine immediately
  if (missing.length > 0) {
    return {
      normalized: record,
      missing,
      verification: null,
      anomaly: { flags: ["Missing required fields"], details: [`${missing.join(", ")} not provided`] },
      flag_evidence: [{ flag: "Missing required fields", rule_id: "VALIDATION", evidence_field: "required_fields", evidence_value: missing.join(", "), detail: `${missing.join(", ")} not provided` }],
      risk_score: null,
      risk_level: "not_scored",
      verification_status: "quarantined",
      next_steps: ["Quarantine record — missing required fields", "Request complete documentation from submitter"],
    };
  }

  // Run background verification (LLM with web context)
  const verification = await runBackgroundVerification(record);

  // Run anomaly detection (local rules) — pass orgName for recipient mismatch
  const scanBaseline = withoutReplayedTransaction({ ...record, source_filename: options.filename }, baseline);
  const rawAnomaly = detectAnomalies(record, scanBaseline, orgName);

  // Apply contextual false-positive prevention (Rules 1–4) before scoring
  const ctx = applyContextualLogic(record, rawAnomaly, scanBaseline);
  let anomaly = { flags: ctx.flags, details: ctx.details, ravigen: ctx.ravigen };

  // Build flag_evidence trail: collect evidence for every surviving flag.
  // HARD RULE: every flag must have a corresponding evidence entry showing
  // the exact source field/value that triggered it.
  let flag_evidence = [...(rawAnomaly.evidence || [])];
  // Filter evidence to only include flags that survived contextual suppression
  flag_evidence = flag_evidence.filter((e) => anomaly.flags.includes(e.flag));

  // Phase 3: only source-backed advanced threats may enter a risk verdict.
  const advanced = detectAdvancedThreats(record, scanBaseline);
  flag_evidence.push(...advanced.evidence);
  flag_evidence = flag_evidence.filter((e) => e.evidence_field && !isPlaceholderValue(e.evidence_value));
  anomaly.flags = [...anomaly.flags, ...advanced.flags].filter((flag) => flag_evidence.some((e) => e.flag === flag));
  anomaly.details = [...anomaly.details, ...advanced.details];
  anomaly.ravigen = (anomaly.ravigen || []).filter((r) => flag_evidence.some((e) => e.flag === r.flag));

  // Compute composite (contextual) risk score from the adjusted flag set
  // Web/AI assessments are advisory until independently corroborated;
  // the numerical risk outcome must use reproducible, source-backed rules.
  const risk_score = computeCompositeRiskScore(null, anomaly.flags);
  let risk_level = riskLevelFromScore(risk_score.total);
  let verification_status = determineVerificationStatus(risk_score.total, null, []);

  // Apply RAVIQEN mandatory risk-briefing rules (RULE-BE-01 / HV-02 / BS-03)
  const ravigen_rules = anomaly.ravigen || [];
  if (ravigen_rules.some((r) => r.severity === "critical")) {
    risk_level = "critical";
    verification_status = "quarantined";
  } else if (ravigen_rules.some((r) => r.severity === "high")) {
    if (risk_level !== "critical") risk_level = "high";
    if (verification_status !== "quarantined") verification_status = "flagged";
  }

  // Contextual clearance overrides — suppressed when a true anomaly (Phase 3) is present
  const hasAdvancedThreat = advanced.flags.length > 0;
  if (!hasAdvancedThreat && (ctx.approvedByContract || ctx.verifiedEnterprise || ctx.clearanceLabel === "Verified Business Operations - Cleared by Logic")) {
    risk_level = "low";
    verification_status = "valid";
  } else if (ctx.genuineB2BOutlier && verification_status === "quarantined") {
    verification_status = "flagged";
  }

  // Phase 3 escalation: true fraud typologies force quarantine regardless of whitelist
  if (hasAdvancedThreat) {
    const criticalThreat = advanced.rules.some((r) => r.severity === "critical");
    const highThreat = advanced.rules.some((r) => r.severity === "high");
    if (criticalThreat) {
      risk_level = "critical";
      verification_status = "quarantined";
    } else if (highThreat && risk_level !== "critical") {
      risk_level = "high";
      verification_status = "quarantined";
    }
  }

  // Determine actionable next steps + append rule-specific mitigation
  let next_steps = determineNextSteps(risk_score.total, null, anomaly.flags);
  const mitigation = ravigen_rules
    .filter((r) => r.severity === "high" || r.severity === "critical")
    .map((r) => `[${r.rule_id}] ${r.mitigation}`);
  if (mitigation.length) next_steps = [...mitigation, ...next_steps];

  // ── Procurement Pricing & Market Variance Engine (RULE-PG-01/02/03) ──
  let procurement_variance = null;
  try {
    procurement_variance = await analyzeProcurementVariance(record, { skipMarket: true });
    if (procurement_variance) {
      const top = topProcurementRule(procurement_variance);
      if (top) {
        const pvFlag = top.flagged_rule === "RULE-PG-04" ? "Invoice line-total arithmetic discrepancy"
          : top.flagged_rule === "RULE-PG-03" ? "Severe quoted price variance (>50% above cited market price)"
          : "Quoted price variance (26–50% above cited market price)";
        anomaly.flags.push(pvFlag);
        anomaly.details.push(top.flagged_rule === "RULE-PG-04" ? top.arithmetic_finding : `[${top.flagged_rule}] ${top.item_description}: quoted ${top.invoice_unit_price} vs market ${top.nigerian_market_avg} (${top.calculated_variance_percent}). ${procurement_variance.recommended_action}`);
        flag_evidence.push({ flag: pvFlag, rule_id: top.flagged_rule, evidence_field: top.flagged_rule === "RULE-PG-04" ? "line_items.line_total" : "line_items.unit_price", evidence_value: top.flagged_rule === "RULE-PG-04" ? top.arithmetic_finding : `${top.item_description}: ${top.invoice_unit_price}; market ${top.nigerian_market_avg} (${top.market_source_url})`, detail: procurement_variance.recommended_action });
        if (["RULE-PG-03", "RULE-PG-04"].includes(top.flagged_rule)) {
          risk_level = "critical";
          verification_status = "quarantined";
        } else if (top.flagged_rule === "RULE-PG-02" && risk_level === "low") {
          risk_level = "medium";
          if (verification_status === "valid") verification_status = "flagged";
        }
      }
    }
  } catch (e) {
    console.error("Procurement variance analysis failed", e);
  }

  // ── B2B Commercial Validation Mandate (Zero-False-Positive Engine) ──
  // Runs after all prior screening. Verifies line-item math, detects true
  // fraud vectors (BEC, price gouging, math fraud, ghost entities), forces
  // risk score 0-15 for verified B2B procurement, and emits the mandatory
  // JSON payload contract with system_commands for ledger disbursement.
  const enrichedResult = {
    normalized: record,
    missing: [],
    verification,
    anomaly,
    flag_evidence,
    risk_score,
    risk_level,
    verification_status,
    next_steps,
    ravigen_rules,
    procurement_variance,
    advanced_threats: advanced,
    contextual: {
      notes: ctx.notes,
      clearanceLabel: ctx.clearanceLabel,
      approvedByContract: ctx.approvedByContract,
      genuineB2BOutlier: ctx.genuineB2BOutlier,
      entityAligned: ctx.entityAligned,
      verifiedEnterprise: ctx.verifiedEnterprise,
      contextualScore: risk_score.total,
    },
  };
  const result = applyB2BValidationMandate(enrichedResult);
  const minimum = { low: 0, medium: 30, high: 55, critical: 75 }[result.risk_level] || 0;
  const total = Math.max(result.risk_score.total, minimum);
  const parts = result.risk_score.breakdown;
  result.risk_score = { ...result.risk_score, total, breakdown: {
    ...parts,
    rule_escalation: Math.max(0, total - Object.values(parts).reduce((sum, n) => sum + n, 0)),
  } };
  if (result.ledger_payload?.risk_evaluation) result.ledger_payload.risk_evaluation.risk_score = total;
  return result;
}

// ─── Batch Processing with Progress Callback ────────────────────────────────

export async function processBatch(normalizedRecords, baseline = [], onProgress, options = {}) {
  const results = [];
  for (let i = 0; i < normalizedRecords.length; i++) {
    try {
      const result = await processRecord(normalizedRecords[i], baseline, options);
      results.push(result);
    } catch (e) {
      results.push({
        normalized: normalizedRecords[i].record,
        missing: normalizedRecords[i].missing,
        verification: null,
        anomaly: { flags: ["Processing error"], details: [e.message] },
        risk_score: null,
        risk_level: "not_scored",
        verification_status: "quarantined",
        next_steps: ["Manual review required — automated screening failed"],
        error: e.message,
      });
    }
    if (onProgress) onProgress(i + 1, normalizedRecords.length);
  }
  return results;
}

// ─── Persist Results to Entities ───────────────────────────────────────────

export async function persistScreeningResults(results, batchId, user, filename = "") {
  const transactions = [];
  const alerts = [];
  const vendorVerifications = [];
  const adverseMediaScans = [];
  const failures = [];

  for (const r of results) {
    if (r.missing.length > 0 || r.error) {
      const rec = r.normalized || {};
      failures.push(stampTenant({
        document_id: crypto.randomUUID(), source_reference: rec.transaction_id || "",
        entity_name: rec.vendor || "Not specified", sector: rec.sector || "Not specified",
        validated_amount: typeof rec.amount === "number" && Number.isFinite(rec.amount) ? rec.amount : null,
        currency_iso: rec.currency || "", risk_score: null, risk_level: "",
        verdict_summary: r.error ? `Processing failed: ${r.error}. No risk score was assigned.` : `Missing required fields: ${r.missing.join(", ")}. No risk score was assigned.`,
        audit_status: "PENDING_REVIEW", batch_id: batchId,
      }, user));
      continue;
    }

    const rec = r.normalized;
    const status = r.verification_status === "valid" ? "clean" : r.verification_status === "flagged" ? "flagged" : "quarantined";

    transactions.push({
      transaction_id: rec.transaction_id,
      vendor: rec.vendor,
      description: rec.counterparty ? `Counterparty: ${rec.counterparty}` : "",
      amount: rec.amount,
      currency: rec.currency || "USD",
      transaction_date: rec.transaction_date,
      category: rec.category || "",
      sector: rec.sector || "",
      verdict_summary: (r.flag_evidence || []).map((e) => e.detail).filter(Boolean).join("; ") || "No evidenced risk flags recorded; pending human review.",
      audit_status: "PENDING_REVIEW",
      location: rec.location || "",
      payment_method: rec.payment_method || "",
      status,
      risk_score: r.risk_score.total,
      risk_level: r.risk_level,
      anomaly_flags: [...(r.anomaly?.flags || [])],
      flag_evidence: [...(r.flag_evidence || [])],
      procurement_variance: r.procurement_variance || null,
      batch_id: batchId,
      source_filename: filename,
      });

    if (status !== "clean") {
      alerts.push({
        title: `Screening flag: ${rec.vendor}${rec.counterparty ? " → " + rec.counterparty : ""}`,
        transaction_id: rec.transaction_id,
        vendor: rec.vendor,
        amount: rec.amount,
        currency: rec.currency || "USD",
        risk_level: r.risk_level,
        risk_score: r.risk_score.total,
        description: (r.flag_evidence || []).map((e) => e.detail).filter(Boolean).join('; ') || `Automated screening flagged this transaction with score ${r.risk_score.total}; human review required.`, 
        flag_reasons: r.anomaly?.flags || [],
        flag_evidence: [...(r.flag_evidence || [])],
        status: "open",
        category: "intelligent_screening",
      });
    }

    // Persist vendor verification record
    if (r.verification?.vendor_verification || r.verification?.sanctions_check) {
      vendorVerifications.push({
        vendor: rec.vendor,
        verification_status: "pending",
        kyb_status: "not_started",
        registration_number: rec.tax_id || "",
        country_of_incorporation: rec.location || "",
        sanctions_check: "not_checked",
        pep_check: "not_checked",
        risk_assessment: "Automated screening only; independent registry and sanctions checks required.",
        verified_by: user?.email || "system",
        verification_date: new Date().toISOString().split("T")[0],
      });
    }

    // Persist adverse media scan
    if (r.verification?.adverse_media && (r.verification.adverse_media.vendor_findings?.length > 0 || r.verification.adverse_media.counterparty_findings?.length > 0)) {
      adverseMediaScans.push({
        vendor: rec.vendor,
        scan_date: new Date().toISOString(),
        status: "completed",
        risk_rating: r.verification.adverse_media.vendor_risk || "clear",
        findings_count: (r.verification.adverse_media.vendor_findings?.length || 0) + (r.verification.adverse_media.counterparty_findings?.length || 0),
        findings: [
          ...(r.verification.adverse_media.vendor_findings || []).map((f) => ({ entity: rec.vendor, finding: f })),
          ...(r.verification.adverse_media.counterparty_findings || []).map((f) => ({ entity: rec.counterparty, finding: f })),
        ],
        categories: r.verification.adverse_media.categories || [],
        summary: r.verification.adverse_media.summary || "",
        recommended_action: r.next_steps[0] || "",
        scanned_by: user?.email || "system",
      });
    }
  }

  const stampedTx = transactions.map((t) => stampTenant(t, user));
  const stampedAlerts = alerts.map((a) => stampTenant(a, user));
  const stampedVV = vendorVerifications.map((v) => stampTenant(v, user));
  const stampedAMS = adverseMediaScans.map((m) => stampTenant(m, user));

  const [createdTx, createdAlerts, createdVV, createdAMS, createdFailures] = await Promise.all([
    stampedTx.length > 0 ? base44.entities.Transaction.bulkCreate(stampedTx) : [],
    stampedAlerts.length > 0 ? base44.entities.Alert.bulkCreate(stampedAlerts) : [],
    stampedVV.length > 0 ? base44.entities.VendorVerification.bulkCreate(stampedVV) : [],
    stampedAMS.length > 0 ? base44.entities.AdverseMediaScan.bulkCreate(stampedAMS) : [],
    failures.length > 0 ? base44.entities.IngestionAuditFailure.bulkCreate(failures) : [],
  ]);

  return {
    transactions: createdTx?.length || 0,
    alerts: createdAlerts?.length || 0,
    vendor_verifications: createdVV?.length || 0,
    adverse_media_scans: createdAMS?.length || 0,
    audit_failures: createdFailures?.length || 0,
  };
}

// ─── Risk Briefing Summary (for the Risk Briefing card) ──────────────────────

export function buildRiskBriefing(results) {
  const total = results.length;
  const valid = results.filter((r) => r.verification_status === "valid").length;
  const quarantined = results.filter((r) => r.verification_status === "quarantined").length;
  const flagged = results.filter((r) => r.verification_status === "flagged").length;

  const ruleBreakdown = { "RULE-BE-01": 0, "RULE-HV-02": 0, "RULE-BS-03": 0 };
  const mitigationSet = new Set();
  const byLevel = { low: 0, medium: 0, high: 0, critical: 0 };

  let entityMatchCount = 0;
  let scoreSum = 0;
  for (const r of results) {
    byLevel[r.risk_level] = (byLevel[r.risk_level] || 0) + 1;
    if (r.contextual?.entityAligned) entityMatchCount++;
    if (Number.isFinite(r.risk_score?.total)) scoreSum += r.contextual?.contextualScore ?? r.risk_score.total;
    for (const rule of r.ravigen_rules || []) {
      if (ruleBreakdown[rule.rule_id] != null) ruleBreakdown[rule.rule_id]++;
      if (rule.severity === "high" || rule.severity === "critical") mitigationSet.add(`[${rule.rule_id}] ${rule.mitigation}`);
    }
  }

  return {
    totalParsed: total,
    validEntries: valid,
    flaggedAnomalies: flagged,
    quarantined,
    byRiskLevel: byLevel,
    ruleBreakdown,
    recommendedMitigation: Array.from(mitigationSet),
    contextual: {
      entityMatchCount,
      avgContextualScore: results.some((r) => Number.isFinite(r.risk_score?.total)) ? Math.round(scoreSum / results.filter((r) => Number.isFinite(r.risk_score?.total)).length) : null,
    },
  };
}