import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { normalizeUserRole } from "@/lib/permissions";

export default function DangerZoneSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const role = normalizeUserRole(user);
  // Strict RBAC: only Super Admin sees this section
  if (role !== "super_admin") return null;

  const handleReset = async () => {
    if (confirmText !== "RESET") return;
    setResetting(true);
    try {
      const res = await base44.functions.invoke("factoryReset", { confirm: "RESET" });
      if (!res.data?.success) throw new Error(res.data?.message || "The reset did not complete.");
      toast({
        title: "System reset complete",
        description: "Application records, including ingestion audit history, have been wiped. Redirecting to landing page...",
      });
      setOpen(false);
      setConfirmText("");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err.message || "An error occurred during system reset",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border-2 border-red-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
            <p className="text-xs text-red-500">Irreversible system-wide actions — Super Admin only</p>
          </div>
        </div>
        <div className="rounded-lg bg-red-50/60 border border-red-100 p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-red-900">Factory Reset</p>
              <p className="text-xs text-red-600 mt-1 max-w-md">
                Permanently deletes all organizations, ingested data and audit history, risk alerts,
                investigations, and non–Super Admin users. Uploaded files are not removed from storage. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors min-h-[44px]"
            >
              <AlertTriangle className="w-4 h-4" />
              Factory Reset
            </button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirm Factory Reset
            </DialogTitle>
            <DialogDescription className="text-left">
              This permanently deletes all application records — organizations, transactions,
              ingestion batches and audit logs, alerts, investigations, reports, and non–Super Admin
              accounts. Uploaded files are not removed from storage. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-2">
              Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET here"
              className="w-full text-sm px-3 py-2 rounded-lg border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-300 outline-none font-mono"
              disabled={resetting}
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => { setOpen(false); setConfirmText(""); }}
              disabled={resetting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={confirmText !== "RESET" || resetting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Wipe All Data
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}