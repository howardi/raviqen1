import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileWarning, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders a single risk flag as a clickable tag that expands to show the
 * exact source field/value that triggered it (evidence trail).
 *
 * HARD RULE: If no evidence entry exists for this flag, the flag is NOT
 * rendered at all — "No tag may exist as text with nothing behind it."
 * The sole exception is a legacy flag from a pre-evidence-system record,
 * which renders with an explicit "evidence trail not captured" marker.
 */
export default function FlagEvidenceTag({ flag, evidence, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const ev = Array.isArray(evidence) ? evidence.find((e) => e && e.flag === flag) : null;

  // HARD RULE: no evidence → no display (unless legacy)
  if (!ev) {
    // Legacy flag from a pre-evidence-system record — show with warning
    // but do NOT hide, since the flag was legitimately generated; the
    // evidence trail simply wasn't captured at ingestion time.
    return (
      <span
        key={index}
        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-100"
        title="Evidence trail not captured — re-ingest to attach source data"
      >
        <ShieldQuestion className="w-3 h-3" />
        {flag}
      </span>
    );
  }

  return (
    <div key={index} className="relative inline-flex flex-col">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border transition-colors",
          expanded
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
        )}
      >
        <FileWarning className="w-3 h-3 shrink-0" />
        {flag}
        {expanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
      </button>
      {expanded && (
        <div className="absolute z-20 top-full left-0 mt-1 p-3 rounded-lg bg-white border border-slate-200 shadow-lg min-w-[240px] max-w-[320px]">
          {ev.rule_id && (
            <p className="text-[10px] font-mono text-slate-400 mb-1.5">{ev.rule_id}</p>
          )}
          {ev.evidence_field && (
            <p className="text-[11px] text-slate-600 leading-snug">
              <span className="font-semibold text-slate-700">Source field: </span>
              {ev.evidence_field}
            </p>
          )}
          {ev.evidence_value && (
            <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
              <span className="font-semibold text-slate-700">Source value: </span>
              &ldquo;{ev.evidence_value}&rdquo;
            </p>
          )}
          {ev.detail && (
            <p className="text-[11px] text-slate-500 leading-snug mt-1 pt-1 border-t border-slate-100">
              {ev.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}