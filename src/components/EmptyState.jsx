import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function EmptyState({ icon: Icon, title, description, ctaLabel, ctaTo, children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a0f1a] to-[#111827] border border-slate-700/60 p-8 sm:p-10 text-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-md mx-auto">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7 text-emerald-400" />
          </div>
        )}
        <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
        {description && <p className="text-sm text-slate-400 leading-relaxed mb-5">{description}</p>}
        {ctaTo && ctaLabel && (
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 min-h-[44px]"
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}