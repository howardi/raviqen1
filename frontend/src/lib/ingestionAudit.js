import { CURRENCY_META } from "@/lib/currencyUtils";

// Transaction is the canonical ingestion ledger; retain original values rather than
// copying them to a second, eventually divergent audit collection.
export function toAuditRecord(t) {
  const currency = String(t.currency || "").toUpperCase();
  const amount = t.amount == null ? null : Number(t.amount);
  const formatted = amount == null || !Number.isFinite(amount) ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 }).format(amount);
  return {
    id: t.id,
    timestamp: t.created_date,
    document_id: t.id,
    source_reference: t.transaction_id || "",
    entity_name: t.vendor || "Not specified",
    sector: t.sector || "Not specified",
    validated_amount: amount,
    currency_iso: currency,
    formatted_amount: formatted === "—" ? formatted : CURRENCY_META[currency] ? `${CURRENCY_META[currency].symbol}${formatted}` : `${formatted} ${currency || "[Unknown Code]"}`,
    risk_score: t.risk_score ?? null,
    risk_level: t.risk_level || "not scored",
    verdict_summary: t.verdict_summary || (t.flag_evidence?.length ? t.flag_evidence.map((e) => e.detail).filter(Boolean).join("; ") : "No briefing recorded"),
    status: t.audit_status || "PENDING_REVIEW",
    source_filename: t.source_filename || "",
    batch_id: t.batch_id || "",
  };
}

async function loadAll(entity, pageSize) {
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await entity.list("-created_date", pageSize, offset);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

export async function loadAuditHistory(client, pageSize = 200) {
  const [transactions, failures] = await Promise.all([
    loadAll(client.entities.Transaction, pageSize),
    loadAll(client.entities.IngestionAuditFailure, pageSize),
  ]);
  return [...transactions.map(toAuditRecord), ...failures.map((f) => toAuditRecord({
    id: f.document_id || f.id, created_date: f.created_date, transaction_id: f.source_reference,
    vendor: f.entity_name, sector: f.sector, amount: f.validated_amount,
    currency: f.currency_iso, risk_score: f.risk_score, risk_level: f.risk_level,
    verdict_summary: f.verdict_summary, audit_status: f.audit_status,
    source_filename: f.source_filename, batch_id: f.batch_id,
  }))].sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}


export function filterAudit(records, { search = "", risk = "", sector = "", from = "", to = "" }) {
  const q = search.trim().toLowerCase();
  return records.filter((r) => (!q || `${r.entity_name} ${r.document_id} ${r.source_reference}`.toLowerCase().includes(q))
    && (!risk || r.risk_level === risk)
    && (!sector || r.sector === sector)
    && (!from || (r.timestamp && r.timestamp.slice(0, 10) >= from))
    && (!to || (r.timestamp && r.timestamp.slice(0, 10) <= to)));
}