import React from "react";

export default function OversightAwaiting() {
  return (
    <div className="mx-auto max-w-lg p-6 md:p-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Raviqen</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Awaiting department assignment</h1>
        <p className="mt-3 text-sm text-slate-600">Your manager must assign you to a department before you can submit reports. You cannot view business data while you wait.</p>
      </div>
    </div>
  );
}
