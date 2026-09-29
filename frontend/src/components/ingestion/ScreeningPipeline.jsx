import React from "react";
import { cn } from "@/lib/utils";
import { FileSearch, ShieldCheck, Radar, AlertTriangle, Gauge, ClipboardCheck, Loader2, Check } from "lucide-react";

const STEPS = [
  { key: "extract", label: "Extract & Normalize", icon: FileSearch, desc: "OCR / NER field mapping" },
  { key: "verify", label: "Vendor & Entity Verification", icon: ShieldCheck, desc: "Registry cross-reference" },
  { key: "screen", label: "Sanctions & PEP Screening", icon: Radar, desc: "Watchlist checks" },
  { key: "osint", label: "OSINT Adverse Media", icon: AlertTriangle, desc: "Public intelligence scan" },
  { key: "score", label: "Composite Risk Scoring", icon: Gauge, desc: "0–100 score computation" },
  { key: "decide", label: "Next-Step Decisioning", icon: ClipboardCheck, desc: "Actionable recommendations" },
];

export default function ScreeningPipeline({ activeStep, completed }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-[#231F20] mb-4">Screening Pipeline</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STEPS.map((step, idx) => {
          const isDone = completed.includes(step.key);
          const isActive = activeStep === step.key;
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className={cn(
                "rounded-lg border p-3 transition-all",
                isDone ? "border-emerald-200 bg-emerald-50/60" : isActive ? "border-slate-400 bg-slate-50" : "border-slate-100 bg-slate-50/40"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", isDone ? "bg-emerald-500 text-white" : isActive ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-400")}>
                  {isDone ? <Check className="w-4 h-4" /> : isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-mono text-slate-400">{String(idx + 1).padStart(2, "0")}</span>
              </div>
              <p className={cn("text-xs font-semibold leading-tight", isDone || isActive ? "text-slate-800" : "text-slate-400")}>{step.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}