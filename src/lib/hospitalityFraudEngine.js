// RAVIQEN Enterprise & Hospitality Fraud Detection Engine
// Ingests operational data from Hotel PMS, Restaurant POS, and Corporate
// HR/Expense ledgers and executes behavioral analytics to detect front-line
// skimming, inventory theft, and internal corporate fraud.
//
// Output: an array of fraud alerts in the standardized JSON payload format:
//   { event_id, department, employee_id, fraud_vector_analysis, overall_risk_level, recommended_action }

import { base44 } from "@/api/base44Client";
import { stampTenant } from "@/lib/tenantScope";
import { readXlsxRows } from "@/lib/xlsxRows";

// ─── Field alias map (PMS / POS / HR) ────────────────────────────────────────
const ALIASES = {
  // Hotel PMS
  room_number: ["room_number", "room_no", "room", "room_id"],
  room_status: ["room_status", "status", "room_state", "room_condition"],
  housekeeping_status: ["housekeeping_status", "hk_status", "housekeeping", "cleaning_status", "cleaned", "hk_state"],
  keycard_entries: ["keycard_entries", "keycard", "door_entries", "key_card_entries", "access_entries", "door_access", "keycard_access"],
  agent_id: ["agent_id", "front_desk_agent", "user_id", "clerk", "agent", "receptionist", "fd_agent"],
  rate_type: ["rate_type", "rate_code", "rate_plan", "booking_rate", "rate_code_type"],
  rate_amount: ["rate_amount", "rate", "amount", "room_rate", "price", "nightly_rate"],
  shift: ["shift", "shift_id", "shift_name", "shift_code"],
  reservation_id: ["reservation_id", "reservation", "res_id", "booking_id", "reservation_no", "booking_ref"],
  occupancy_date: ["occupancy_date", "date", "night", "business_date", "night_date"],
  charge_type: ["charge_type", "transaction_type", "action", "action_type", "event_type", "posting_type"],
  departure_time: ["departure_time", "departure", "checkout_time", "checkout", "departure_date"],
  void_time: ["void_time", "void_date", "refund_time", "refund_date", "void_timestamp"],
  refund_card: ["refund_card", "refund_card_last4", "refund_method", "refund_card_number", "new_card", "refund_to"],
  original_card: ["original_card", "card_last4", "payment_card", "card", "original_card_last4"],
  // Restaurant POS
  server_id: ["server_id", "server", "waiter", "bartender", "staff_id", "server_name", "employee_id"],
  check_id: ["check_id", "check", "check_number", "order_id", "order", "check_no", "check_number_id"],
  open_time: ["open_time", "start_time", "check_open", "opened_at", "open_timestamp"],
  close_time: ["close_time", "end_time", "check_close", "closed_at", "settle_time", "payment_time", "close_timestamp"],
  payment_type: ["payment_type", "payment_method", "tender", "tender_type", "payment", "payment_tender"],
  void_count: ["void_count", "voids", "item_voids", "voided_items", "void", "voided_count"],
  comp_count: ["comp_count", "comps", "manager_comps", "comp", "comped_items"],
  transfer_count: ["transfer_count", "transfers", "item_transfers", "transfer", "transferred_items"],
  split_count: ["split_count", "splits", "split", "split_checks"],
  table_id: ["table_id", "table", "table_number", "table_no"],
  check_status: ["check_status", "status", "check_state", "order_status"],
  item_count: ["item_count", "items", "item_count_total", "items_count", "item_qty"],
  // Corporate HR / Expense
  bank_account: ["bank_account", "account_number", "direct_deposit", "deposit_account", "bank_acct", "account_no"],
  address: ["address", "home_address", "residence", "residential_address"],
  next_of_kin: ["next_of_kin", "nok", "emergency_contact", "kin", "next_of_kin_name"],
  access_logs_count: ["access_logs_count", "access_logs", "building_access", "login_count", "access_count", "logins", "badge_swipes"],
  payroll_received: ["payroll_received", "paid", "payroll_amount", "salary_paid", "pay_amount", "net_pay"],
  expense_amount: ["expense_amount", "amount", "receipt_amount", "claim_amount", "expense_total"],
  expense_category: ["expense_category", "category", "expense_type", "claim_category", "expense_class"],
  expense_date: ["expense_date", "date", "transaction_date", "claim_date", "receipt_date"],
  receipt_id: ["receipt_id", "receipt", "receipt_number", "invoice_ref", "receipt_ref"],
  expense_location: ["expense_location", "location", "vendor_location", "city", "merchant_location"],
  expense_distance: ["expense_distance", "distance", "distance_from_home", "miles_from_home", "km_from_home", "distance_miles"],
  department: ["department", "dept", "domain", "source_system", "data_source", "system"],
};

function getField(record, canonical) {
  const aliases = ALIASES[canonical] || [canonical];
  const keys = Object.keys(record);
  for (const alias of aliases) {
    const match = keys.find((k) => k.toLowerCase().replace(/[\s_-]/g, "") === alias.toLowerCase().replace(/[\s_-]/g, ""));
    if (match && record[match] != null && record[match] !== "") return record[match];
  }
  return null;
}

function str(v) { return v == null ? "" : String(v).toLowerCase(); }
function num(v) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ─── Data type detection ─────────────────────────────────────────────────────
export function detectDataType(records) {
  let pms = 0, pos = 0, hr = 0;
  for (const r of records.slice(0, 80)) {
    if (getField(r, "room_number") || getField(r, "reservation_id") || getField(r, "housekeeping_status") || getField(r, "keycard_entries") != null) pms++;
    if (getField(r, "check_id") || getField(r, "server_id") || (getField(r, "payment_type") && getField(r, "void_count") != null)) pos++;
    if (getField(r, "employee_id") && (getField(r, "bank_account") || getField(r, "expense_category") || getField(r, "access_logs_count") != null || getField(r, "payroll_received") != null || getField(r, "next_of_kin"))) hr++;
  }
  const types = [];
  if (pms > 0) types.push("Front_Desk");
  if (pos > 0) types.push("Restaurant_POS");
  if (hr > 0) types.push("Corporate_HR");
  return types;
}

// ─── PHASE 1: Hotel Front Desk (PMS Analytics) ──────────────────────────────
function analyzeHotelPMS(records) {
  const alerts = [];

  // RULE-PMS-01 — "Out of Order" (OOO) Abuse
  for (const r of records) {
    const status = str(getField(r, "room_status"));
    const hk = str(getField(r, "housekeeping_status"));
    const keys = num(getField(r, "keycard_entries"));
    const isOOO = status.includes("ooo") || status.includes("out of order") || status.includes("maintenance") || status.includes("out-of-order");
    if (isOOO && (hk.includes("clean") || keys > 0)) {
      alerts.push({
        event_id: getField(r, "reservation_id") || getField(r, "room_number") || `PMS-OOO-${alerts.length + 1}`,
        department: "Front_Desk",
        employee_id: getField(r, "agent_id") || "UNKNOWN",
        fraud_vector_analysis: {
          detected_anomaly: "Room marked Out-of-Order/Maintenance during peak occupancy, but housekeeping or keycard data indicates the room was occupied",
          calculated_metric: `Room ${getField(r, "room_number") || "-"} status="${status}" on ${getField(r, "occupancy_date") || "-"}; housekeeping="${hk || "-"}", keycard entries=${keys || 0}`,
          status: "HIGH RISK - Ghost Renting / Cash Skimming",
          flagged_rule: "RULE-PMS-01",
        },
        overall_risk_level: "HIGH",
        recommended_action: "Audit keycard access logs and CCTV for the room; reconcile the responsible agent's cash drawer; inspect maintenance work orders for legitimacy.",
      });
    }
  }

  // RULE-PMS-02 — Rate Manipulation & Discount Abuse
  const DISCOUNT_KEYWORDS = ["friends & family", "friends and family", "f&f", "walk-in cash", "walkin cash", "cash discount", "rate override", "override", "complimentary", "comp rate", "staff rate", "house use"];
  const byAgent = {};
  const byShift = {};
  for (const r of records) {
    const agent = getField(r, "agent_id");
    if (!agent) continue;
    const rt = str(getField(r, "rate_type"));
    const isDiscount = DISCOUNT_KEYWORDS.some((k) => rt.includes(k));
    const sh = getField(r, "shift") || "default";
    byAgent[agent] = byAgent[agent] || { discount: 0, total: 0, shift: sh };
    byAgent[agent].total++;
    if (isDiscount) byAgent[agent].discount++;
    byShift[sh] = byShift[sh] || { discount: 0, total: 0 };
    byShift[sh].total++;
    if (isDiscount) byShift[sh].discount++;
  }
  for (const [agent, d] of Object.entries(byAgent)) {
    const shiftAvg = byShift[d.shift] && byShift[d.shift].total ? byShift[d.shift].discount / byShift[d.shift].total : 0;
    const agentRate = d.total ? d.discount / d.total : 0;
    if (d.discount >= 3 && agentRate > 2 * (shiftAvg || 0.01) && agentRate > shiftAvg + 0.05) {
      alerts.push({
        event_id: `PMS-RATE-${agent}`,
        department: "Front_Desk",
        employee_id: agent,
        fraud_vector_analysis: {
          detected_anomaly: `Agent ${agent} processes an unusually high volume of discounted/override rates vs the shift average`,
          calculated_metric: `${d.discount} discounted/override rates of ${d.total} transactions (${(agentRate * 100).toFixed(1)}%) vs shift average of ${(shiftAvg * 100).toFixed(1)}%`,
          status: "MEDIUM RISK - Rate Skimming",
          flagged_rule: "RULE-PMS-02",
        },
        overall_risk_level: "MEDIUM",
        recommended_action: "Review the agent's rate-override audit trail; compare against reservation source and authorization levels; interview agent for pattern justification.",
      });
    }
  }

  // RULE-PMS-03 — Post-Departure Voids / No-Show Fraud
  for (const r of records) {
    const ct = str(getField(r, "charge_type"));
    const isNoShowOrCash = ct.includes("no show") || ct.includes("no-show") || ct.includes("cash");
    const voidTime = getField(r, "void_time");
    const depTime = getField(r, "departure_time");
    const refundCard = getField(r, "refund_card");
    const origCard = getField(r, "original_card");
    const afterDeparture = voidTime && depTime && !isNaN(new Date(voidTime)) && !isNaN(new Date(depTime)) && new Date(voidTime) > new Date(depTime);
    const diffCard = refundCard && origCard && String(refundCard).trim() !== String(origCard).trim();
    const markedError = ct.includes("error") || ct.includes("void") || ct.includes("refund");
    if (isNoShowOrCash && afterDeparture && (diffCard || markedError)) {
      alerts.push({
        event_id: getField(r, "reservation_id") || `PMS-VOID-${alerts.length + 1}`,
        department: "Front_Desk",
        employee_id: getField(r, "agent_id") || "UNKNOWN",
        fraud_vector_analysis: {
          detected_anomaly: diffCard ? "Reservation charge voided after recorded departure with a different refund card" : "Reservation charge marked void/error/refund after recorded departure",
          calculated_metric: `Reservation ${getField(r, "reservation_id") || "-"} charged as "${ct}"; void at ${voidTime} after departure ${depTime}${diffCard ? `; refund card ${refundCard} differs from original ${origCard}` : ""}`, 
          status: "CRITICAL RISK - Refund Fraud",
          flagged_rule: "RULE-PMS-03",
        },
        overall_risk_level: "CRITICAL",
        recommended_action: "Freeze the refund immediately; reconcile the original payment instrument; review the agent's override authority; escalate to Case Management and finance for chargeback audit.",
      });
    }
  }

  return alerts;
}

// ─── PHASE 2: Restaurant & Bar (POS Analytics) ──────────────────────────────
function analyzeRestaurantPOS(records) {
  const alerts = [];

  // RULE-POS-01 — The Void/Comp to Cash Ratio
  const byServer = {};
  for (const r of records) {
    const server = getField(r, "server_id");
    if (!server) continue;
    const pay = str(getField(r, "payment_type"));
    const isCash = pay.includes("cash");
    const v = num(getField(r, "void_count")) + num(getField(r, "comp_count"));
    byServer[server] = byServer[server] || { cashChecks: 0, voidedCash: 0, totalChecks: 0, voids: 0, comps: 0 };
    byServer[server].totalChecks++;
    if (isCash) {
      byServer[server].cashChecks++;
      if (v > 0) byServer[server].voidedCash++;
      byServer[server].voids += num(getField(r, "void_count"));
      byServer[server].comps += num(getField(r, "comp_count"));
    }
  }
  const servers = Object.entries(byServer);
  const avgVoidPct = servers.length
    ? servers.reduce((s, [, d]) => s + (d.cashChecks ? d.voidedCash / d.cashChecks : 0), 0) / servers.length
    : 0;
  for (const [server, d] of servers) {
    const voidPct = d.cashChecks ? d.voidedCash / d.cashChecks : 0;
    if (d.cashChecks >= 5 && (voidPct > 3 * avgVoidPct || voidPct > 0.1) && voidPct > avgVoidPct + 0.03) {
      alerts.push({
        event_id: `POS-VOID-${server}`,
        department: "Restaurant_POS",
        employee_id: server,
        fraud_vector_analysis: {
          detected_anomaly: "High correlation of Item Voids / Error Corrections / Manager Comps occurring on cash-settled checks",
          calculated_metric: `${(voidPct * 100).toFixed(1)}% of cash checks voided/comped vs shift average of ${(avgVoidPct * 100).toFixed(1)}% (${d.voidedCash} of ${d.cashChecks} cash checks; ${d.voids} voids, ${d.comps} comps)`,
          status: "HIGH RISK - Suspected POS Void Skimming",
          flagged_rule: "RULE-POS-01",
        },
        overall_risk_level: "HIGH",
        recommended_action: "Audit the server's closed checks and cross-reference with kitchen ticket print times and CCTV footage.",
      });
    }
  }

  // RULE-POS-02 — Check Splitting & Transfer Anomalies
  for (const r of records) {
    const transfers = num(getField(r, "transfer_count"));
    const splits = num(getField(r, "split_count"));
    const status = str(getField(r, "check_status"));
    if (transfers > 0 && (status.includes("open") || status.includes("zero") || status.includes("transferred") || status.includes("kiting"))) {
      alerts.push({
        event_id: getField(r, "check_id") || `POS-SPLIT-${alerts.length + 1}`,
        department: "Restaurant_POS",
        employee_id: getField(r, "server_id") || "UNKNOWN",
        fraud_vector_analysis: {
          detected_anomaly: "Items (especially high-margin) transferred from a settled check to an open check, or open checks left hanging and zeroed out at end-of-shift",
          calculated_metric: `Check ${getField(r, "check_id") || "-"}: ${transfers} transfers, ${splits} splits, status="${status}"`,
          status: "MEDIUM RISK - Wagon-Wheeling / Check Kiting",
          flagged_rule: "RULE-POS-02",
        },
        overall_risk_level: "MEDIUM",
        recommended_action: "Reconstruct the check audit trail; verify item-transfer approvals; reconcile register close-out against the POS journal.",
      });
    }
  }

  // RULE-POS-03 — Time-to-Settle Discrepancies
  for (const r of records) {
    const open = getField(r, "open_time");
    const close = getField(r, "close_time");
    const pay = str(getField(r, "payment_type"));
    if (open && close && !isNaN(new Date(open)) && !isNaN(new Date(close))) {
      const durHours = (new Date(close) - new Date(open)) / 3600000;
      if (durHours >= 3 && pay.includes("cash")) {
        alerts.push({
          event_id: getField(r, "check_id") || `POS-TIME-${alerts.length + 1}`,
          department: "Restaurant_POS",
          employee_id: getField(r, "server_id") || "UNKNOWN",
          fraud_vector_analysis: {
            detected_anomaly: "Table check remained open at least 3 hours before cash settlement",
            calculated_metric: `Check ${getField(r, "check_id") || "-"} open ${durHours.toFixed(1)} hours; settled ${pay}`,
            status: "LOW-MEDIUM RISK - Float Manipulation",
            flagged_rule: "RULE-POS-03",
          },
          overall_risk_level: "LOW-MEDIUM",
          recommended_action: "Review check open/close timestamps; compare to table turnover data; interview server for settlement-delay rationale.",
        });
      }
    }
  }

  return alerts;
}

// ─── PHASE 3: General Corporate Entities (HR & Expense) ──────────────────────
function analyzeCorporateHR(records) {
  const alerts = [];

  // RULE-HR-01 — Ghost Employee Detection (shared identifiers)
  const groups = { bank: {}, addr: {}, nok: {} };
  for (const r of records) {
    const emp = getField(r, "employee_id");
    if (!emp) continue;
    const ba = getField(r, "bank_account");
    if (ba) (groups.bank[ba] ||= []).push(emp);
    const ad = getField(r, "address");
    if (ad) (groups.addr[ad] ||= []).push(emp);
    const nk = getField(r, "next_of_kin");
    if (nk) (groups.nok[nk] ||= []).push(emp);
  }
  const empReasons = {};
  const addReason = (emp, reason) => {
    empReasons[emp] = empReasons[emp] || new Set();
    empReasons[emp].add(reason);
  };
  for (const [, emps] of Object.entries(groups.bank)) if (new Set(emps).size > 1) emps.forEach((e) => addReason(e, "bank account"));
  for (const [, emps] of Object.entries(groups.addr)) if (new Set(emps).size > 1) emps.forEach((e) => addReason(e, "home address"));
  for (const [, emps] of Object.entries(groups.nok)) if (new Set(emps).size > 1) emps.forEach((e) => addReason(e, "next-of-kin"));
  for (const [emp, reasons] of Object.entries(empReasons)) {
    alerts.push({
      event_id: `HR-GHOST-${emp}`,
      department: "Corporate_HR",
      employee_id: emp,
      fraud_vector_analysis: {
        detected_anomaly: "Different employee IDs share at least one stated bank account, address, or next-of-kin; verify the relationship",
        calculated_metric: `Employee ${emp} shares identical ${[...reasons].join(", ")} with another payroll record`,
        status: "HIGH RISK - Shared employee identifiers",
        flagged_rule: "RULE-HR-01",
      },
      overall_risk_level: "HIGH",
      recommended_action: "Verify distinct identities and the shared identifiers with HR; investigate before taking payroll action.",
    });
  }

  // RULE-HR-01b — Ghost Employee (zero access 30+ days while receiving pay)
  for (const r of records) {
    const emp = getField(r, "employee_id");
    if (!emp) continue;
    const access = num(getField(r, "access_logs_count"));
    const paid = num(getField(r, "payroll_received"));
    if (getField(r, "access_logs_count") != null && access === 0 && paid > 0) {
      alerts.push({
        event_id: `HR-GHOST-ACCESS-${emp}`,
        department: "Corporate_HR",
        employee_id: emp,
        fraud_vector_analysis: {
          detected_anomaly: "Recorded access count is zero while payroll amount is positive; confirm coverage and employment status",
          calculated_metric: `Employee ${emp}: ${access} access events over the period, payroll received = ${paid}`,
          status: "HIGH RISK - Payroll / access mismatch",
          flagged_rule: "RULE-HR-01",
        },
        overall_risk_level: "HIGH",
        recommended_action: "Confirm the access-log coverage period and the employee's work arrangement with HR before making a payroll decision.",
      });
    }
  }

  // RULE-HR-02 — Duplicate Expense
  const byReceipt = {};
  for (const r of records) {
    const amt = getField(r, "expense_amount");
    const emp = getField(r, "employee_id");
    const rid = getField(r, "receipt_id");
    if (amt == null || !emp) continue;
    const key = rid ? `rid:${rid}` : `amt:${emp}:${num(amt)}`;
    (byReceipt[key] ||= []).push(r);
  }
  for (const [, rs] of Object.entries(byReceipt)) {
    if (rs.length >= 2) {
      const r = rs[0];
      alerts.push({
        event_id: `HR-DUP-${getField(r, "receipt_id") || `${r.employee_id || "X"}-${getField(r, "expense_amount")}`}`,
        department: "Corporate_HR",
        employee_id: getField(r, "employee_id") || "UNKNOWN",
        fraud_vector_analysis: {
          detected_anomaly: "Employee submits the exact same receipt amount across two different expense reports",
          calculated_metric: `Duplicate claim: ${getField(r, "expense_amount")} (receipt ${getField(r, "receipt_id") || "-"}) submitted ${rs.length} times`,
          status: "MEDIUM RISK - Expense Padding / Duplicate Claim",
          flagged_rule: "RULE-HR-02",
        },
        overall_risk_level: "MEDIUM",
        recommended_action: "Reject the duplicate submission; audit the employee's prior expense reports; request original receipts and manager attestation.",
      });
    }
  }

  // RULE-HR-02b — Weekend Business Meals near home
  for (const r of records) {
    const cat = str(getField(r, "expense_category"));
    const date = getField(r, "expense_date");
    const dist = num(getField(r, "expense_distance"));
    const isMeal = cat.includes("business meal") || cat.includes("meals") || cat.includes("dining") || cat.includes("entertainment") || cat.includes("restaurant");
    if (isMeal && date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const day = d.getUTCDay();
        if ((day === 0 || day === 6) && dist > 0 && dist <= 5) {
          alerts.push({
            event_id: `HR-WEEKEND-${getField(r, "employee_id") || "X"}-${date}`,
            department: "Corporate_HR",
            employee_id: getField(r, "employee_id") || "UNKNOWN",
            fraud_vector_analysis: {
              detected_anomaly: "Corporate-card expense categorized as Business Meals on a Saturday/Sunday within a 5-mile radius of the employee's home address",
              calculated_metric: `Category "${getField(r, "expense_category")}" on ${d.toISOString().slice(0, 10)} (${day === 0 ? "Sunday" : "Saturday"}), ${dist} miles from home`,
              status: "MEDIUM RISK - Expense Padding / Personal Spend",
              flagged_rule: "RULE-HR-02",
            },
            overall_risk_level: "MEDIUM",
            recommended_action: "Request business purpose and attendee list; verify against the employee's calendar; deny if determined to be personal weekend spend.",
          });
        }
      }
    }
  }

  return alerts;
}

// ─── Data Quality & Error Detection ─────────────────────────────────────────
// Scans raw records for structural defects that could silently mask fraud or
// zero-out metric calculations: unparseable amounts/dates, missing actor IDs,
// negative amounts, and duplicate event IDs. Each issue is returned as a
// low/medium data-quality finding so analysts see integrity gaps that the
// behavioral rules cannot themselves report (a rule that skips a bad record
// leaves no trace otherwise).
export function detectDataQualityIssues(records) {
  const issues = [];
  const seenIds = {};
  for (let i = 0; i < records.length; i++) {
    const r = records[i] || {};
    const row = i + 2; // +2 accounts for header row + 1-based index

    // Duplicate event identifier (reservation / check / receipt)
    const id = getField(r, "reservation_id") || getField(r, "check_id") || getField(r, "receipt_id");
    if (id) {
      seenIds[id] = (seenIds[id] || 0) + 1;
      if (seenIds[id] === 2) {
        issues.push({ row, severity: "MEDIUM", field: "event_id", issue: `Duplicate ID "${id}" appears on multiple records — possible re-import or cloned entries inflating counts` });
      }
    }

    // Unparseable or negative numeric fields
    for (const canon of ["rate_amount", "expense_amount", "payroll_received"]) {
      const raw = getField(r, canon);
      if (raw == null || raw === "") continue;
      const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
      if (cleaned === "" || isNaN(Number(cleaned))) {
        issues.push({ row, severity: "LOW", field: canon, issue: `Amount "${raw}" could not be parsed to a number — metric calculations silently zeroed for this record` });
      } else if (num(raw) < 0) {
        issues.push({ row, severity: "MEDIUM", field: canon, issue: `Negative amount (${raw}) — refunds/credits should be separated from gross charges to avoid masking skimming` });
      }
    }

    // Unparseable dates (time-based rules silently skip these)
    for (const f of ["occupancy_date", "open_time", "close_time", "void_time", "departure_time", "expense_date"]) {
      const v = getField(r, f);
      if (v && isNaN(new Date(v).getTime())) {
        issues.push({ row, severity: "LOW", field: f, issue: `Date field "${f}" = "${v}" is unparseable — time-based fraud rules (void-after-departure, settle-time) will skip this record` });
      }
    }

    // Missing actor on a transactional record — cannot attribute fraud
    const hasTransactional = getField(r, "charge_type") || getField(r, "check_id") || getField(r, "expense_amount") || getField(r, "payroll_received");
    const actor = getField(r, "agent_id") || getField(r, "server_id") || getField(r, "employee_id");
    if (hasTransactional && !actor) {
      issues.push({ row, severity: "MEDIUM", field: "actor_id", issue: `Transactional record missing agent/server/employee identifier — fraud cannot be attributed; behavioral rules skipped` });
    }
  }
  return issues;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────
export function runHospitalityFraudDetection(records) {
  const errors = [];
  const types = detectDataType(records);
  let alerts = [];
  // Each phase runs in isolation so a single malformed record in one analyzer
  // cannot abort the whole scan. Failures are captured, not swallowed.
  const runPhase = (name, fn) => {
    try { return fn(records) || []; }
    catch (e) { errors.push({ phase: name, message: e?.message || String(e) }); return []; }
  };
  if (types.includes("Front_Desk")) alerts = alerts.concat(runPhase("Hotel_PMS", analyzeHotelPMS));
  if (types.includes("Restaurant_POS")) alerts = alerts.concat(runPhase("Restaurant_POS", analyzeRestaurantPOS));
  if (types.includes("Corporate_HR")) alerts = alerts.concat(runPhase("Corporate_HR", analyzeCorporateHR));
  const dataQualityIssues = detectDataQualityIssues(records);
  return { detectedTypes: types, alerts, errors, dataQualityIssues };
}

// ─── Record extraction (CSV/TSV client-side; Excel/PDF via backend) ──────────
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

const RAW_SCHEMA = {
  type: "object",
  properties: {
    records: { type: "array", items: { type: "object", additionalProperties: true } },
  },
};

export async function extractOperationalRecords(fileUrl, file = null) {
  const ext = (file?.name || fileUrl || "").toLowerCase().split(".").pop() || "";
  // Client-side parse for delimited text formats (no upload required)
  if (file && (ext === "csv" || ext === "tsv" || ext === "txt")) {
    const text = await file.text();
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const delim = ext === "tsv" ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
    return parseDelimited(text, delim);
  }
  // Preserve every operational source column from Excel; a transaction-only
  // extraction schema would drop the fields the fraud rules need.
  if (file && ext === "xlsx") return readXlsxRows(await file.arrayBuffer());
  // Backend extraction for older Excel and PDF files.
  const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: RAW_SCHEMA,
  });
  if (result?.status === "error") throw new Error(result.details || "Extraction failed");
  const out = result?.output;
  if (Array.isArray(out)) return out;
  return out?.records || out?.rows || [];
}

// ─── Persist alerts to FraudAlert entity ────────────────────────────────────
export async function persistFraudAlerts(alerts, user, sourceFile) {
  if (!alerts.length) return 0;
  // Replaying the same source must not reopen a resolved finding or multiply it.
  const existing = sourceFile ? await base44.entities.FraudAlert.filter({ source_file: sourceFile }, '-created_date', 1000) : [];
  const key = (a) => [a.event_id, a.department, a.fraud_vector_analysis?.flagged_rule, a.fraud_vector_analysis?.calculated_metric].map(String).join('|');
  const seen = new Set(existing.map(key));
  const records = alerts.filter((a) => {
    const id = key(a);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((a) => stampTenant({ ...a, status: 'open', source_file: sourceFile || null }, user));
  if (!records.length) return 0;
  const created = await base44.entities.FraudAlert.bulkCreate(records);
  return created?.length || 0;
}