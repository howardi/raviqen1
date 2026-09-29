import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPT_LABELS = {
  restaurant: "Restaurant / F&B", operations: "Operations", front_desk: "Front Desk",
  hr: "Human Resources", finance: "Finance", general: "General",
};

const DEPT_ABBR = {
  restaurant: "F&B", operations: "Ops", front_desk: "Front Desk",
  hr: "HR", finance: "Finance", general: "General",
};

const DEPT_COLORS = {
  restaurant: { chip: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  operations: { chip: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  front_desk: { chip: "bg-cyan-100 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
  hr: { chip: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  finance: { chip: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  general: { chip: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ReportCalendar({ reports = [], onSelectDate, selectedDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const reportsByDate = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const dateKey = r.report_date;
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(r);
    });
    return map;
  }, [reports]);

  // Build per-date department summary
  const deptSummaryByDate = useMemo(() => {
    const map = {};
    Object.entries(reportsByDate).forEach(([date, dayReports]) => {
      const deptMap = {};
      dayReports.forEach((r) => {
        const d = r.department || "general";
        if (!deptMap[d]) deptMap[d] = { count: 0, reports: [] };
        deptMap[d].count++;
        deptMap[d].reports.push(r);
      });
      map[date] = { departments: deptMap, total: dayReports.length };
    });
    return map;
  }, [reportsByDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const formatDateKey = (day) => `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isToday = (day) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  const isSelected = (day) => selectedDate === formatDateKey(day);

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-slate-600" />
          <h3 className="text-sm font-semibold text-[#231F20]">{monthName}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
          <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">Today</button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="aspect-square" />;
          const dateKey = formatDateKey(day);
          const summary = deptSummaryByDate[dateKey];
          const hasReports = summary && summary.total > 0;
          const deptEntries = summary ? Object.entries(summary.departments) : [];
          return (
            <button
              key={day}
              onClick={() => onSelectDate?.(dateKey, reportsByDate[dateKey] || [])}
              className={cn(
                "min-h-[64px] rounded-lg border text-left p-1.5 flex flex-col gap-0.5 transition-colors relative",
                hasReports ? "border-slate-200 bg-slate-50/60 hover:bg-slate-100 cursor-pointer" : "border-slate-100",
                isToday(day) && "ring-2 ring-slate-900 ring-offset-0",
                isSelected(day) && "border-slate-900 bg-slate-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-medium", isToday(day) ? "text-slate-900" : hasReports ? "text-slate-700" : "text-slate-400")}>{day}</span>
                {hasReports && (
                  <span className="text-[9px] font-semibold text-slate-500 bg-white px-1 rounded-full border border-slate-200">{summary.total}</span>
                )}
              </div>
              {hasReports && (
                <div className="flex flex-wrap gap-0.5 mt-auto">
                  {deptEntries.slice(0, 3).map(([dept, info]) => {
                    const c = DEPT_COLORS[dept] || DEPT_COLORS.general;
                    return (
                      <span
                        key={dept}
                        className={cn("inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-semibold border leading-none", c.chip)}
                        title={`${DEPT_LABELS[dept] || dept}: ${info.count} report(s)`}
                      >
                        {DEPT_ABBR[dept] || dept}
                      </span>
                    );
                  })}
                  {deptEntries.length > 3 && <span className="text-[8px] text-slate-400 font-medium self-center">+{deptEntries.length - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Department legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
          <Users className="w-3 h-3" /> Departments:
        </span>
        {Object.entries(DEPT_COLORS).map(([dept, c]) => (
          <span key={dept} className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <span className={cn("w-2 h-2 rounded-full", c.dot)} /> {DEPT_LABELS[dept]}
          </span>
        ))}
      </div>
    </div>
  );
}