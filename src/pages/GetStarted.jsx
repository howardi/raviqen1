import React from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowLeft, Radar, Layers, Zap } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getRoleHomeRoute } from "@/lib/permissions";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";
import AuthPanel from "@/components/landing/AuthPanel";

const RAVIQEN_LOGO_URL = "https://media.base44.com/images/public/6a90b256868de35f9bd5d6b1/94f8aa68b_image.png";

const PILLARS = [
  { icon: Radar, title: "Detect", text: "Continuously scans transactions, payroll, procurement and operations for risk signals." },
  { icon: Layers, title: "Prioritise", text: "Turns thousands of daily activities into clear, ranked intelligence your team can act on." },
  { icon: Zap, title: "Act", text: "Investigate with evidence, remediate with confidence, and stay ahead of what matters." },
];

export default function GetStarted() {
  const { user, isLoadingAuth } = useAuth();
  const { profile } = useCompanyProfile();
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get("preview") === "true";

  // Logged-in users skip the welcome screen and go straight to their dashboard
  // (unless previewing the page explicitly)
  if (!isLoadingAuth && user && !isPreview) {
    return <Navigate to={getRoleHomeRoute(user)} replace />;
  }

  const logoUrl = profile?.logo_url || RAVIQEN_LOGO_URL;
  const logoAlt = profile?.company_name || "RAVIQEN — AI Risk & Compliance Intelligence";

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col relative overflow-hidden">
      {/* Floating background orbs — continuity with the marketing hero */}
      <motion.div
        className="absolute top-20 -left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, -30, 0], opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, 40, 0], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-3 border-b border-slate-800/60">
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-10 sm:h-12 w-auto object-contain"
          style={{ maxHeight: "48px" }}
        />
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors min-h-[44px] px-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>
      </header>

      {/* Main content — welcome + auth */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 py-8 lg:py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Left: Welcome / value proposition */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="order-1"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300 uppercase tracking-wide">Welcome to RAVIQEN</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-tight">
              The intelligent layer that sits{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                above your existing systems
              </span>
              .
            </h1>

            <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              RAVIQEN detects risk signals, highlights anomalies, and protects your organisation —
              turning the data your systems already collect into clear, prioritised intelligence
              so your team can act earlier.
            </p>

            <p className="mt-3 text-sm text-emerald-300 font-medium italic">
              Your systems collect the data. RAVIQEN finds the risk.
            </p>

            {/* Pillars */}
            <div className="mt-7 space-y-3 max-w-xl">
              {PILLARS.map((p) => (
                <div key={p.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <p.icon className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: Auth panel — defaults to Sign Up */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full max-w-md mx-auto order-2"
          >
            <div className="bg-slate-900/50 border border-slate-700/60 rounded-2xl p-5 sm:p-7 backdrop-blur-xl shadow-2xl">
              <AuthPanel defaultTab="signup" />
            </div>
            <p className="text-center text-xs text-slate-600 mt-4 px-4">
              By continuing, you agree to RAVIQEN's security and compliance policies.
            </p>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 px-5 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>© 2026 RAVIQEN — AI Risk & Compliance Intelligence</span>
          <span>Build trust first • Investigate with evidence • Remediate with confidence</span>
        </div>
      </footer>
    </div>
  );
}