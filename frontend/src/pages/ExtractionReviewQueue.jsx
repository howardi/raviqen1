import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import BackToTop from "@/components/BackToTop";
import { ScanSearch, Loader2, ShieldCheck, AlertTriangle, FileSearch, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const CONFIDENCE_THRESHOLD = 0.7; // fields below this route to human review

function confidenceTone(c) {
  if (c >= 0.85) return { bar: "bg-emerald-500", text: "text-emerald-700", label: "High" };
  if (c >= CONFIDENCE_THRESHOLD) return { bar: "bg-amber-500", text: "text-amber-700", label: "Medium" };
  return { bar: "bg-red-500", text: "text-red-700", label: "Low" };
}

export default function ExtractionReviewQueue() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [resolving, setResolving] = useState(null);
  const [form, setForm] = useState({ corrected_value: "", review_notes: "", status: "resolved" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ExtractionReview.list("-created_date", 200);
      setReviews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    pending: reviews.filter((r) => r.status === "pending").length,
    reviewed: reviews.filter((r) => r.status === "reviewed" || r.status === "resolved").length,
    rejected: reviews.filter((r) => r.status === "rejected").length,
    all: reviews.length,
  };

  const filtered = reviews
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .sort((a, b) => (a.confidence_score || 0) - (b.confidence_score || 0));

  const startResolve = (r) => {
    setResolving(r.id);
    setForm({ corrected_value: r.extracted_value || "", review_notes: "", status: "resolved" });
  };

  const submitResolve = async () => {
    const r = reviews.find((x) => x.id === resolving);
    if (!r) return;
    setSaving(true);
    try {
      await base44.entities.ExtractionReview.update(r.id, {
        status: form.status,
        corrected_value: form.corrected_value,
        review_notes: form.review_notes,
        reviewer: user?.full_name || user?.email || "admin",
      });
      await logActivity(user, "extraction_review", `Reviewed field "${r.field_name}" on ${r.document_id}: ${form.status}`, "ExtractionReview", r.id);
      setResolving(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
          <ScanSearch className="w-5 h-5 text-slate-700" />
          Extraction Review Queue
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Fields extracted below {Math.round(CONFIDENCE_THRESHOLD * 100)}% confidence route here for human verification — never auto-populated as certain.
        </p>
      </header>

      <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Pending Review" value={counts.pending} icon={Inbox} tone="bg-red-50 text-red-700" />
          <Stat label="Resolved" value={counts.reviewed} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
          <Stat label="Rejected" value={counts.rejected} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" />
          <Stat label="Total Fields" value={counts.all} icon={FileSearch} tone="bg-slate-100 text-slate-700" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: "pending", label: "Pending" },
            { key: "resolved", label: "Resolved" },
            { key: "rejected", label: "Rejected" },
            { key: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {f.label} <span className="ml-1.5 text-[10px] opacity-70">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">No fields awaiting review</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Every extracted field is above the confidence threshold or already resolved. Low-confidence fields from new ingests will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((r) => {
              const tone = confidenceTone(r.confidence_score || 0);
              const isResolving = resolving === r.id;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{r.field_name}</span>
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 border border-slate-200", tone.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", tone.bar)} />
                          {tone.label} confidence · {Math.round((r.confidence_score || 0) * 100)}%
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{r.document_id}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        <Detail label="Extracted value" value={r.extracted_value || "—"} mono />
                        <Detail label="Source location" value={r.source_location || "—"} mono />
                        <Detail label="Source file" value={r.source_filename || "—"} />
                        <Detail label="Linked transaction" value={r.linked_transaction_id || "—"} mono />
                      </div>
                    </div>
                    {r.status === "pending" && !isResolving && (
                      <button onClick={() => startResolve(r)} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
                        Review
                      </button>
                    )}
                    {r.status !== "pending" && (
                      <span className={cn("shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border",
                        r.status === "resolved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                        {r.status === "resolved" ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {r.status}
                      </span>
                    )}
                  </div>

                  {r.status !== "pending" && r.reviewer && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                      Reviewed by {r.reviewer}
                      {r.corrected_value ? ` · corrected to "${r.corrected_value}"` : ""}
                      {r.review_notes ? ` · ${r.review_notes}` : ""}
                    </div>
                  )}

                  {isResolving && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500">Corrected value</label>
                        <input
                          value={form.corrected_value}
                          onChange={(e) => setForm((p) => ({ ...p, corrected_value: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500">Reviewer notes</label>
                        <textarea
                          value={form.review_notes}
                          onChange={(e) => setForm((p) => ({ ...p, review_notes: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={form.status}
                          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium"
                        >
                          <option value="resolved">Resolve (accept corrected)</option>
                          <option value="rejected">Reject (field invalid)</option>
                        </select>
                        <button onClick={submitResolve} disabled={saving} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
                          {saving ? "Saving…" : "Submit review"}
                        </button>
                        <button onClick={() => setResolving(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BackToTop />
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", tone)}><Icon className="w-3.5 h-3.5" /></div>
        <span className="text-xl font-bold text-[#231F20] tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">{label}</p>
    </div>
  );
}

function Detail({ label, value, mono }) {
  return (
    <div>
      <span className="text-slate-400">{label}: </span>
      <span className={cn("text-slate-700", mono && "font-mono")}>{value}</span>
    </div>
  );
}