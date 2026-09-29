// Payroll calculation engine — converts attendance records into payroll with OT, deductions, and anomaly detection

export const DEFAULT_PAYROLL_CONFIG = {
  standard_hours_per_day: 8,
  standard_days_per_month: 22,
  ot_weekday_multiplier: 1.5,
  ot_weekend_multiplier: 2.0,
  late_deduction_tiers: [
    { min_minutes: 1, max_minutes: 15, deduction_hours: 0.25 },
    { min_minutes: 16, max_minutes: 30, deduction_hours: 0.5 },
    { min_minutes: 31, max_minutes: 60, deduction_hours: 1 },
    { min_minutes: 61, max_minutes: 9999, deduction_hours: 2 },
  ],
  standard_start_time: "09:00",
  standard_end_time: "17:00",
  weekend_days: [0, 6], // 0=Sunday, 6=Saturday
};

// Calculate late minutes from clock-in time vs standard start
function getLateMinutes(clockInTime, standardStart) {
  if (!clockInTime) return 0;
  const [ch, cm] = clockInTime.split(":").map(Number);
  const [sh, sm] = standardStart.split(":").map(Number);
  const cMin = ch * 60 + cm;
  const sMin = sh * 60 + sm;
  return Math.max(0, cMin - sMin);
}

// Get late deduction based on tier rules
function getLateDeduction(lateMinutes, tiers) {
  for (const tier of tiers) {
    if (lateMinutes >= tier.min_minutes && lateMinutes <= tier.max_minutes) {
      return tier.deduction_hours;
    }
  }
  return 0;
}

// Calculate hours between clock in and clock out
function calculateHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const [ih, im] = clockIn.split(":").map(Number);
  const [oh, om] = clockOut.split(":").map(Number);
  let h = (oh * 60 + om - ih * 60 - im) / 60;
  if (h < 0) h += 24;
  return Math.max(0, Math.round(h * 100) / 100);
}

// Check if a date falls on a weekend
function isWeekend(dateStr, weekendDays) {
  const day = new Date(dateStr).getDay();
  return weekendDays.includes(day);
}

// Calculate payroll for a single employee
export function calculateEmployeePayroll(employee, attendanceRecords, config = DEFAULT_PAYROLL_CONFIG) {
  const empRecords = attendanceRecords.filter(
    (r) => r.employee_id === employee.employee_id || r.employee_name === employee.full_name
  );

  const stdHoursPerDay = employee.standard_hours_per_day || config.standard_hours_per_day;
  const stdDaysPerMonth = employee.standard_days_per_month || config.standard_days_per_month;
  const baseSalary = employee.base_salary || 0;
  const hourlyRate = employee.hourly_rate || baseSalary / (stdDaysPerMonth * stdHoursPerDay) || 0;
  const dailyRate = baseSalary / stdDaysPerMonth || hourlyRate * stdHoursPerDay;

  let daysWorked = 0;
  let regularHours = 0;
  let overtimeHours = 0;
  let overtimePay = 0;
  let lateCount = 0;
  let lateDeduction = 0;
  let absentDays = 0;
  const dailyBreakdown = [];
  const anomalyFlags = [];

  for (const rec of empRecords) {
    const weekendDay = isWeekend(rec.date, config.weekend_days);
    const hours = rec.hours_worked || calculateHours(rec.clock_in_time, rec.clock_out_time);
    const lateMin = rec.status === "late" ? getLateMinutes(rec.clock_in_time, config.standard_start_time) : 0;

    if (rec.status === "absent") {
      absentDays++;
      dailyBreakdown.push({ date: rec.date, status: "absent", hours: 0, pay: 0 });
      continue;
    }

    daysWorked++;

    const regHrs = Math.min(hours, stdHoursPerDay);
    const otHrs = Math.max(0, hours - stdHoursPerDay);

    regularHours += regHrs;

    // Overtime pay
    if (otHrs > 0) {
      overtimeHours += otHrs;
      const otMult = weekendDay ? config.ot_weekend_multiplier : config.ot_weekday_multiplier;
      overtimePay += otHrs * hourlyRate * otMult;
    }

    // Weekend premium for regular hours worked on weekends
    if (weekendDay && hours > 0) {
      overtimePay += regHrs * hourlyRate * (config.ot_weekend_multiplier - 1);
    }

    // Late deduction
    if (lateMin > 0) {
      lateCount++;
      lateDeduction += getLateDeduction(lateMin, config.late_deduction_tiers) * hourlyRate;
    }

    dailyBreakdown.push({
      date: rec.date,
      status: rec.status,
      clock_in: rec.clock_in_time,
      clock_out: rec.clock_out_time,
      hours,
      regular_hours: regHrs,
      ot_hours: otHrs,
      is_weekend: weekendDay,
      late_minutes: lateMin,
    });
  }

  // Base pay (prorated by days worked)
  const basePay = (daysWorked / stdDaysPerMonth) * baseSalary;
  const absenceDeduction = absentDays * dailyRate;
  const totalDeductions = lateDeduction + absenceDeduction;
  const grossPay = basePay + overtimePay;
  const netPay = grossPay - totalDeductions;

  // Anomaly detection
  if (daysWorked === 0 && employee.employment_status === "active") {
    anomalyFlags.push("ghost_worker_zero_attendance");
  }
  if (overtimeHours > regularHours * 0.3 && regularHours > 0) {
    anomalyFlags.push("excessive_overtime_ratio");
  }
  if (lateCount > daysWorked * 0.5 && daysWorked > 0) {
    anomalyFlags.push("chronic_tardiness");
  }
  if (absentDays > stdDaysPerMonth * 0.3) {
    anomalyFlags.push("excessive_absenteeism");
  }
  // Biometric verification check
  const biometricCount = empRecords.filter((r) => r.source === "biometric_sync").length;
  const manualCount = empRecords.filter((r) => r.source === "manual_entry").length;
  if (manualCount > biometricCount && empRecords.length > 0) {
    anomalyFlags.push("manual_override_dominant");
  }

  // Risk score
  let riskScore = 0;
  if (anomalyFlags.includes("ghost_worker_zero_attendance")) riskScore += 80;
  if (anomalyFlags.includes("excessive_overtime_ratio")) riskScore += 30;
  if (anomalyFlags.includes("chronic_tardiness")) riskScore += 20;
  if (anomalyFlags.includes("excessive_absenteeism")) riskScore += 25;
  if (anomalyFlags.includes("manual_override_dominant")) riskScore += 35;
  riskScore = Math.min(100, riskScore);
  const riskLevel = riskScore >= 70 ? "critical" : riskScore >= 40 ? "high" : riskScore >= 20 ? "medium" : "low";

  return {
    employee_id: employee.employee_id,
    employee_name: employee.full_name,
    department: employee.department,
    base_salary: baseSalary,
    hourly_rate: Math.round(hourlyRate * 100) / 100,
    scheduled_days: stdDaysPerMonth,
    scheduled_hours: stdDaysPerMonth * stdHoursPerDay,
    days_worked: daysWorked,
    hours_worked: Math.round((regularHours + overtimeHours) * 100) / 100,
    regular_hours: Math.round(regularHours * 100) / 100,
    overtime_hours: Math.round(overtimeHours * 100) / 100,
    overtime_pay: Math.round(overtimePay * 100) / 100,
    late_count: lateCount,
    late_deduction: Math.round(lateDeduction * 100) / 100,
    absent_days: absentDays,
    absence_deduction: Math.round(absenceDeduction * 100) / 100,
    gross_pay: Math.round(grossPay * 100) / 100,
    total_deductions: Math.round(totalDeductions * 100) / 100,
    net_pay: Math.round(netPay * 100) / 100,
    attendance_summary: {
      total_records: empRecords.length,
      present: empRecords.filter((r) => r.status === "present").length,
      late: empRecords.filter((r) => r.status === "late").length,
      absent: absentDays,
      overtime: empRecords.filter((r) => r.status === "overtime").length,
      sick_leave: empRecords.filter((r) => r.status === "sick_leave").length,
    },
    daily_breakdown: dailyBreakdown,
    anomaly_flags: anomalyFlags,
    risk_level: riskLevel,
    risk_score: riskScore,
    status: "draft",
    biometric_verification: {
      biometric_verified: biometricCount,
      manual_entry: manualCount,
      csv_upload: empRecords.filter((r) => r.source === "csv_upload").length,
    },
  };
}

// Calculate payroll for all active employees
export function calculatePayroll(employees, attendanceRecords, config = DEFAULT_PAYROLL_CONFIG) {
  return employees
    .filter((e) => e.employment_status === "active" || e.employment_status === "on_leave")
    .map((e) => calculateEmployeePayroll(e, attendanceRecords, config));
}

// Detect department-level payroll variance vs historical averages
export function detectDepartmentVariance(payrollRecords, historicalAverages = {}) {
  const deptTotals = {};
  for (const r of payrollRecords) {
    if (!deptTotals[r.department]) deptTotals[r.department] = 0;
    deptTotals[r.department] += r.net_pay;
  }

  const variances = [];
  for (const [dept, total] of Object.entries(deptTotals)) {
    const avg = historicalAverages[dept] || 0;
    if (avg > 0) {
      const pct = ((total - avg) / avg) * 100;
      if (Math.abs(pct) > 20) {
        variances.push({
          department: dept,
          current_total: Math.round(total * 100) / 100,
          historical_average: avg,
          variance_pct: Math.round(pct),
          direction: pct > 0 ? "spike" : "drop",
        });
      }
    }
  }
  return variances;
}

// Aggregate payroll summary stats
export function getPayrollSummary(payrollRecords) {
  return {
    total_employees: payrollRecords.length,
    total_gross: payrollRecords.reduce((s, r) => s + r.gross_pay, 0),
    total_net: payrollRecords.reduce((s, r) => s + r.net_pay, 0),
    total_overtime: payrollRecords.reduce((s, r) => s + r.overtime_pay, 0),
    total_deductions: payrollRecords.reduce((s, r) => s + r.total_deductions, 0),
    flagged_count: payrollRecords.filter((r) => r.anomaly_flags.length > 0).length,
    ghost_workers: payrollRecords.filter((r) => r.anomaly_flags.includes("ghost_worker_zero_attendance")).length,
  };
}