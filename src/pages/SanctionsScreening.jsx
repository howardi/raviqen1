import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ShieldCheck, ShieldX, ShieldAlert, Ban, ArrowUpCircle, Sparkles } from "lucide-react";
import { screenEntityAgainstSanctions } from "@/lib/advancedAI";
import { cn } from "@/lib/utils";

const matchStatusConfig = {
  confirmed: { label: "Confirmed Match", icon: ShieldX, classes: "bg-red-50 text-red-700 border-red-200" },
  possible: { label: "Possible Match", icon: ShieldAlert, classes: "bg-amber-50 text-amber-700 border-amber-200" },
  cleared: { label: "Cleared", icon: ShieldCheck, classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Pending Review", icon: ShieldAlert, classes: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function SanctionsScreening() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [screening, setScreening] = useState(null);
  const [screenResult, setScreenResult] = useState(null);

  useEffect(() => {
    base44.entities.Transaction.list("-created_date", 50)
      .then((data) => {
        setRecords((data || []).map((t) => ({
          ...t,
          match_status: t.risk_level === "critical" ? "confirmed" : t.risk_level === "high" ? "possible" : t.status === "clean" ? "cleared" : "pending",
          confidence: t.risk_score || 0,
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAction = async (tx, action) => {
    const updates = action === "dismiss" ? { status: "clean", risk_level: "low" } : { status: "quarantined", risk_level: "critical" };
    try {
      await base44.entities.Transaction.update(tx.id, updates);
      setRecords((prev) => prev.map((r) => (r.id === tx.id ? { ...r, ...updates, match_status: action === "dismiss" ? "cleared" : "confirmed" } : r)));
      toast({ title: action === "dismiss" ? "Match dismissed" : "Escalated", description: `${tx.vendor} has been ${action === "dismiss" ? "cleared" : "escalated"}.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAIScreen = async (tx) => {
    setScreening(tx.id);
    setScreenResult(null);
    try {
      const result = await screenEntityAgainstSanctions(tx);
      setScreenResult({ id: tx.id, ...result });
      toast({ title: "AI Screening Complete", description: `${tx.vendor}: ${result.match_status} (${result.confidence}% confidence)` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setScreening(null);
  };

  const filtered = records.filter((r) => !search || `${r.vendor} ${r.transaction_id}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Sanctions Screening</h1>
        <p className="text-xs text-slate-500">AI-powered entity screening with match confidence scoring</p>
      </header>

      <div className="p-4 md:p-8">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by vendor or transaction ID..." className="w-full md:w-96 mb-4 px-4 py-2 text-sm rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Vendor / Entity</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Transaction ID</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Match Status</th>
                    <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Confidence</th>
                    <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => {
                    const cfg = matchStatusConfig[r.match_status] || matchStatusConfig.pending;
                    const Icon = cfg.icon;
                    const aiResult = screenResult?.id === r.id ? screenResult : null;
                    return (
                      <React.Fragment key={r.id}>
                        <tr className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-sm font-medium text-[#231F20]">{r.vendor}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">{r.transaction_id}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", cfg.classes)}>
                              <Icon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className={cn("h-full rounded-full", r.confidence > 80 ? "bg-red-500" : r.confidence > 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${r.confidence}%` }} />
                              </div>
                              <span className="text-xs font-semibold text-slate-600">{r.confidence}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => handleAIScreen(r)} disabled={screening === r.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors">
                                {screening === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI Screen
                              </button>
                              <button onClick={() => handleAction(r, "dismiss")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                                <Ban className="w-3 h-3" /> Dismiss
                              </button>
                              <button onClick={() => handleAction(r, "escalate")} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors">
                                <ArrowUpCircle className="w-3 h-3" /> Escalate
                              </button>
                            </div>
                          </td>
                        </tr>
                        {aiResult && (
                          <tr className="bg-indigo-50/40">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span className="text-xs font-bold text-indigo-900">AI Screening Result</span>
                                  <span className="text-xs text-slate-600">— {aiResult.match_status} ({aiResult.confidence}% confidence)</span>
                                  {aiResult.matched_list && <span className="text-xs font-mono text-red-600">List: {aiResult.matched_list}</span>}
                                </div>
                                {aiResult.risk_factors?.length > 0 && (
                                  <p className="text-xs text-slate-600"><span className="font-medium">Risk factors:</span> {aiResult.risk_factors.join(", ")}</p>
                                )}
                                {aiResult.recommended_action && <p className="text-xs text-indigo-700"><span className="font-medium">Recommended:</span> {aiResult.recommended_action}</p>}
                                {aiResult.screening_notes && <p className="text-xs text-slate-500 italic">{aiResult.screening_notes}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-12">No records found</p>}
          </div>
        )}
      </div>
    </div>
  );
}