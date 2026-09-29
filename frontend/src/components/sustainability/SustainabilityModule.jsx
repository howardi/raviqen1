import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { calculateSustainabilityScore } from "@/lib/sustainabilityScoring";
import {
  Leaf, Plus, Trash2, Loader2, AlertTriangle, TrendingDown, TrendingUp,
  Factory, Users, ShieldCheck, X, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stampTenant } from "@/lib/tenantScope";

const GRADE_COLORS = {
  A: "bg-emerald-100 text-emerald-700 border-emerald-200",
  B: "bg-lime-100 text-lime-700 border-lime-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-orange-100 text-orange-700 border-orange-200",
  F: "bg-red-100 text-red-700 border-red-200",
};

const CHILD_RISK_OPTIONS = ["none", "low", "moderate", "high", "severe"];
const COMPLIANCE_OPTIONS = ["compliant", "partial", "non_compliant", "unknown"];

export default function SustainabilityModule() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supply_chain_region: "",
    industry_sector: "",
    carbon_footprint_tons: 0,
    energy_source_renewable_pct: 0,
    water_usage_liters: 0,
    waste_generated_tons: 0,
    waste_recycled_pct: 0,
    fair_labor_score: 50,
    child_labor_risk: "none",
    wage_compliance: "unknown",
    working_hours_compliance: "unknown",
    safety_score: 50,
    assessment_date: new Date().toISOString().split("T")[0],
    status: "pending",
  });

  const loadAssessments = useCallback(async () => {
    try {
      const data = await base44.entities.SustainabilityAssessment.list("-created_date", 50);
      setAssessments(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  const handleSave = async () => {
    if (!formData.supplier_name) {
      toast({ title: "Missing field", description: "Supplier name is required", variant: "destructive" });
      return;
    }
    try {
      const scores = calculateSustainabilityScore(formData);
      const payload = {
        ...formData,
        carbon_footprint_tons: Number(formData.carbon_footprint_tons) || 0,
        energy_source_renewable_pct: Number(formData.energy_source_renewable_pct) || 0,
        water_usage_liters: Number(formData.water_usage_liters) || 0,
        waste_generated_tons: Number(formData.waste_generated_tons) || 0,
        waste_recycled_pct: Number(formData.waste_recycled_pct) || 0,
        fair_labor_score: Number(formData.fair_labor_score) || 0,
        safety_score: Number(formData.safety_score) || 0,
        environmental_impact_score: scores.environmental_impact_score,
        overall_sustainability_score: scores.overall_sustainability_score,
        sustainability_grade: scores.sustainability_grade,
        flag_reasons: scores.flag_reasons,
        assessed_by: user?.full_name || user?.email || "System",
        status: scores.flag_reasons.length > 0 ? "flagged" : "completed",
      };

      if (editingId) {
        await base44.entities.SustainabilityAssessment.update(editingId, payload);
        setAssessments((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...payload } : a)));
        toast({ title: "Assessment updated", description: `Grade: ${scores.sustainability_grade} · Score: ${scores.overall_sustainability_score}/100` });
      } else {
        const created = await base44.entities.SustainabilityAssessment.create(stampTenant(payload, user));
        setAssessments((prev) => [created, ...prev]);
        toast({ title: "Assessment created", description: `Grade: ${scores.sustainability_grade} · Score: ${scores.overall_sustainability_score}/100` });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ supplier_name: "", supply_chain_region: "", industry_sector: "", carbon_footprint_tons: 0, energy_source_renewable_pct: 0, water_usage_liters: 0, waste_generated_tons: 0, waste_recycled_pct: 0, fair_labor_score: 50, child_labor_risk: "none", wage_compliance: "unknown", working_hours_compliance: "unknown", safety_score: 50, assessment_date: new Date().toISOString().split("T")[0], status: "pending" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      supplier_name: item.supplier_name || "",
      supply_chain_region: item.supply_chain_region || "",
      industry_sector: item.industry_sector || "",
      carbon_footprint_tons: item.carbon_footprint_tons || 0,
      energy_source_renewable_pct: item.energy_source_renewable_pct || 0,
      water_usage_liters: item.water_usage_liters || 0,
      waste_generated_tons: item.waste_generated_tons || 0,
      waste_recycled_pct: item.waste_recycled_pct || 0,
      fair_labor_score: item.fair_labor_score || 0,
      child_labor_risk: item.child_labor_risk || "none",
      wage_compliance: item.wage_compliance || "unknown",
      working_hours_compliance: item.working_hours_compliance || "unknown",
      safety_score: item.safety_score || 0,
      assessment_date: item.assessment_date || new Date().toISOString().split("T")[0],
      status: item.status || "pending",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.SustainabilityAssessment.delete(id);
      setAssessments((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Assessment deleted" });
    } catch (e) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  // Live score preview
  const previewScore = calculateSustainabilityScore(formData);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#231F20]">Supply Chain Sustainability Module</h2>
              <p className="text-xs text-slate-600">Carbon footprint · Environmental impact · Fair labor compliance across global supply chains</p>
            </div>
          </div>
          <button
            onClick={() => { setEditingId(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Assessment
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <Factory className="w-4 h-4 text-slate-400 mb-1" />
          <p className="text-2xl font-bold text-[#231F20]">{assessments.length}</p>
          <p className="text-xs text-slate-500">Suppliers Assessed</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 mb-1" />
          <p className="text-2xl font-bold text-red-600">{assessments.filter((a) => a.status === "flagged").length}</p>
          <p className="text-xs text-slate-500">Flagged Suppliers</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <TrendingDown className="w-4 h-4 text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-amber-600">
            {assessments.length > 0 ? Math.round(assessments.reduce((s, a) => s + (a.carbon_footprint_tons || 0), 0)).toLocaleString() : 0}
          </p>
          <p className="text-xs text-slate-500">Total Carbon (tons CO₂e)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-emerald-600">
            {assessments.length > 0 ? Math.round(assessments.reduce((s, a) => s + (a.overall_sustainability_score || 0), 0) / assessments.length) : 0}
          </p>
          <p className="text-xs text-slate-500">Avg Sustainability Score</p>
        </div>
      </div>

      {/* Assessments list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Leaf className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No sustainability assessments yet.</p>
          <p className="text-xs text-slate-400 mt-1">Click "New Assessment" to evaluate a supplier's environmental and labor compliance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg shrink-0 border", GRADE_COLORS[a.sustainability_grade] || GRADE_COLORS.F)}>
                    {a.sustainability_grade || "F"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#231F20] truncate">{a.supplier_name}</p>
                    <p className="text-xs text-slate-400">
                      {a.supply_chain_region || "—"} · {a.industry_sector || "—"} · Assessed {a.assessment_date ? new Date(a.assessment_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-1 rounded-full font-medium", a.status === "flagged" ? "bg-red-100 text-red-700" : a.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {a.status}
                  </span>
                  <button onClick={() => handleEdit(a)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Leaf className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-medium text-slate-400">SUSTAINABILITY</span>
                  </div>
                  <p className="text-lg font-bold text-[#231F20]">{a.overall_sustainability_score || 0}<span className="text-xs text-slate-400">/100</span></p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Factory className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-medium text-slate-400">ENVIRONMENTAL</span>
                  </div>
                  <p className="text-lg font-bold text-[#231F20]">{a.environmental_impact_score || 0}<span className="text-xs text-slate-400">/100</span></p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3 text-violet-500" />
                    <span className="text-[10px] font-medium text-slate-400">FAIR LABOR</span>
                  </div>
                  <p className="text-lg font-bold text-[#231F20]">{a.fair_labor_score || 0}<span className="text-xs text-slate-400">/100</span></p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <ShieldCheck className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-slate-400">SAFETY</span>
                  </div>
                  <p className="text-lg font-bold text-[#231F20]">{a.safety_score || 0}<span className="text-xs text-slate-400">/100</span></p>
                </div>
              </div>

              {/* Key metrics */}
              <div className="flex items-center gap-4 flex-wrap mt-3 text-xs">
                <span className="text-slate-500">Carbon: <span className="font-semibold text-slate-700">{(a.carbon_footprint_tons || 0).toLocaleString()} t CO₂e</span></span>
                <span className="text-slate-500">Renewable: <span className="font-semibold text-slate-700">{a.energy_source_renewable_pct || 0}%</span></span>
                <span className="text-slate-500">Recycled: <span className="font-semibold text-slate-700">{a.waste_recycled_pct || 0}%</span></span>
                <span className={cn("font-medium", a.child_labor_risk === "high" || a.child_labor_risk === "severe" ? "text-red-600" : "text-slate-500")}>
                  Child labor: <span className="font-semibold capitalize">{a.child_labor_risk || "none"}</span>
                </span>
                <span className="text-slate-500">Wage: <span className="font-semibold capitalize">{a.wage_compliance || "unknown"}</span></span>
              </div>

              {/* Flag reasons */}
              {a.flag_reasons && a.flag_reasons.length > 0 && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {a.flag_reasons.map((r, i) => (
                      <p key={i} className="text-xs text-red-700">{r}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assessment form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-[#231F20]">
                {editingId ? "Edit Sustainability Assessment" : "New Sustainability Assessment"}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Live preview */}
              <div className={cn("rounded-lg p-3 border flex items-center justify-between", GRADE_COLORS[previewScore.sustainability_grade])}>
                <div>
                  <p className="text-xs font-medium opacity-80">Live Score Preview</p>
                  <p className="text-2xl font-bold">{previewScore.overall_sustainability_score}/100 · Grade {previewScore.sustainability_grade}</p>
                </div>
                <div className="text-right text-xs">
                  <p>Environmental: {previewScore.environmental_impact_score}/100</p>
                  <p>Flags: {previewScore.flag_reasons.length}</p>
                </div>
              </div>

              {/* Supplier info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Supplier Name *</label>
                  <input value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" placeholder="e.g. Global Textiles Co." />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Region</label>
                  <input value={formData.supply_chain_region} onChange={(e) => setFormData({ ...formData, supply_chain_region: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" placeholder="e.g. Southeast Asia" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Industry Sector</label>
                  <input value={formData.industry_sector} onChange={(e) => setFormData({ ...formData, industry_sector: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" placeholder="e.g. Textiles" />
                </div>
              </div>

              {/* Environmental metrics */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Factory className="w-3 h-3" /> Environmental Impact</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Carbon (tons CO₂e/yr)</label>
                    <input type="number" value={formData.carbon_footprint_tons} onChange={(e) => setFormData({ ...formData, carbon_footprint_tons: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Renewable Energy %</label>
                    <input type="number" value={formData.energy_source_renewable_pct} onChange={(e) => setFormData({ ...formData, energy_source_renewable_pct: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Water Usage (L/yr)</label>
                    <input type="number" value={formData.water_usage_liters} onChange={(e) => setFormData({ ...formData, water_usage_liters: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Waste Recycled %</label>
                    <input type="number" value={formData.waste_recycled_pct} onChange={(e) => setFormData({ ...formData, waste_recycled_pct: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                </div>
              </div>

              {/* Fair labor metrics */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Fair Labor Compliance</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Fair Labor Score (0-100)</label>
                    <input type="number" value={formData.fair_labor_score} onChange={(e) => setFormData({ ...formData, fair_labor_score: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Safety Score (0-100)</label>
                    <input type="number" value={formData.safety_score} onChange={(e) => setFormData({ ...formData, safety_score: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Child Labor Risk</label>
                    <select value={formData.child_labor_risk} onChange={(e) => setFormData({ ...formData, child_labor_risk: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none bg-white">
                      {CHILD_RISK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Wage Compliance</label>
                    <select value={formData.wage_compliance} onChange={(e) => setFormData({ ...formData, wage_compliance: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none bg-white">
                      {COMPLIANCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Working Hours Compliance</label>
                    <select value={formData.working_hours_compliance} onChange={(e) => setFormData({ ...formData, working_hours_compliance: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none bg-white">
                      {COMPLIANCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 mb-0.5 block">Assessment Date</label>
                    <input type="date" value={formData.assessment_date} onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400" />
                  </div>
                </div>
              </div>

              {/* Live flag preview */}
              {previewScore.flag_reasons.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Auto-Flagged Issues:</p>
                  {previewScore.flag_reasons.map((r, i) => <p key={i} className="text-xs text-red-600 ml-4">• {r}</p>)}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                <Save className="w-3.5 h-3.5" /> {editingId ? "Update" : "Create"} Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}