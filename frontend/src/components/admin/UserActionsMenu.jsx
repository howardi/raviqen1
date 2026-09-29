import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Shield, KeyRound, Ban, CheckCircle2, Trash2, X } from "lucide-react";

/**
 * Dropdown menu for advanced user management actions.
 * Props:
 * - onEdit: () => void
 * - onResetPassword: () => void
 * - onToggleDisable: () => void
 * - onDelete: () => void
 * - isDisabled: boolean — whether the target user is currently disabled
 * - disabled: boolean — whether the menu button itself is disabled
 */
export default function UserActionsMenu({ onEdit, onResetPassword, onToggleDisable, onDelete, isDisabled, disabled }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
      >
        <MoreVertical className="w-3.5 h-3.5" /> Actions
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 z-30 overflow-hidden">
          {!confirmDelete ? (
            <>
              <button
                onClick={() => { close(); onEdit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                Edit Permissions
              </button>
              <button
                onClick={() => { close(); onResetPassword(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                Reset Password
              </button>
              <div className="border-t border-slate-100" />
              <button
                onClick={() => { close(); onToggleDisable(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 transition-colors text-left"
              >
                {isDisabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Ban className="w-3.5 h-3.5 text-amber-500" />}
                {isDisabled ? "Enable User" : "Disable User"}
              </button>
              <div className="border-t border-slate-100" />
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                Delete User
              </button>
            </>
          ) : (
            <div className="p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Confirm deletion?</p>
              <p className="text-[11px] text-slate-500 mb-3">This permanently removes the user account. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={close}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-50 transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={() => { close(); onDelete(); }}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-medium hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}