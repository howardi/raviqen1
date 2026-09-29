import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { num: 1, label: "Evidence Review", short: "Evidence" },
  { num: 2, label: "AI Risk Summary", short: "AI Summary" },
  { num: 3, label: "Source Cross-Reference", short: "Cross-Ref" },
  { num: 4, label: "AI Analyst Suite", short: "AI Analyst" },
  { num: 5, label: "Decision & Report", short: "Decision" },
];

export default function WizardProgress({ currentStep, completedSteps = [], onStepClick }) {
  return (
    <div className="bg-white border-b border-slate-200 px-8 py-4">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isComplete = completedSteps.includes(step.num);
          const isCurrent = currentStep === step.num;
          const isClickable = isComplete || step.num <= currentStep;
          return (
            <React.Fragment key={step.num}>
              <button
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step.num)}
                className={cn(
                  "flex items-center gap-2.5 transition-colors",
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0",
                    isCurrent && "bg-slate-900 text-white ring-4 ring-slate-100",
                    isComplete && !isCurrent && "bg-emerald-500 text-white",
                    !isCurrent && !isComplete && "bg-slate-100 text-slate-400"
                  )}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : step.num}
                </div>
                <div className="hidden lg:flex flex-col items-start leading-tight">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isCurrent ? "text-slate-900" : isComplete ? "text-emerald-600" : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                    completedSteps.includes(step.num) ? "bg-emerald-400" : "bg-slate-200"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}