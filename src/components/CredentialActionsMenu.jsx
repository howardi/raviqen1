import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, KeyRound, UserX } from "lucide-react";

/**
 * Dropdown menu for credential management actions on a team member row.
 * Props:
 * - onSetPassword: () => void
 * - onRevoke: () => void
 * - disabled: boolean
 */
export default function CredentialActionsMenu({ onSetPassword, onRevoke, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" /> Actions
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 z-20 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onSetPassword(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            Set / Reset Password
          </button>
          <div className="border-t border-slate-100" />
          <button
            onClick={() => { setOpen(false); onRevoke(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <UserX className="w-3.5 h-3.5 text-red-500" />
            Revoke Credentials
          </button>
        </div>
      )}
    </div>
  );
}