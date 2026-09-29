// Biometric file parser for raw attendance logs from various hardware devices
// Supports: ZKTeco, Suprema, Hikvision, Anviz, Dahua export formats (.DAT, .TXT, .CSV, .LOG)

const STANDARD_FIELDS = {
  employee_id: ["employee_id", "enroll_id", "user_id", "userid", "emp_id", "id", "staff_id", "pin", "acno", "emp_code"],
  timestamp: ["timestamp", "time", "datetime", "date_time", "punch_time", "check_time", "clock_time", "verify_time"],
  device_id: ["device_id", "terminal_id", "machine_id", "device", "terminal", "machine", "reader_id"],
  punch_state: ["punch_state", "state", "type", "in_out", "io_state", "punch_type", "check_type", "status"],
  verification_type: ["verification_type", "verify_type", "auth_mode", "verify_mode", "verify", "auth_type"],
};

// Detect the most likely delimiter in a text line
function detectDelimiter(text) {
  const firstLine = text.trim().split(/\r?\n/)[0] || "";
  const candidates = [
    { delim: "\t", count: 0 },
    { delim: ",", count: 0 },
    { delim: ";", count: 0 },
    { delim: "|", count: 0 },
    { delim: " ", count: 0 },
  ];
  for (const c of candidates) {
    c.count = firstLine.split(c.delim).length;
  }
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0].count > 1 ? candidates[0].delim : ",";
}

// Check if a line looks like a header
function isHeaderLine(fields, knownFieldNames) {
  const lowerFields = fields.map((f) => f.toLowerCase().trim());
  return lowerFields.some((f) =>
    knownFieldNames.some((k) => f === k || f.includes(k) || k.includes(f))
  );
}

// Auto-map columns to standard fields
export function autoMapColumns(headers) {
  const mapping = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  for (const [standardField, aliases] of Object.entries(STANDARD_FIELDS)) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (aliases.includes(lowerHeaders[i])) {
        mapping[standardField] = i;
        break;
      }
    }
    // Fuzzy match
    if (mapping[standardField] === undefined) {
      for (let i = 0; i < lowerHeaders.length; i++) {
        if (aliases.some((a) => lowerHeaders[i].includes(a) || a.includes(lowerHeaders[i]))) {
          mapping[standardField] = i;
          break;
        }
      }
    }
  }
  return mapping;
}

// Parse a biometric file
export function parseBiometricFile(text, fileName) {
  const delimiter = detectDelimiter(text);
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { records: [], delimiter, headers: [], mapping: {}, hasHeader: false };

  const firstFields = lines[0].split(delimiter).map((f) => f.trim().replace(/^"|"$/g, ""));
  const allKnown = Object.values(STANDARD_FIELDS).flat();
  const hasHeader = isHeaderLine(firstFields, allKnown);

  let headers, dataLines;
  if (hasHeader) {
    headers = firstFields;
    dataLines = lines.slice(1);
  } else {
    headers = firstFields.map((_, i) => `column_${i + 1}`);
    dataLines = lines;
  }

  const mapping = autoMapColumns(headers);

  const records = dataLines
    .map((line, idx) => {
      const values = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
      return {
        row_index: idx + (hasHeader ? 2 : 1),
        employee_id: values[mapping.employee_id] || "",
        timestamp: values[mapping.timestamp] || "",
        device_id: values[mapping.device_id] || "",
        punch_state: values[mapping.punch_state] || "",
        verification_type: values[mapping.verification_type] || "",
        raw: values,
      };
    })
    .filter((r) => r.employee_id);

  return { records, delimiter, headers, mapping, hasHeader };
}

// Parse timestamp from various formats
export function parseTimestamp(ts) {
  if (!ts) return null;
  let d = new Date(ts);
  if (!isNaN(d) && ts.includes("-") && ts.length > 10) return d;

  // DD/MM/YYYY HH:MM:SS
  const m = ts.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[ ]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const day = parseInt(m[1]);
    const month = parseInt(m[2]);
    let year = parseInt(m[3]);
    if (year < 100) year = 2000 + year;
    return new Date(year, month - 1, day, parseInt(m[4]), parseInt(m[5]), m[6] ? parseInt(m[6]) : 0);
  }

  // YYYY-MM-DD HH:MM:SS
  const m2 = ts.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ ]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m2) {
    return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]), parseInt(m2[4]), parseInt(m2[5]), m2[6] ? parseInt(m2[6]) : 0);
  }

  // Date and time as separate columns already merged
  return null;
}

// Group punches by employee and date, producing daily attendance summaries
export function groupPunchesByEmployeeDate(records) {
  const grouped = {};

  for (const r of records) {
    const dt = parseTimestamp(r.timestamp);
    if (!dt || !r.employee_id) continue;
    const dateKey = dt.toISOString().split("T")[0];
    const key = `${r.employee_id}__${dateKey}`;

    if (!grouped[key]) {
      grouped[key] = {
        employee_id: r.employee_id,
        date: dateKey,
        punches: [],
        device_ids: new Set(),
        verification_types: new Set(),
      };
    }
    grouped[key].punches.push({
      time: dt,
      punch_state: r.punch_state,
      device_id: r.device_id,
      verification_type: r.verification_type,
    });
    if (r.device_id) grouped[key].device_ids.add(r.device_id);
    if (r.verification_type) grouped[key].verification_types.add(r.verification_type);
  }

  return Object.values(grouped).map((g) => ({
    ...g,
    device_ids: Array.from(g.device_ids),
    verification_types: Array.from(g.verification_types),
  }));
}

// Determine clock-in and clock-out from a set of punches
export function deriveClockTimes(punches) {
  if (punches.length === 0) return { clock_in: null, clock_out: null, hours: 0 };
  const sorted = [...punches].sort((a, b) => a.time - b.time);

  // Try using punch_state (0=In, 1=Out, 4=OT In, 5=OT Out)
  const ins = sorted.filter((p) => p.punch_state === "0" || p.punch_state === "4" || p.punch_state === "" || p.punch_state === "in" || p.punch_state === "In");
  const outs = sorted.filter((p) => p.punch_state === "1" || p.punch_state === "5" || p.punch_state === "out" || p.punch_state === "Out");

  let clockIn, clockOut;
  if (ins.length > 0 && outs.length > 0) {
    clockIn = ins[0].time;
    clockOut = outs[outs.length - 1].time;
  } else {
    clockIn = sorted[0].time;
    clockOut = sorted[sorted.length - 1].time;
  }

  let hours = (clockOut - clockIn) / (1000 * 60 * 60);
  if (hours < 0) hours += 24; // overnight
  if (hours > 16) hours = 0; // invalid — likely missing punch

  return {
    clock_in: clockIn.toTimeString().substring(0, 5),
    clock_out: clockOut.toTimeString().substring(0, 5),
    hours: Math.max(0, Math.round(hours * 100) / 100),
  };
}

// Detect anomalies in biometric data
export function detectBiometricAnomalies(grouped) {
  const anomalies = [];
  for (const g of grouped) {
    // Duplicate timestamps
    const seen = new Set();
    for (const p of g.punches) {
      const key = p.time.toISOString();
      if (seen.has(key)) {
        anomalies.push({
          type: "duplicate_punch",
          employee_id: g.employee_id,
          date: g.date,
          detail: `Duplicate timestamp: ${key}`,
        });
      }
      seen.add(key);
    }

    // Multi-device rapid punches within 60 seconds
    const sorted = [...g.punches].sort((a, b) => a.time - b.time);
    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i].time - sorted[i - 1].time) / 1000;
      if (diff < 60 && sorted[i].device_id && sorted[i - 1].device_id && sorted[i].device_id !== sorted[i - 1].device_id) {
        anomalies.push({
          type: "multi_device_rapid_punch",
          employee_id: g.employee_id,
          date: g.date,
          detail: `Punches on different devices (${sorted[i - 1].device_id} → ${sorted[i].device_id}) within 60s`,
        });
      }
    }

    // Excessive punches (>6 in a day)
    if (g.punches.length > 6) {
      anomalies.push({
        type: "excessive_punches",
        employee_id: g.employee_id,
        date: g.date,
        detail: `${g.punches.length} punches in one day`,
      });
    }

    // Impossible hours (>16 hours)
    const { hours } = deriveClockTimes(g.punches);
    if (hours > 16) {
      anomalies.push({
        type: "impossible_hours",
        employee_id: g.employee_id,
        date: g.date,
        detail: `Calculated ${hours}h — likely missing punch`,
      });
    }
  }
  return anomalies;
}

// Convert grouped biometric data to AttendanceRecord format
export function biometricToAttendanceRecords(grouped, employees) {
  const empMap = {};
  for (const e of employees) {
    empMap[e.employee_id] = e;
  }

  return grouped.map((g) => {
    const { clock_in, clock_out, hours } = deriveClockTimes(g.punches);
    const emp = empMap[g.employee_id];
    const status = !clock_in ? "absent" : hours > 8 ? "overtime" : clock_in > "09:00" ? "late" : "present";

    return {
      employee_id: g.employee_id,
      employee_name: emp?.full_name || g.employee_id,
      department: emp?.department || "general",
      date: g.date,
      clock_in_time: clock_in || "",
      clock_out_time: clock_out || "",
      status,
      hours_worked: hours,
      source: "biometric_sync",
      anomaly_flags: [],
      batch_id: `BIO-${g.date}`,
    };
  });
}