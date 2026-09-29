import React, { useState, useRef, useEffect } from "react";
import { Zap, Snowflake, Ban, FileCheck, ChevronDown, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { cn } from "@/lib/utils";
import { stampTenant } from "@/lib/tenantScope";

const ACTIONS = [
  {
    key: "freeze_transaction",
    label: "Freeze Transaction",
    icon: Snowflake,
    color: "text-blue-600",
    desc: "Quarantine the transaction immediately",
  },
  {
    key: "suspend_vendor",
    label: "Suspend Vendor",
    icon: Ban,
    color: "text-red-600",
    desc: "Block all payments to this vendor",
  },
  {
    key: "deploy_kyb",
    label: "Deploy KYB Questionnaire",
    icon: FileCheck,
    color: "text-violet-600",
    desc: "Send Know-Your-Business verification",
  },
  {
    key: "resolve_false_positive",
    label: "Resolve as False Positive",
    icon: ShieldCheck,
    color: "text-emerald-600",
    desc: "Close alert — requires evidence + your approval",
  },
  {
    key: "whitelist_vendor",
    label: "Whitelist Vendor",
    icon: UserCheck,
    color: "text-teal-600",
    desc: "Add to trusted list — requires evidence + your approval",
  },
];

export default function RemediationMenu({ alert, onAction }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const ref = useRef(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const executeAction = async (actionKey) => {
    setBusy(actionKey);
    setOpen(false);
    const action = ACTIONS.find((a) => a.key === actionKey);
    try {
      await base44.entities.RemediationAction.create(stampTenant({
        action_type: actionKey,
        target_vendor: alert.vendor,
        target_transaction_id: alert.transaction_id,
        alert_id: alert.id,
        status: "initiated",
        triggered_by: user?.full_name || user?.email || "System",
      }, user));

      if (actionKey === "freeze_transaction") {
        const tx = await base44.entities.Transaction.filter({ transaction_id: alert.transaction_id });
        if (tx.length) await base44.entities.Transaction.update(tx[0].id, { status: "quarantined" });
      }

      await logActivity(
        user,
        `remediation_${actionKey}`,
        `${action.label} initiated for ${alert.vendor} (TXN: ${alert.transaction_id})`,
        "RemediationAction",
        alert.id
      );

      toast({
        title: `${action.label} initiated`,
        description: `${alert.vendor} · ${action.desc}`,
        variant: "default",
      });

      if (onAction) onAction(actionKey, alert);
    } catch (e) {
      toast({
        title: "Action failed",
        description: e.message || "Could not execute remediation action",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        disabled={busy !== null}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors",
          "bg-slate-900 text-white border-slate-900 hover:bg-slate-800 disabled:opacity-50"
        )}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
        {busy ? "Working..." : "Remediate"}
        {!busy && <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1.5">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={(e) => {
                  e.stopPropagation();
                  executeAction(a.key);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start gap-2.5 transition-colors"
              >
                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", a.color)} />
                <div>
                  <div className="text-xs font-semibold text-slate-800">{a.label}</div>
                  <div className="text-[10px] text-slate-500">{a.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}