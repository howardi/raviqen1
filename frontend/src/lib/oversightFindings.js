export function findingsFromIngested(rows) {
  const findings = [];
  const byDepartment = new Map();
  for (const row of rows || []) {
    const list = byDepartment.get(row.department) || [];
    list.push(row);
    byDepartment.set(row.department, list);
    const metrics = row.metrics || {};
    for (const [key, value] of Object.entries(metrics)) {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount < 0) {
        findings.push({
          source_id: row.source_report_id || row.id,
          category: "Financial anomalies and ledger inconsistencies",
          attention: `${key} is ${amount} on ${row.report_date || "the report date"}.`,
          where: row.department || "the reporting department",
          when: "Before this report is treated as fact.",
          observation: `${key} is ${amount} on ${row.report_date || "the report date"}.`,
          follow_up: "Confirm the source figure before treating the report as fact.",
        });
      }
    }
  }
  for (const group of byDepartment.values()) {
    for (let index = 1; index < group.length; index += 1) {
      const previous = group[index - 1];
      const current = group[index];
      for (const key of Object.keys(current.metrics || {})) {
        const before = Number(previous.metrics?.[key]);
        const after = Number(current.metrics?.[key]);
        if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) continue;
        if (Math.abs(after - before) / Math.abs(before) < 2) continue;
        const procurement = /stock|purchase|supplier|price/.test(key);
        const money = /sales|revenue|payment|receipt|cash|price/.test(key);
        findings.push({
          source_id: current.source_report_id || current.id,
          category: procurement
            ? "Procurement irregularities"
            : money
              ? "Financial anomalies and ledger inconsistencies"
              : "Operational exceptions",
          attention: `${key} moved from ${before} to ${after}.`,
          where: `${current.department || "this department"}, between ${previous.report_date || previous.id} and ${current.report_date || current.id}`,
          when: "Before the later report is treated as the department record.",
          observation: `${key} moved from ${before} to ${after} between ${previous.report_date || previous.id} and ${current.report_date || current.id}.`,
          follow_up: "Compare the two ingested reports using the source documents.",
        });
      }
    }
  }
  return findings.slice(0, 8);
}
