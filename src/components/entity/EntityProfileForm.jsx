import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const FIELDS = [
  { key: "legal_name", label: "Legal Name *", type: "text", required: true },
  { key: "trading_name", label: "Trading Name", type: "text" },
  { key: "entity_type", label: "Entity Type", type: "select", options: ["vendor", "buyer", "both"] },
  { key: "tax_id", label: "Tax ID / TIN / VAT", type: "text" },
  { key: "registration_number", label: "Registration Number (CAC)", type: "text" },
  { key: "address", label: "Registered Address", type: "text" },
  { key: "contact_email", label: "Contact Email", type: "email" },
  { key: "contact_phone", label: "Contact Phone", type: "text" },
  { key: "country", label: "Country", type: "text" },
  { key: "industry", label: "Industry", type: "text" },
  { key: "baseline_risk_tag", label: "Baseline Risk Tag", type: "select", options: ["low_risk", "medium_risk", "high_watch", "blacklisted"] },
];

const EMPTY = { legal_name: "", trading_name: "", entity_type: "vendor", tax_id: "", registration_number: "", address: "", contact_email: "", contact_phone: "", country: "", industry: "", baseline_risk_tag: "low_risk" };

export default function EntityProfileForm({ open, onOpenChange, onSubmit, editing, saving }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (editing) setForm({ ...EMPTY, ...editing });
    else setForm(EMPTY);
  }, [editing, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.legal_name) return;
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Entity Profile" : "Create Entity Profile"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.key === "legal_name" || f.key === "address" || f.key === "trading_name" ? "col-span-2" : ""}>
                <Label className="text-xs font-medium text-slate-600 mb-1.5 block">{f.label}</Label>
                {f.type === "select" ? (
                  <select
                    value={form[f.key] || ""}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white"
                  >
                    {f.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                  </select>
                ) : (
                  <Input type={f.type} value={form[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} className="text-sm" required={f.required} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.legal_name} className="bg-slate-900 hover:bg-slate-800">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}