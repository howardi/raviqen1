const SEVERITY = { low: 1, medium: 2, high: 3, critical: 4 };

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function finding(code, severity, title, evidence, action) {
  return { code, severity, title, evidence, action };
}

function moneyJump(current, prior) {
  if (current == null || prior == null || prior === 0) return false;
  return Math.abs(current - prior) / Math.abs(prior) >= 2;
}

export function analyzeReportFraud({ report, history = [], purchases = [] }) {
  const findings = [];
  const metrics = report?.metrics || {};
  const department = report?.department || "general";
  const prior = history.find((row) => row.id !== report?.id && row.department === department);

  if (report?.corrects_report_id) {
    findings.push(finding(
      "CORRECTION",
      "medium",
      "Same-day correction submitted",
      `This report corrects ${report.corrects_report_id} instead of replacing it.`,
      "Compare both submissions before ingesting either one."
    ));
  }

  const values = Object.entries(metrics)
    .filter(([key]) => key !== "notes")
    .map(([key, value]) => [key, num(value)]);

  for (const [key, value] of values) {
    if (value != null && value < 0) {
      findings.push(finding("NEGATIVE", "high", `${key.replaceAll("_", " ")} is negative`, `${key} = ${value}`, "Confirm the source figure before ingestion."));
    }
  }

  const occupancy = num(metrics.occupancy);
  const checkIns = num(metrics.check_ins);
  const checkOuts = num(metrics.check_outs);
  const revenue = num(metrics.revenue);
  if (department === "front_desk") {
    if (occupancy != null && (occupancy > 100 || occupancy < 0)) findings.push(finding("OCCUPANCY", "high", "Occupancy is outside 0–100%", `Occupancy ${occupancy}%`, "Reconcile the room count with the PMS."));
    if (revenue === 0 && (checkIns || 0) > 0) findings.push(finding("ZERO_REVENUE", "high", "Check-ins recorded with zero revenue", `${checkIns} check-ins and revenue 0`, "Look for unposted room charges or comps."));
    if (checkOuts != null && checkIns != null && checkOuts > checkIns * 3 && checkOuts > 10) findings.push(finding("CHECKOUT_SPIKE", "medium", "Check-outs far exceed check-ins", `${checkOuts} outs vs ${checkIns} ins`, "Confirm the business date and walk-outs."));
  }

  const sales = num(metrics.sales);
  const covers = num(metrics.covers);
  const wastage = num(metrics.wastage);
  if (department === "restaurant") {
    if (wastage != null && sales != null && wastage > sales && sales > 0) findings.push(finding("WASTAGE", "critical", "Wastage exceeds sales", `Wastage ${wastage} vs sales ${sales}`, "Hold the report for a kitchen and store reconciliation."));
    if ((sales || 0) > 0 && covers === 0) findings.push(finding("COVERS", "high", "Sales recorded with zero covers", `Sales ${sales}`, "Check voided covers or off-book sales."));
  }

  const reported = num(metrics.faults_reported);
  const fixed = num(metrics.faults_fixed);
  if (department === "maintenance" && fixed != null && reported != null && fixed > reported + (num(metrics.pending_jobs) || 0)) {
    findings.push(finding("FAULTS", "medium", "More faults fixed than reported plus pending", `Fixed ${fixed}, reported ${reported}`, "Ask for the job cards behind the count."));
  }

  const attendance = num(metrics.attendance);
  const leave = num(metrics.leave);
  if (department === "hr" && leave != null && attendance != null && leave > attendance && attendance > 0) {
    findings.push(finding("LEAVE", "high", "Leave exceeds attendance", `Leave ${leave}, attendance ${attendance}`, "Match the roster to the payroll headcount."));
  }

  const receipts = num(metrics.receipts);
  const payments = num(metrics.payments);
  const cash = num(metrics.cash_position);
  if (department === "finance") {
    if (payments != null && receipts != null && receipts > 0 && payments > receipts * 1.5) findings.push(finding("PAYMENTS", "high", "Payments are far above receipts", `Payments ${payments} vs receipts ${receipts}`, "Trace the payment batch against the cashbook."));
    if (cash != null && cash < 0) findings.push(finding("CASH", "critical", "Cash position is negative", `Cash ${cash}`, "Do not ingest until the cashier recounts."));
  }

  const exceptions = num(metrics.exceptions);
  const samples = num(metrics.samples_reviewed);
  if (department === "audit" && exceptions != null && samples != null && exceptions > samples) {
    findings.push(finding("EXCEPTIONS", "high", "Exceptions exceed the sample", `${exceptions} exceptions in ${samples} samples`, "Reperform the sample before closing the day."));
  }

  if (department === "procurement" || purchases.length) {
    const priced = purchases.map((line) => num(line.unit_price)).filter((n) => n != null && n > 0);
    const median = priced.length ? [...priced].sort((a, b) => a - b)[Math.floor(priced.length / 2)] : null;
    purchases.forEach((line, index) => {
      const price = num(line.unit_price);
      const qty = num(line.quantity);
      if (!String(line.supplier || "").trim()) findings.push(finding("SUPPLIER", "medium", "Purchase has no supplier", line.item || `Line ${index + 1}`, "Require a supplier before the line is ingested."));
      if (price === 0 || price == null) findings.push(finding("ZERO_PRICE", "high", "Purchase has no unit price", line.item || `Line ${index + 1}`, "Match the line to a receipt before approval."));
      if (qty === 0) findings.push(finding("ZERO_QTY", "medium", "Purchase quantity is zero", line.item || `Line ${index + 1}`, "Confirm the goods received note."));
      if (median && price != null && price > median * 3) findings.push(finding("PRICE_VARIANCE", "critical", "Unit price is more than triple the day's median", `${line.item}: ${price} vs median ${median}`, "Compare with recent invoices and expected pricing before payment."));
      if (price > 0 && qty > 0 && !String(line.receipt || line.receipt_url || line.file_url || "").trim()) {
        findings.push(finding("MISSING_RECEIPT", "medium", "Purchase has no receipt", line.item || `Line ${index + 1}`, "Attach the supplier receipt before the line is ingested."));
      }
    });
    const seen = new Map();
    purchases.forEach((line, index) => {
      const key = [String(line.item || "").trim().toLowerCase(), String(line.supplier || "").trim().toLowerCase(), num(line.unit_price), num(line.quantity)].join("|");
      if (seen.has(key)) {
        findings.push(finding("DUPLICATE_LINE", "high", "Duplicate purchase line", `${line.item || `Line ${index + 1}`} repeats line ${seen.get(key) + 1} with the same supplier, quantity, and unit price.`, "Confirm this is not a double posting before payment."));
      } else seen.set(key, index);
    });
    const priorLines = history.flatMap((row) => row.purchases || []);
    purchases.forEach((line) => {
      const price = num(line.unit_price);
      const item = String(line.item || "").trim().toLowerCase();
      const supplier = String(line.supplier || "").trim().toLowerCase();
      if (!item || price == null || price <= 0) return;
      const earlier = priorLines
        .map((row) => ({ item: String(row.item || "").trim().toLowerCase(), supplier: String(row.supplier || "").trim().toLowerCase(), price: num(row.unit_price) }))
        .filter((row) => row.item === item && row.supplier === supplier && row.price > 0);
      const priorPrice = earlier.length ? earlier[earlier.length - 1].price : null;
      if (priorPrice && price >= priorPrice * 1.5) {
        findings.push(finding("PRICE_CLIMB", "high", "Unit price jumped against the last matching purchase", `${line.item}: ${price} versus prior ${priorPrice}${supplier ? ` from ${line.supplier}` : ""}.`, "Compare the new receipt with the last accepted invoice before payment."));
      }
    });
    const bySupplier = new Map();
    purchases.forEach((line) => {
      const supplier = String(line.supplier || "").trim().toLowerCase();
      const price = num(line.unit_price);
      const qty = num(line.quantity);
      if (!supplier || price == null || qty == null || price <= 0 || qty <= 0) return;
      const bucket = bySupplier.get(supplier) || [];
      bucket.push({ item: String(line.item || "").trim().toLowerCase(), total: price * qty, label: line.supplier });
      bySupplier.set(supplier, bucket);
    });
    for (const [, lines] of bySupplier) {
      if (lines.length < 3) continue;
      const amounts = lines.map((line) => line.total).filter((total) => total >= 1000);
      if (amounts.length < 3) continue;
      const average = amounts.reduce((sum, total) => sum + total, 0) / amounts.length;
      const tight = amounts.every((total) => Math.abs(total - average) / average <= 0.05);
      const distinctItems = new Set(lines.map((line) => line.item)).size >= 2;
      if (tight && distinctItems) {
        findings.push(finding("SPLIT", "high", "Repeated similar amounts to one supplier", `${lines.length} lines for ${lines[0].label} are within 5% of each other.`, "Check whether one purchase was split to stay under a review limit."));
      }
    }
    const issued = num(metrics.stock_issued);
    const received = num(metrics.stock_received);
    if (issued != null && received != null && issued > received * 1.25 && issued > 0) {
      findings.push(finding("STOCK", "high", "Stock issued exceeds stock received", `Issued ${issued}, received ${received}`, "Check for unrecorded issues or shrinkage."));
    }
  }

  if (prior) {
    const changed = values.filter(([key, value]) => value != null && num(prior.metrics?.[key]) != null);
    const identical = changed.length > 0 && changed.every(([key, value]) => num(prior.metrics?.[key]) === value);
    if (identical) findings.push(finding("UNCHANGED", "medium", "Figures match the previous report exactly", `Prior report ${prior.report_date || prior.id}`, "Confirm this is a new count and not a copied return."));
    if (moneyJump(sales, num(prior.metrics?.sales)) || moneyJump(revenue, num(prior.metrics?.revenue)) || moneyJump(payments, num(prior.metrics?.payments))) {
      findings.push(finding("VARIANCE", "high", "A money figure moved by 200% or more", "Compared with the previous submission in this department.", "Ask for the supporting till, invoice, or cashier report."));
    }
  }

  if (!findings.length) {
    findings.push(finding("CLEAR", "low", "No fraud indicators on the submitted figures", "Metrics, notes, and purchase lines were checked against department rules.", "Review the narrative, then ingest if the source documents agree."));
  }

  const score = Math.min(100, findings.reduce((sum, item) => sum + SEVERITY[item.severity] * 15, 0));
  const risk_level = findings.some((item) => item.severity === "critical") ? "critical"
    : findings.some((item) => item.severity === "high") ? "high"
    : findings.some((item) => item.severity === "medium") ? "medium"
    : "low";

  return {
    risk_level,
    score,
    findings,
    analyzed_at: new Date().toISOString(),
  };
}

export function buildInvestigationReport({ departments = [], reports = [], issues = [], generatedBy = "Manager" }) {
  const analyzed = reports.map((report) => ({
    ...report,
    fraud_analysis: report.fraud_analysis || analyzeReportFraud({ report, history: reports, purchases: report.purchases || [] }),
  }));
  const flagged = analyzed.filter((report) => ["medium", "high", "critical"].includes(report.fraud_analysis.risk_level));
  const byDepartment = departments.map((dept) => {
    const rows = analyzed.filter((report) => report.department === dept.slug);
    return { ...dept, count: rows.length, flagged: rows.filter((row) => row.fraud_analysis.risk_level !== "low").length };
  });
  const highest = flagged.sort((a, b) => b.fraud_analysis.score - a.fraud_analysis.score)[0];
  return {
    title: "Raviqen overall business investigation",
    generated_at: new Date().toISOString(),
    generated_by: generatedBy,
    executive_summary: highest
      ? `${flagged.length} submitted report${flagged.length === 1 ? "" : "s"} need follow-up. Highest priority is ${highest.title} (${highest.department}, ${highest.fraud_analysis.risk_level}).`
      : "No medium, high, or critical fraud indicators were found in the submitted reports reviewed for this investigation.",
    departments: byDepartment,
    findings: flagged.flatMap((report) => report.fraud_analysis.findings.filter((item) => item.code !== "CLEAR").map((item) => ({
      report_id: report.report_id || report.id,
      department: report.department,
      title: item.title,
      severity: item.severity,
      evidence: item.evidence,
      action: item.action,
    }))),
    issues: issues.map((issue) => ({
      title: issue.title,
      status: issue.status,
      owner: issue.owner || "Unassigned",
      due_date: issue.due_date || "",
      notes: issue.notes || "",
    })),
    conclusion: flagged.length
      ? "Raise the flagged items in the management meeting. Ingest a report only after the stated action is checked against the source document."
      : "The reviewed submissions can proceed to ingestion, subject to the manager's manual approval.",
  };
}
