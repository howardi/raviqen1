import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import { Building2, Upload, Trash2, Loader2, Save, Image as ImageIcon } from "lucide-react";

export default function CompanyProfileSection() {
  const { toast } = useToast();
  const { profile, loadProfile } = useCompanyProfile();
  const [form, setForm] = useState({
    company_name: "", logo_url: "", address: "", registration_number: "",
    contact_email: "", contact_phone: "", brand_color: "#231F20", footer_text: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name || "",
        logo_url: profile.logo_url || "",
        address: profile.address || "",
        registration_number: profile.registration_number || "",
        contact_email: profile.contact_email || "",
        contact_phone: profile.contact_phone || "",
        brand_color: profile.brand_color || "#231F20",
        footer_text: profile.footer_text || "",
      });
    }
  }, [profile]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, logo_url: file_url }));
      toast({ title: "Logo uploaded" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleRemoveLogo = () => {
    setForm((f) => ({ ...f, logo_url: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (profile?.id) {
        await base44.entities.CompanyProfile.update(profile.id, form);
      } else {
        await base44.entities.CompanyProfile.create(form);
      }
      await loadProfile();
      toast({ title: "Company profile saved", description: "Your branding will appear on all generated reports." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Company Profile</h3>
          <p className="text-xs text-slate-500">Branding and info for generated reports</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Logo upload */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Company Logo</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {form.logo_url ? "Replace" : "Upload"}
              </button>
              {form.logo_url && (
                <button type="button" onClick={handleRemoveLogo} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, or SVG. Auto-resized with aspect ratio locked.</p>
        </div>

        {/* Company name */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Company / Organization Name</label>
          <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Acme Risk Partners" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Business Address</label>
          <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Street, City, State, ZIP, Country" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Registration / License Number</label>
            <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="Optional" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Brand Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer" />
              <input value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 font-mono outline-none focus:border-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Primary Contact Email</label>
            <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="contact@company.com" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Primary Contact Phone</label>
            <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+1 (555) 000-0000" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          </div>
        </div>

        {/* Footer text */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Report Footer Text</label>
          <input value={form.footer_text} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} placeholder="e.g. Confidential — For Internal Use Only" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
          <p className="text-[10px] text-slate-400 mt-1">Appears on every page of exported reports. Defaults to "RAVIQEN Confidential" if empty.</p>
        </div>

        {/* Live Preview */}
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Live Report Preview</label>
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: form.brand_color }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="h-8 w-8 object-contain rounded bg-white/10" />
              ) : (
                <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-white/60" />
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-white">{form.company_name || "RAVIQEN"}</p>
                <p className="text-[10px] text-white/70">Risk &amp; Compliance Report</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[9px] text-white/60">Generated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <div className="px-4 py-3 bg-white">
              <p className="text-xs font-bold text-[#231F20]">Sample Report Title</p>
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-500">Sample content line with <span className="font-bold text-[#231F20]">bold text</span> rendered properly.</p>
                <p className="text-[10px] text-slate-500">&bull; Bullet point example</p>
              </div>
            </div>
            <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <p className="text-[9px] text-slate-400">{form.footer_text || "RAVIQEN Confidential"}</p>
              <p className="text-[9px] text-slate-400">{[form.contact_email, form.contact_phone].filter(Boolean).join(" | ") || "Page 1 of 1"}</p>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Company Profile
        </button>
      </form>
    </div>
  );
}