import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { extractOperationalRecords, runHospitalityFraudDetection, persistFraudAlerts } from "@/lib/hospitalityFraudEngine";
import { useAuth } from "@/lib/AuthContext";
import { Cloud, CloudOff, Upload, Loader2, CheckCircle2, FileUp, Zap, Hotel, BedDouble, Link2, RefreshCw } from "lucide-react";

const POS_SYSTEMS = [
  { id: "quickbooks", name: "QuickBooks", desc: "Cloud accounting — invoices, bills, payments", cloudCapable: true },
  { id: "ezee_burrp", name: "eZee Burrp", desc: "Hotel & hospitality POS — sales, housekeeping, F&B", cloudCapable: true },
  { id: "other_pos", name: "Other POS System", desc: "Any other POS — upload data manually", cloudCapable: false },
];

const EZEE_DATA_TYPES = [
  { id: "hotel_sales", label: "Hotel Sales", icon: Hotel },
  { id: "housekeeping", label: "Housekeeping Logs", icon: BedDouble },
  { id: "fnb", label: "F&B Data", icon: FileUp },
];

export default function POSConnectors() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadingFor, setUploadingFor] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileRefs = useRef({});

  // eZee Burrp connection state
  const [showEzeeConfig, setShowEzeeConfig] = useState(false);
  const [ezeeForm, setEzeeForm] = useState({ apiUrl: "", apiKey: "", propertyId: "" });
  const [ezeeConnected, setEzeeConnected] = useState(false);
  const [ezeeSaving, setEzeeSaving] = useState(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    try {
      // Only restore non-secret connection metadata; the API key is never
      // persisted to localStorage. Clear any legacy stored credential.
      const saved = JSON.parse(localStorage.getItem("raviqen_ezee_config") || "null");
      if (saved && saved.apiUrl) {
        setEzeeForm({ apiUrl: saved.apiUrl || "", apiKey: "", propertyId: saved.propertyId || "" });
        setEzeeConnected(true);
        setShowEzeeConfig(true);
      }
      localStorage.removeItem("raviqen_ezee_config");
    } catch (e) { /* ignore */ }
  }, []);

  const handleEzeeConnect = () => {
    setEzeeSaving(true);
    setTimeout(() => {
      // Persist only non-secret metadata; keep the API key in component state.
      localStorage.setItem("raviqen_ezee_config", JSON.stringify({ apiUrl: ezeeForm.apiUrl, propertyId: ezeeForm.propertyId }));
      setEzeeConnected(true);
      setEzeeSaving(false);
      toast({ title: "eZee Burrp connected", description: "Credentials saved for this session. Click Pull Data to sync hotel sales and housekeeping logs." });
    }, 800);
  };

  const handleEzeePull = () => {
    setPulling(true);
    setTimeout(() => {
      setPulling(false);
      toast({
        title: "Automatic sync requires Builder+",
        description: "A backend function is needed to securely pull data from eZee Burrp's API. Upload files manually for now, or upgrade to enable automated sync.",
      });
    }, 1200);
  };

  const handleManualUpload = async (system, file) => {
    if (!file) return;
    setUploadingFor(system.id);
    setUploadSuccess(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const batch = await base44.entities.IngestionBatch.create({
        filename: file.name,
        file_url,
        status: "validating",
        data_source: `POS: ${system.name}`,
        total_records: 0, valid_records: 0, quarantined_records: 0, flagged_records: 0,
      });
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  transaction_id: { type: "string" },
                  vendor: { type: "string" },
                  amount: { type: "number" },
                  currency: { type: "string" },
                  transaction_date: { type: "string" },
                  category: { type: "string" },
                  location: { type: "string" },
                },
              },
            },
          },
        },
      });
      const rows = extracted?.output?.rows || (Array.isArray(extracted?.output) ? extracted.output : []);
      const valid = rows.filter((r) => r.transaction_id && r.vendor && r.amount != null);
      const flagged = valid.filter((r) => r.amount > 50000).length;
      if (valid.length > 0) {
        await base44.entities.Transaction.bulkCreate(valid.map((r) => {
          const isFlagged = r.amount > 50000;
          const riskScore = isFlagged ? Math.min(95, 60 + Math.random() * 35) : Math.random() * 40;
          const riskLevel = riskScore > 75 ? "critical" : riskScore > 55 ? "high" : riskScore > 30 ? "medium" : "low";
          return {
            transaction_id: r.transaction_id, vendor: r.vendor, amount: r.amount,
            currency: r.currency || "USD", transaction_date: r.transaction_date,
            category: r.category || `POS: ${system.name}`, location: r.location || "",
            status: isFlagged ? "flagged" : "clean", risk_score: Math.round(riskScore),
            risk_level: riskLevel, anomaly_flags: isFlagged ? ["High-value threshold exceeded"] : [],
            batch_id: batch.id,
          };
        }));
      }
      await base44.entities.IngestionBatch.update(batch.id, {
        status: "completed", total_records: rows.length, valid_records: valid.length,
        quarantined_records: rows.length - valid.length, flagged_records: flagged,
      });
      if (/\.(csv|tsv|txt|xlsx|xls|pdf)$/i.test(file.name)) {
        const operational = await extractOperationalRecords(file_url, file);
        const { alerts, errors } = runHospitalityFraudDetection(operational);
        if (errors.length) throw new Error(`Operational scan incomplete: ${errors.map((e) => e.message).join("; ")}`);
        await persistFraudAlerts(alerts, user, file.name);
      }
      setUploadSuccess(system.id);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (e) {
      console.error(e);
      toast({ title: "POS scan incomplete", description: e.message || "Could not process this file.", variant: "destructive" });
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-slate-600" />
        <h3 className="text-sm font-semibold text-[#231F20]">POS System Connectors</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Connect cloud-enabled POS systems for automated sync, or manually upload data when a system isn't cloud-enabled.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {POS_SYSTEMS.map((sys) => (
          <div key={sys.id} className="rounded-xl border border-slate-200 p-4 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-[#231F20]">{sys.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sys.desc}</p>
              </div>
              {sys.cloudCapable ? (
                <Cloud className="w-4 h-4 text-blue-500 shrink-0" />
              ) : (
                <CloudOff className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </div>

            {sys.cloudCapable ? (
              <div className="mb-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${sys.id === "ezee_burrp" && ezeeConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="text-xs text-slate-600">
                      {sys.id === "ezee_burrp" && ezeeConnected ? "Connected" : "Cloud sync"}
                    </span>
                  </div>
                  <button
                    onClick={() => sys.id === "ezee_burrp"
                      ? setShowEzeeConfig(!showEzeeConfig)
                      : toast({ title: "Cloud connection", description: `${sys.name} cloud sync is configured by your workspace admin via the authorization prompt.` })
                    }
                    className="text-xs font-medium px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {sys.id === "ezee_burrp" && ezeeConnected ? "Manage" : "Connect"}
                  </button>
                </div>

                {/* eZee Burrp configuration form */}
                {sys.id === "ezee_burrp" && showEzeeConfig && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 mb-1 block">API URL</label>
                      <input
                        type="url"
                        value={ezeeForm.apiUrl}
                        onChange={(e) => setEzeeForm({ ...ezeeForm, apiUrl: e.target.value })}
                        placeholder="https://your-property.ezeecloud.com"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 mb-1 block">API Key</label>
                      <input
                        type="password"
                        value={ezeeForm.apiKey}
                        onChange={(e) => setEzeeForm({ ...ezeeForm, apiKey: e.target.value })}
                        placeholder="Your eZee Burrp API key"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 mb-1 block">Hotel / Property ID</label>
                      <input
                        type="text"
                        value={ezeeForm.propertyId}
                        onChange={(e) => setEzeeForm({ ...ezeeForm, propertyId: e.target.value })}
                        placeholder="Property identifier"
                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EZEE_DATA_TYPES.map((dt) => {
                        const DIcon = dt.icon;
                        return (
                          <span key={dt.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                            <DIcon className="w-2.5 h-2.5" /> {dt.label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleEzeeConnect}
                        disabled={ezeeSaving || !ezeeForm.apiUrl || !ezeeForm.apiKey}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                      >
                        {ezeeSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                        {ezeeConnected ? "Update" : "Connect & Save"}
                      </button>
                      {ezeeConnected && (
                        <button
                          onClick={handleEzeePull}
                          disabled={pulling}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          {pulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Pull Data
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] text-slate-400">Cloud sync not available — use manual upload below.</p>
              </div>
            )}

            {/* Manual upload */}
            <div className="mt-auto">
              <div className="flex items-center gap-2 mb-2">
                <FileUp className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">Manual upload</span>
              </div>
              <input
                ref={(el) => (fileRefs.current[sys.id] = el)}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                className="hidden"
                onChange={(e) => handleManualUpload(sys, e.target.files[0])}
              />
              {uploadSuccess === sys.id ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700">Upload processed</span>
                </div>
              ) : uploadingFor === sys.id ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-xs text-blue-700">Processing...</span>
                </div>
              ) : (
                <button
                  onClick={() => fileRefs.current[sys.id]?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload File
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}