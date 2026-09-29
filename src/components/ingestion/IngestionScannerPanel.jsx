import React from "react";
import {
  Radar, Building2, History, AlertTriangle, FileSearch, Sparkles,
  CheckCircle2, Loader2, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "trigger", label: "Global Trigger", icon: Radar, desc: "Ingestion detected" },
  { key: "entity", label: "Entity Resolution", icon: Building2, desc: "Profile matching" },
  { key: "history", label: "Historical Comparison", icon: History, desc: "Baseline deviation" },
  { key: "alert", label: "Auto-Alert", icon: AlertTriangle, desc: "Risk scoring" },
  { key: "case", label: "Case Building", icon: FileSearch, desc: "Investigation opened" },
  { key: "briefing", label: "AI Briefing", icon: Sparkles, desc: "Executive narrative" },
];

export default function IngestionScannerPanel({ scanning, scanStep, scanResult, progress }) {
  const activeIndex = scanning ? scanStep : -1;
  const done = !scanning && scanResult;
  const allInvalid = done && scanResult.invalid === scanResult.total;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            scanning ? "bg-slate-900" : allInvalid ? "bg-red-50" : done ? "bg-emerald-50" : "bg-slate-100"
          )}>
            <ShieldCheck className={cn(
              "w-4 h-4",
              scanning ? "text-white" : allInvalid ? "text-red-600" : done ? "text-emerald-600" : "text-slate-400"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#231F20]">Autonomous Scanner</h3>
            <p className="text-[11px] text-slate-400">
              {scanning ? progress ? `Processing record ${progress.done} of ${progress.total}` : "Extracting source records…" : done ? scanResult.invalid === scanResult.total ? "Validation failed — review the batch details" : "Scan complete" : "Ready — activates on upload"}
            </p>
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium",
          scanning ? "bg-blue-50 text-blue-700" : allInvalid ? "bg-red-50 text-red-700" : done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            scanning ? "bg-blue-500 animate-pulse" : allInvalid ? "bg-red-500" : done ? "bg-emerald-500" : "bg-slate-400"
          )} />
          {scanning ? "SCANNING" : done ? scanResult.invalid === scanResult.total ? "REVIEW REQUIRED" : "COMPLETE" : "STANDBY"}
        </span>
      </div>

      {/* Pipeline steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeIndex;
          const isPassed = scanning && i < activeIndex;
          const isAllDone = done && !allInvalid;
          return (
            <React.Fragment key={step.key}>
              <div className={cn(
                "flex flex-col items-center gap-1 min-w-[80px] shrink-0",
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isActive ? "bg-slate-900 text-white" :
                  isPassed || isAllDone ? "bg-emerald-50 text-emerald-600" :
                  "bg-slate-50 text-slate-300"
                )}>
                  {isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPassed || isAllDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium text-center leading-tight",
                  isActive ? "text-slate-900" : isPassed || isAllDone ? "text-emerald-600" : "text-slate-400"
                )}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "h-px flex-1 min-w-[8px] transition-colors",
                  isPassed || isAllDone ? "bg-emerald-200" : "bg-slate-200"
                )} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Results summary */}
      {done && scanResult && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Clean", value: scanResult.clean, color: "text-emerald-600" },
            { label: "Flagged", value: scanResult.flagged, color: "text-amber-600" },
            { label: "Alerts", value: scanResult.alerts, color: "text-orange-600" },
            { label: "Cases", value: scanResult.casesOpened, color: "text-violet-600" },
          ].map((r) => (
            <div key={r.label} className="text-center p-2 rounded-lg bg-slate-50/60">
              <p className={cn("text-lg font-bold tabular-nums", r.color)}>{r.value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{r.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}