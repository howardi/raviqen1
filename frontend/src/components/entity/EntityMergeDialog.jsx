import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, GitMerge, AlertTriangle } from "lucide-react";

export default function EntityMergeDialog({ open, onOpenChange, profiles, onMerge, merging }) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  useEffect(() => { if (!open) { setSourceId(""); setTargetId(""); } }, [open]);

  const canMerge = sourceId && targetId && sourceId !== targetId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="w-4 h-4" /> Merge Entity Profiles</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Source (will be deleted)</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white">
              <option value="">Select source entity…</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.legal_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Target (will absorb source)</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white">
              <option value="">Select target entity…</option>
              {profiles.filter((p) => p.id !== sourceId).map((p) => <option key={p.id} value={p.id}>{p.legal_name}</option>)}
            </select>
          </div>
          {canMerge && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                All transactions linked to the source entity will be reassigned to the target. Bank accounts will be merged.
                The source profile will be permanently deleted.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancel</Button>
          <Button type="button" disabled={!canMerge || merging} onClick={() => onMerge(sourceId, targetId)} className="bg-slate-900 hover:bg-slate-800">
            {merging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitMerge className="w-4 h-4 mr-2" />}
            Merge Entities
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}