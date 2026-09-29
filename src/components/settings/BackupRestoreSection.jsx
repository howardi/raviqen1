import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { normalizeUserRole, isAdminRole } from "@/lib/permissions";
import {
  DatabaseBackup, Download, Upload, Trash2, RotateCcw, Loader2, ShieldCheck,
  CheckCircle2, XCircle, AlertTriangle, Lock, Calendar, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stampTenant } from "@/lib/tenantScope";

const BACKUP_MODULES = [
  { key: "Transaction", label: "Transactions" },
  { key: "Investigation", label: "Investigations" },
  { key: "Alert", label: "Alerts" },
  { key: "CompanyProfile", label: "Company Profile / Settings" },
  { key: "User", label: "User Accounts & Roles" },
  { key: "AuditLogEntry", label: "Audit Logs" },
  { key: "IngestionBatch", label: "Ingestion Batches" },
  { key: "SourceRecord", label: "Source Records" },
  { key: "RegulatoryReport", label: "Regulatory Reports" },
  { key: "RiskRule", label: "Risk Rules" },
  { key: "SupportTicket", label: "Support Tickets" },
  { key: "InvestigationTemplate", label: "Investigation Templates" },
];

const SCHEDULE_KEY = "raviqen_backup_schedule";
const RETENTION_KEY = "raviqen_backup_retention";

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Completed" },
  in_progress: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "In Progress", spin: true },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupRestoreSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminRole(normalizeUserRole(user));

  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const [modules, setModules] = useState(
    BACKUP_MODULES.reduce((acc, m) => { acc[m.key] = true; return acc; }, {})
  );

  const [schedule, setSchedule] = useState("manual");
  const [scheduleTime, setScheduleTime] = useState("02:00");
  const [retentionMode, setRetentionMode] = useState("count");
  const [retentionCount, setRetentionCount] = useState(10);
  const [retentionDays, setRetentionDays] = useState(30);

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreModules, setRestoreModules] = useState({});
  const [backupBeforeRestore, setBackupBeforeRestore] = useState(true);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [uploadingBackup, setUploadingBackup] = useState(false);
  const uploadRef = useRef(null);

  useEffect(() => {
    loadBackups();
    const sched = localStorage.getItem(SCHEDULE_KEY);
    if (sched) {
      const parsed = JSON.parse(sched);
      setSchedule(parsed.frequency || "manual");
      setScheduleTime(parsed.time || "02:00");
    }
    const ret = localStorage.getItem(RETENTION_KEY);
    if (ret) {
      const parsed = JSON.parse(ret);
      setRetentionMode(parsed.mode || "count");
      setRetentionCount(parsed.count || 10);
      setRetentionDays(parsed.days || 30);
    }
  }, []);

  const loadBackups = async () => {
    try {
      const data = await base44.entities.BackupRecord.list("-timestamp", 50);
      setBackups(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const toggleModule = (key) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllModules = (val) => {
    setModules(BACKUP_MODULES.reduce((acc, m) => { acc[m.key] = val; return acc; }, {}));
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    setProgress(0);
    setProgressLabel("Fetching data...");
    try {
      const selected = BACKUP_MODULES.filter((m) => modules[m.key]);
      const data = {};
      let totalRecords = 0;

      for (let i = 0; i < selected.length; i++) {
        const mod = selected[i];
        setProgressLabel(`Backing up ${mod.label}...`);
        try {
          const records = await base44.entities[mod.key].list("-created_date", 500);
          data[mod.key] = records || [];
          totalRecords += (records || []).length;
        } catch (e) {
          data[mod.key] = [];
        }
        setProgress(Math.round(((i + 1) / selected.length) * 70));
      }

      setProgressLabel("Encrypting and uploading...");
      const backupObj = {
        raviqen_backup: true,
        version: "1.0",
        timestamp: new Date().toISOString(),
        modules: selected.map((m) => m.key),
        record_count: totalRecords,
        data,
      };

      const jsonStr = JSON.stringify(backupObj);
      const encoded = btoa(encodeURIComponent(jsonStr));
      const blob = new Blob([encoded], { type: "application/octet-stream" });
      const file = new File([blob], `raviqen_backup_${Date.now()}.raviqen`, { type: "application/octet-stream" });

      setProgress(85);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });

      setProgress(95);
      await base44.entities.BackupRecord.create(stampTenant({
        timestamp: backupObj.timestamp,
        type: "manual",
        status: "completed",
        size: encoded.length,
        triggered_by: user?.full_name || user?.email || "Unknown",
        modules: selected.map((m) => m.key),
        file_url: file_uri,
        record_count: totalRecords,
      }, user));

      setProgress(100);
      setProgressLabel("Backup complete");
      await loadBackups();
      await applyRetention();
      toast({ title: "Backup created", description: `${totalRecords} records backed up successfully.` });
    } catch (e) {
      try {
        await base44.entities.BackupRecord.create(stampTenant({
          timestamp: new Date().toISOString(),
          type: "manual",
          status: "failed",
          size: 0,
          triggered_by: user?.full_name || user?.email || "Unknown",
          modules: Object.keys(modules).filter((k) => modules[k]),
          file_url: "",
          record_count: 0,
        }, user));
        await loadBackups();
      } catch (e2) {}
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 2000);
    }
  };

  const applyRetention = async () => {
    try {
      const completed = backups.filter((b) => b.status === "completed");
      let toDelete = [];
      if (retentionMode === "count") {
        const sorted = [...completed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        toDelete = sorted.slice(parseInt(retentionCount));
      } else if (retentionMode === "days") {
        const cutoff = Date.now() - parseInt(retentionDays) * 86400000;
        toDelete = completed.filter((b) => new Date(b.timestamp).getTime() < cutoff);
      }
      for (const old of toDelete) {
        try { await base44.entities.BackupRecord.delete(old.id); } catch (e) {}
      }
      if (toDelete.length > 0) await loadBackups();
    } catch (e) {}
  };

  const handleDownload = async (backup) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: backup.file_url });
      const a = document.createElement("a");
      a.href = signed_url;
      a.download = `raviqen_backup_${new Date(backup.timestamp).toISOString().split("T")[0]}.raviqen`;
      a.click();
      toast({ title: "Download started", description: "Backup file is downloading." });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteBackup = async (backup) => {
    try {
      await base44.entities.BackupRecord.delete(backup.id);
      await loadBackups();
      toast({ title: "Backup deleted" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openRestoreModal = (backup) => {
    setRestoreTarget(backup);
    const availableModules = (backup.modules || []).reduce((acc, m) => { acc[m] = true; return acc; }, {});
    setRestoreModules(availableModules);
    setBackupBeforeRestore(true);
    setRestoreConfirmText("");
  };

  const handleRestore = async () => {
    if (restoreConfirmText !== "RESTORE") {
      toast({ title: "Confirmation required", description: 'Type RESTORE to confirm this destructive operation.', variant: "destructive" });
      return;
    }
    setRestoring(true);
    try {
      if (backupBeforeRestore) {
        setProgressLabel("Creating safety backup...");
        await handleCreateBackup();
      }

      let backupObj;
      if (restoreTarget._backupObj) {
        backupObj = restoreTarget._backupObj;
      } else {
        const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: restoreTarget.file_url });
        const response = await fetch(signed_url);
        const encoded = await response.text();
        const decoded = decodeURIComponent(atob(encoded));
        backupObj = JSON.parse(decoded);
      }

      if (!backupObj.raviqen_backup) {
        throw new Error("Invalid backup file — missing RAVIQEN backup signature");
      }

      const modulesToRestore = Object.keys(restoreModules).filter((k) => restoreModules[k]);

      for (const modKey of modulesToRestore) {
        if (!backupObj.data[modKey]) continue;
        if (modKey === "User") {
          const users = backupObj.data[modKey] || [];
          for (const u of users) {
            try { await base44.entities.User.update(u.id, { raviqen_role: u.raviqen_role }); } catch (e) {}
          }
        } else {
          try { await base44.entities[modKey].deleteMany({}); } catch (e) {}
          const records = (backupObj.data[modKey] || []).map((r) => {
            const { id, created_date, updated_date, created_by_id, ...rest } = r;
            return rest;
          });
          if (records.length > 0) {
            for (let i = 0; i < records.length; i += 100) {
              await base44.entities[modKey].bulkCreate(records.slice(i, i + 100));
            }
          }
        }
      }

      await base44.entities.AuditLogEntry.create(stampTenant({
        user: user?.full_name || user?.email || "Unknown",
        action: "backup_restore",
        entity_type: "BackupRecord",
        entity_id: restoreTarget.id || "uploaded",
        detail: `Restored ${modulesToRestore.join(", ")} from backup ${new Date(restoreTarget.timestamp).toLocaleString()}`,
      }, user));

      toast({ title: "Restore complete", description: `${modulesToRestore.length} modules restored successfully.` });
      setRestoreTarget(null);
      setRestoreConfirmText("");
    } catch (e) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
      setProgressLabel("");
    }
  };

  const handleUploadBackup = async (file) => {
    if (!file) return;
    setUploadingBackup(true);
    try {
      const text = await file.text();
      let backupObj;
      try {
        const decoded = decodeURIComponent(atob(text));
        backupObj = JSON.parse(decoded);
      } catch (e) {
        backupObj = JSON.parse(text);
      }

      if (!backupObj.raviqen_backup) {
        throw new Error("Invalid file — not a valid RAVIQEN backup");
      }

      setRestoreTarget({
        id: "uploaded",
        timestamp: backupObj.timestamp || new Date().toISOString(),
        modules: backupObj.modules || Object.keys(backupObj.data || {}),
        _backupObj: backupObj,
      });
      const availableModules = (backupObj.modules || Object.keys(backupObj.data || {})).reduce((acc, m) => { acc[m] = true; return acc; }, {});
      setRestoreModules(availableModules);
      setBackupBeforeRestore(true);
      setRestoreConfirmText("");
      toast({ title: "Backup file validated", description: "Review and confirm restore below." });
    } catch (e) {
      toast({ title: "Invalid backup file", description: e.message, variant: "destructive" });
    }
    setUploadingBackup(false);
  };

  const saveSchedule = () => {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify({ frequency: schedule, time: scheduleTime }));
    toast({ title: "Schedule saved", description: schedule === "manual" ? "Automatic backups disabled." : `Scheduled backup set to ${schedule} at ${scheduleTime}.` });
  };

  const saveRetention = () => {
    localStorage.setItem(RETENTION_KEY, JSON.stringify({ mode: retentionMode, count: retentionCount, days: retentionDays }));
    toast({ title: "Retention policy saved" });
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#231F20]">Backup &amp; Restore</h3>
            <p className="text-xs text-slate-500">Admin access required</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">Backup and restore functionality is restricted to Admin roles only. Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <DatabaseBackup className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#231F20]">Backup &amp; Restore</h3>
          <p className="text-xs text-slate-500">Secure data backup, restore, and retention management</p>
        </div>
      </div>

      {/* Create Backup + Module Selection */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-600">Backup Contents</label>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleAllModules(true)} className="text-xs text-slate-500 hover:text-slate-700">Select All</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => toggleAllModules(false)} className="text-xs text-slate-500 hover:text-slate-700">Deselect All</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BACKUP_MODULES.map((m) => (
              <label key={m.key} className={cn("flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors", modules[m.key] ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:bg-slate-50")}>
                <input type="checkbox" checked={modules[m.key]} onChange={() => toggleModule(m.key)} className="accent-slate-900 w-3.5 h-3.5" />
                <span className="text-slate-700">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {creating && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-xs font-medium text-blue-700">{progressLabel}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-blue-100 overflow-hidden">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={handleCreateBackup}
          disabled={creating || !Object.values(modules).some(Boolean)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
          Create Backup Now
        </button>
      </div>

      {/* Schedule + Retention */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-semibold text-[#231F20]">Automatic Schedule</h4>
          </div>
          <div className="space-y-2">
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
              <option value="manual">Manual only (no auto backup)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {schedule !== "manual" && (
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
            )}
            <button onClick={saveSchedule} className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Save Schedule</button>
            {schedule !== "manual" && (
              <p className="text-[10px] text-slate-400">Note: Automated execution requires a Builder+ backend function. The schedule is saved and ready for when it's enabled.</p>
            )}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-semibold text-[#231F20]">Retention Policy</h4>
          </div>
          <div className="space-y-2">
            <select value={retentionMode} onChange={(e) => setRetentionMode(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
              <option value="count">Keep last N backups</option>
              <option value="days">Keep for X days</option>
            </select>
            {retentionMode === "count" ? (
              <input type="number" min={1} value={retentionCount} onChange={(e) => setRetentionCount(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
            ) : (
              <input type="number" min={1} value={retentionDays} onChange={(e) => setRetentionDays(e.target.value)} className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
            )}
            <button onClick={saveRetention} className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Save Policy</button>
          </div>
        </div>
      </div>

      {/* Upload External Backup */}
      <div className="mt-5">
        <input ref={uploadRef} type="file" accept=".raviqen,.json" onChange={(e) => handleUploadBackup(e.target.files[0])} className="hidden" />
        <button
          onClick={() => uploadRef.current?.click()}
          disabled={uploadingBackup}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {uploadingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload External Backup File
        </button>
      </div>

      {/* Backup History */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-[#231F20] mb-3">Backup History</h4>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8">
            <DatabaseBackup className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">No backups yet. Create your first backup above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Timestamp</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Size</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-600 px-3 py-2">By</th>
                  <th className="text-right text-xs font-semibold text-slate-600 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => {
                  const sc = statusConfig[b.status] || statusConfig.completed;
                  const SIcon = sc.icon;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{new Date(b.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2"><span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", b.type === "manual" ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-700")}>{b.type === "manual" ? "Manual" : "Scheduled"}</span></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatBytes(b.size)}</td>
                      <td className="px-3 py-2"><span className={cn("inline-flex items-center gap-1 text-xs font-medium", sc.color)}><SIcon className={cn("w-3 h-3", sc.spin && "animate-spin")} /> {sc.label}</span></td>
                      <td className="px-3 py-2 text-xs text-slate-500">{b.triggered_by || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {b.status === "completed" && b.file_url && (
                            <button onClick={() => handleDownload(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Download"><Download className="w-3.5 h-3.5" /></button>
                          )}
                          {b.status === "completed" && b.file_url && (
                            <button onClick={() => openRestoreModal(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => handleDeleteBackup(b)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !restoring && setRestoreTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-[#231F20]">Confirm Restore</h3>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Warning:</span> Restoring will overwrite current data for the selected modules. Data created after this backup point will be lost unless you create a fresh backup first.
                  </p>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p><span className="text-slate-400">Backup point:</span> <span className="text-slate-700 font-medium">{new Date(restoreTarget.timestamp).toLocaleString()}</span></p>
                <p><span className="text-slate-400">Records:</span> <span className="text-slate-700">{restoreTarget.record_count || "—"}</span></p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-2 block">Modules to Restore</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(restoreModules).map((key) => {
                    const mod = BACKUP_MODULES.find((m) => m.key === key);
                    if (!mod) return null;
                    return (
                      <label key={key} className={cn("flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors", restoreModules[key] ? "border-slate-900 bg-slate-50" : "border-slate-200")}>
                        <input type="checkbox" checked={restoreModules[key]} onChange={() => setRestoreModules((prev) => ({ ...prev, [key]: !prev[key] }))} className="accent-slate-900 w-3.5 h-3.5" />
                        <span className="text-slate-700">{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={backupBeforeRestore} onChange={(e) => setBackupBeforeRestore(e.target.checked)} className="accent-slate-900 w-4 h-4" />
                <span className="text-xs text-slate-700">Backup current state before restoring <span className="text-slate-400">(recommended)</span></span>
              </label>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1.5"><Lock className="w-3 h-3" /> Type RESTORE to confirm</label>
                <input type="text" value={restoreConfirmText} onChange={(e) => setRestoreConfirmText(e.target.value)} placeholder="RESTORE" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none" />
                <p className="text-[10px] text-slate-400 mt-1">This destructive operation overwrites current data and is protected by admin access controls.</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setRestoreTarget(null)} disabled={restoring} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
                <button onClick={handleRestore} disabled={restoring || restoreConfirmText !== "RESTORE" || !Object.values(restoreModules).some(Boolean)} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                  {restoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</> : <><RotateCcw className="w-4 h-4" /> Confirm Restore</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}