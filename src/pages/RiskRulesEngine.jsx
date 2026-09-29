import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Save, Zap, Loader2, Sparkles, FlaskConical, X, Leaf } from "lucide-react";
import { suggestRiskRules } from "@/lib/advancedAI";
import { detectAnomalies } from "@/lib/dashboardAI";
import { cn } from "@/lib/utils";
import SustainabilityModule from "@/components/sustainability/SustainabilityModule";
import { useAuth } from "@/lib/AuthContext";
import { stampTenant } from "@/lib/tenantScope";

const fieldOptions = ["amount", "currency", "vendor", "transaction_date", "category", "location", "payment_method", "risk_score"];
const opOptions = [">", "<", ">=", "<=", "==", "!=", "contains", "weekend", "is_new"];
const actionOptions = ["Flag as High Risk", "Quarantine for Review", "Create Alert", "Auto-Escalate", "Send Notification"];

export default function RiskRulesEngine() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState("rules");

  const loadRules = async () => {
    try {
      const data = await base44.entities.RiskRule.list("-created_date", 50);
      setRules(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadRules(); }, []);

  const updateRule = (id, updates) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const toggleRule = async (id) => {
    const rule = rules.find((r) => r.id === id);
    const newVal = !rule.enabled;
    updateRule(id, { enabled: newVal });
    try { await base44.entities.RiskRule.update(id, { enabled: newVal }); } catch (e) { console.error(e); }
  };

  const deleteRule = async (id) => {
    try {
      await base44.entities.RiskRule.delete(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Rule deleted" });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const addRule = async () => {
    try {
      const newRule = await base44.entities.RiskRule.create(stampTenant({
        name: "New Custom Rule",
        enabled: true,
        conditions: [{ field: "amount", op: ">", value: "0" }],
        action: "Create Alert",
        priority: "medium",
        triggered_count: 0,
      }, user));
      setRules((prev) => [newRule, ...prev]);
      toast({ title: "Rule created", description: "Configure conditions below." });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const saveRule = async (id) => {
    const rule = rules.find((r) => r.id === id);
    try {
      await base44.entities.RiskRule.update(id, {
        name: rule.name, conditions: rule.conditions, action: rule.action, priority: rule.priority, enabled: rule.enabled,
      });
      toast({ title: "Rule saved", description: "Risk rule is now active." });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const addCondition = (id) => {
    const rule = rules.find((r) => r.id === id);
    updateRule(id, { conditions: [...(rule.conditions || []), { field: "amount", op: ">", value: "" }] });
  };

  const removeCondition = (id, idx) => {
    const rule = rules.find((r) => r.id === id);
    updateRule(id, { conditions: rule.conditions.filter((_, i) => i !== idx) });
  };

  const updateCondition = (id, idx, field, value) => {
    const rule = rules.find((r) => r.id === id);
    const conds = [...(rule.conditions || [])];
    conds[idx] = { ...conds[idx], [field]: value };
    updateRule(id, { conditions: conds });
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 100);
      const anomalies = detectAnomalies(transactions);
      const result = await suggestRiskRules(anomalies, transactions);
      const newRules = await Promise.all((result.rules || []).map((r) =>
        base44.entities.RiskRule.create(stampTenant({
          name: r.name, enabled: true, conditions: r.conditions || [],
          action: r.action || "Create Alert", priority: r.priority || "medium", triggered_count: 0,
        }, user))
      ));
      setRules((prev) => [...newRules, ...prev]);
      toast({ title: "Rules suggested", description: `AI suggested ${newRules.length} new rules based on anomaly patterns.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 100);
      const enabledRules = rules.filter((r) => r.enabled);
      const results = enabledRules.map((rule) => {
        let count = 0;
        transactions.forEach((tx) => {
          const matched = (rule.conditions || []).every((c) => {
            const val = tx[c.field];
            const target = c.value;
            if (c.op === ">") return Number(val) > Number(target);
            if (c.op === "<") return Number(val) < Number(target);
            if (c.op === ">=") return Number(val) >= Number(target);
            if (c.op === "<=") return Number(val) <= Number(target);
            if (c.op === "==") return String(val) === String(target);
            if (c.op === "!=") return String(val) !== String(target);
            if (c.op === "contains") return String(val || "").toLowerCase().includes(String(target).toLowerCase());
            if (c.op === "weekend") { const d = new Date(tx.transaction_date || tx.created_date); return d.getDay() === 0 || d.getDay() === 6; }
            if (c.op === "is_new") return true;
            return false;
          });
          if (matched) count++;
        });
        return { name: rule.name, triggered: count, total: transactions.length };
      });
      setTestResults(results);
      toast({ title: "Test complete", description: `Ran ${enabledRules.length} rules against ${transactions.length} transactions.` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Risk Rules Engine</h1>
            <p className="text-xs text-slate-500">Custom IF/THEN rules for automated alert triggers</p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
            <button onClick={() => setActiveTab("rules")} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", activeTab === "rules" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Zap className="w-3.5 h-3.5 inline mr-1" /> Risk Rules
            </button>
            <button onClick={() => setActiveTab("sustainability")} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors", activeTab === "sustainability" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Leaf className="w-3.5 h-3.5 inline mr-1" /> Sustainability
            </button>
          </div>
        </div>
      </header>

      {activeTab === "sustainability" ? (
        <div className="p-4 md:p-8">
          <SustainabilityModule />
        </div>
      ) : (
      <>
      <div className="flex items-center justify-end gap-2 flex-wrap px-4 md:px-8 pt-4">
        <button onClick={handleSuggest} disabled={suggesting} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors">
          {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">AI Suggest</span>
        </button>
        <button onClick={handleTest} disabled={testing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Test Rules</span>
        </button>
        <button onClick={addRule} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
          <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New Rule</span>
        </button>
      </div>

      {testResults && (
        <div className="mx-4 md:mx-8 mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-indigo-900">Test Results</span>
            <button onClick={() => setTestResults(null)} className="p-1 rounded hover:bg-indigo-100"><X className="w-3.5 h-3.5 text-indigo-600" /></button>
          </div>
          <div className="space-y-1.5">
            {testResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">{r.name}</span>
                <span className={cn("px-2 py-0.5 rounded-full font-semibold", r.triggered > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
                  {r.triggered} matches / {r.total} transactions
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 md:p-8 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20">
            <Zap className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No rules yet. Click "AI Suggest" to auto-generate rules from anomaly patterns.</p>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", rule.enabled ? "bg-amber-50" : "bg-slate-100")}>
                    <Zap className={cn("w-4 h-4", rule.enabled ? "text-amber-600" : "text-slate-400")} />
                  </div>
                  <div className="min-w-0">
                    <input value={rule.name} onChange={(e) => updateRule(rule.id, { name: e.target.value })} className="text-sm font-semibold text-[#231F20] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 outline-none max-w-full" />
                    <p className="text-xs text-slate-400">{(rule.conditions || []).length} condition(s) · Priority: <span className="font-medium capitalize">{rule.priority}</span> · Triggered: {rule.triggered_count || 0}x</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => toggleRule(rule.id)} className={cn("relative w-10 h-5 rounded-full transition-colors", rule.enabled ? "bg-emerald-500" : "bg-slate-200")}>
                    <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform", rule.enabled && "translate-x-5")} />
                  </button>
                  <select value={rule.priority} onChange={(e) => updateRule(rule.id, { priority: e.target.value })} className="text-xs px-2 py-1 rounded-lg border border-slate-200 outline-none bg-white">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                  <button onClick={() => saveRule(rule.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                    <Save className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => deleteRule(rule.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50/60 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IF</p>
                  <button onClick={() => addCondition(rule.id)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">+ Add condition</button>
                </div>
                {(rule.conditions || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    {i > 0 && <span className="text-xs font-bold text-slate-500">AND</span>}
                    <select value={c.field} onChange={(e) => updateCondition(rule.id, i, "field", e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none">
                      {fieldOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={c.op} onChange={(e) => updateCondition(rule.id, i, "op", e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none">
                      {opOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={c.value} onChange={(e) => updateCondition(rule.id, i, "value", e.target.value)} placeholder="value" className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none w-24" />
                    {(rule.conditions || []).length > 1 && (
                      <button onClick={() => removeCondition(rule.id, i)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">THEN</p>
                  <select value={rule.action} onChange={(e) => updateRule(rule.id, { action: e.target.value })} className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white outline-none">
                    {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}