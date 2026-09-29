import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Upload, FileSpreadsheet, FileJson, FileText, ArrowRight, X } from "lucide-react";

const STORAGE_KEY = "raviqen_dashboard_tour_v1";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to RAVIQEN",
    body: "Your AI risk & compliance workspace is ready. Everything starts with your data — once you ingest your first dataset, RAVIQEN automatically surfaces risk signals, anomalies, and prioritised alerts.",
  },
  {
    icon: Upload,
    title: "Ingest your first dataset",
    body: "Click the Ingest Data button in the top bar to upload a transaction file. We'll scan it, build entity profiles, and generate your risk briefing automatically.",
  },
  {
    icon: FileSpreadsheet,
    title: "Supported file formats",
    body: "CSV, Excel (.xlsx), and JSON files are supported. Include columns like transaction_id, vendor, amount, date, and category for the richest analysis.",
  },
];

// Interactive first-run walkthrough shown on the empty dashboard. Dismissed
// state is persisted in localStorage so it only appears once per browser.
export default function OnboardingTour() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  const finish = (goToIngest) => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
    if (goToIngest) navigate("/ingestion");
  };

  if (dismissed) return null;

  const isLast = step === STEPS.length - 1;
  const Icon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => finish(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-7 pb-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-base font-semibold text-[#231F20]">{STEPS[step].title}</h3>
        </div>

        <div className="px-6 pb-2">
          <p className="text-sm text-slate-500 leading-relaxed text-center">{STEPS[step].body}</p>
          {step === 2 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
                <FileText className="w-3.5 h-3.5" /> CSV
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
                <FileJson className="w-3.5 h-3.5" /> JSON
              </span>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-3">
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => finish(false)}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip tour
            </button>
            {isLast ? (
              <button
                onClick={() => finish(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                Take me to Ingest Data <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}