import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Library, Save, Loader2, Plus, FileText, ChevronDown, ChevronUp } from "lucide-react";

const CATEGORIES = [
  { value: "procurement", label: "Procurement" },
  { value: "payroll", label: "Payroll" },
  { value: "vendor_payment", label: "Vendor Payment" },
  { value: "expenses", label: "Expenses" },
  { value: "transfers", label: "Transfers" },
  { value: "fraud", label: "Fraud" },
  { value: "compliance", label: "Compliance" },
  { value: "general", label: "General" },
];

export default function TemplateManager({ notes, onNotesChange }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => {
    try {
      const data = await base44.entities.InvestigationTemplate.list("-created_date", 50);
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplates(); }, []);

  const handleLoad = (template) => {
    const content = template.notes_template || template.findings_template || "";
    if (!content) return;
    const merged = notes && notes.trim() ? notes + "\n\n---\n\n" + content : content;
    onNotesChange(merged);
    toast({ title: "Template loaded", description: `"${template.name}" applied to notes` });
  };

  const handleSave = async () => {
    if (!name.trim() || !notes.trim()) return;
    setSaving(true);
    try {
      await base44.entities.InvestigationTemplate.create({
        name: name.trim(),
        category,
        notes_template: notes,
        findings_template: notes,
      });
      toast({ title: "Template saved", description: `"${name.trim()}" is now available for future investigations` });
      setName("");
      setShowSave(false);
      loadTemplates();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <Library className="w-3.5 h-3.5" />
        Investigation Templates
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-slate-400">No templates saved yet. Save your current notes as a template for reuse.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {templates.map((tpl) => (
                <div key={tpl.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{tpl.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">{(tpl.category || "general").replace("_", " ")}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoad(tpl)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}

          {showSave ? (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name (e.g. 'Procurement anomaly checklist')"
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 outline-none"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 outline-none bg-white"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim() || !notes.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save Template
                </button>
                <button
                  onClick={() => setShowSave(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSave(true)}
              disabled={!notes.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Current Notes as Template
            </button>
          )}
        </div>
      )}
    </div>
  );
}