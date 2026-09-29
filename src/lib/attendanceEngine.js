// Attendance Anomaly Engine
// Detects workforce anomalies from attendance records in real time

const STANDARD_START_HOUR = 8; // 8 AM standard shift start
const LATE_THRESHOLD_MINUTES = 15;
const OFF_HOURS_START = 18; // after 6 PM
const OFF_HOURS_END = 6; // before 6 AM
const CHRONIC_LATE_THRESHOLD = 3; // 3+ late days in last 7
const CHRONIC_ABSENT_THRESHOLD = 2; // 2+ absences in last 7

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!parts) {
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  let hours = parseInt(parts[1]);
  const minutes = parseInt(parts[2]);
  const meridiem = parts[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function detectAttendanceAnomalies(records, opts = {}) {
  const anomalies = [];
  const byEmployee = {};

  for (const r of records) {
    if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = [];
    byEmployee[r.employee_id].push(r);
  }

  for (const [empId, empRecords] of Object.entries(byEmployee)) {
    // Sort by date ascending
    empRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const rec of empRecords) {
      const recAnomalies = [];

      // 1. Late arrival
      if (rec.clock_in_time) {
        const inMinutes = parseTimeToMinutes(rec.clock_in_time);
        if (inMinutes !== null) {
          const standardStart = STANDARD_START_HOUR * 60;
          const lateMinutes = inMinutes - standardStart;
          if (lateMinutes > LATE_THRESHOLD_MINUTES && rec.status !== "sick_leave" && rec.status !== "absent") {
            recAnomalies.push({
              type: "late_arrival",
              severity: lateMinutes > 60 ? "high" : "medium",
              description: `Clocked in ${Math.round(lateMinutes)} min late (${rec.clock_in_time})`,
            });
          }
        }
      }

      // 2. Off-hours access
      if (rec.clock_in_time) {
        const inMinutes = parseTimeToMinutes(rec.clock_in_time);
        if (inMinutes !== null) {
          const inHour = Math.floor(inMinutes / 60);
          if (inHour >= OFF_HOURS_START || inHour < OFF_HOURS_END) {
            recAnomalies.push({
              type: "off_hours_access",
              severity: "medium",
              description: `Off-hours facility access at ${rec.clock_in_time}`,
            });
          }
        }
      }

      // 3. Unauthorized overtime
      if (rec.clock_in_time && rec.clock_out_time) {
        const inMin = parseTimeToMinutes(rec.clock_in_time);
        const outMin = parseTimeToMinutes(rec.clock_out_time);
        if (inMin !== null && outMin !== null) {
          let worked = outMin - inMin;
          if (worked < 0) worked += 24 * 60; // overnight
          if (worked > 10 * 60 && rec.status !== "overtime") {
            recAnomalies.push({
              type: "unauthorized_overtime",
              severity: "medium",
              description: `Worked ${(worked / 60).toFixed(1)} hrs without overtime authorization`,
            });
          }
        }
      }

      if (recAnomalies.length > 0) {
        anomalies.push({
          employee_id: empId,
          employee_name: rec.employee_name || empId,
          department: rec.department || "general",
          date: rec.date,
          record_id: rec.id,
          anomalies: recAnomalies,
        });
      }
    }

    // 4. Chronic tardiness — last 7 records
    if (empRecords.length >= 3) {
      const recent = empRecords.slice(-7);
      const lateCount = recent.filter((r) => r.status === "late").length;
      if (lateCount >= CHRONIC_LATE_THRESHOLD) {
        anomalies.push({
          employee_id: empId,
          employee_name: recent[0].employee_name || empId,
          department: recent[0].department || "general",
          date: recent[recent.length - 1].date,
          record_id: recent[recent.length - 1].id,
          anomalies: [{
            type: "chronic_tardiness",
            severity: "high",
            description: `${lateCount} late arrivals in last ${recent.length} shifts`,
          }],
        });
      }

      // 5. Chronic absenteeism
      const absentCount = recent.filter((r) => r.status === "absent").length;
      if (absentCount >= CHRONIC_ABSENT_THRESHOLD) {
        anomalies.push({
          employee_id: empId,
          employee_name: recent[0].employee_name || empId,
          department: recent[0].department || "general",
          date: recent[recent.length - 1].date,
          record_id: recent[recent.length - 1].id,
          anomalies: [{
            type: "chronic_absenteeism",
            severity: "critical",
            description: `${absentCount} unexcused absences in last ${recent.length} shifts`,
          }],
        });
      }
    }
  }

  return anomalies;
}

// Ghost worker detection — payroll entries with no attendance
export function detectGhostWorkers(employees, attendanceRecords) {
  const attendanceEmpIds = new Set(attendanceRecords.map((r) => r.employee_id));
  const ghostWorkers = employees.filter(
    (e) => e.employment_status === "active" && !attendanceEmpIds.has(e.employee_id)
  );
  return ghostWorkers.map((e) => ({
    employee_id: e.employee_id,
    employee_name: e.full_name,
    department: e.department,
    type: "ghost_worker",
    severity: "critical",
    description: `Active employee with no attendance records — possible ghost worker on payroll`,
    evidence: [{ source: "payroll", detail: `Employee ${e.employee_id} on active payroll but no clock-in records found` }],
  }));
}

export function computeAttendanceRate(attendanceRecords, targetDate) {
  if (!attendanceRecords.length) return 0;
  const dayRecords = attendanceRecords.filter((r) => r.date === targetDate);
  if (dayRecords.length === 0) return 0;
  const present = dayRecords.filter((r) => r.status === "present" || r.status === "late" || r.status === "overtime").length;
  return Math.round((present / dayRecords.length) * 100);
}