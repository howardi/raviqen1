import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Cpu, Search, Network, ShieldCheck, FileSearch, Users,
  Gauge, BarChart3, ArrowRight, Layers, AlertTriangle, TrendingUp,
} from "lucide-react";
import MarketingNav from "@/components/landing/MarketingNav";
import MarketingFooter from "@/components/landing/MarketingFooter";

const MODULES = [
  { icon: Cpu, title: "Autonomous Engine", desc: "24/7 AI scanning that ingests, screens, and triages every transaction automatically." },
  { icon: FileSearch, title: "AI Investigations", desc: "Guided 5-step wizard with grounded AI explanations, recommendations, and similarity detection." },
  { icon: Network, title: "Entity Intelligence", desc: "Counterparty profiles with baseline behaviour, risk scoring, and anomaly detection." },
  { icon: ShieldCheck, title: "Sanctions Screening", desc: "Real-time sanctions, PEP, and adverse media checks during onboarding and ingestion." },
  { icon: Users, title: "Vendor Verification", desc: "KYB workflows with questionnaire automation and beneficial ownership mapping." },
  { icon: Gauge, title: "Risk Rules Engine", desc: "Custom threshold and pattern rules tailored to your organisation's risk appetite." },
  { icon: BarChart3, title: "Analytics & Reporting", desc: "Executive dashboards, regulatory reports, and exportable briefings in one click." },
  { icon: Search, title: "OSINT Scanner", desc: "Open-source intelligence enrichment for deeper entity and adverse media context." },
];

const LAYERS = [
  { icon: Layers, title: "Ingestion Layer", desc: "Connect POS systems, ERP data, payroll, and manual uploads — RAVIQEN ingests it all." },
  { icon: AlertTriangle, title: "Detection Layer", desc: "AI models scan every record for anomalies, policy breaches, and risk patterns in real time." },
  { icon: TrendingUp, title: "Intelligence Layer", desc: "Grounded explanations, prioritised alerts, and recommended actions — so your team knows what to do next." },
];

export default function Platform() {
  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 sm:px-8 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl lg:text-5xl font-bold text-white"
            >
              The <span className="text-emerald-400">RAVIQEN</span> Platform
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 text-base text-slate-400 max-w-2xl mx-auto"
            >
              One intelligent layer above your business systems — autonomously detecting risk,
              surfacing anomalies, and prioritising action across your entire operation.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-8"
            >
              <Link
                to="/get-started"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all"
              >
                Start with RAVIQEN <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Three layers */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {LAYERS.map((layer, i) => {
                const Icon = layer.icon;
                return (
                  <motion.div
                    key={layer.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md p-6"
                  >
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{layer.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{layer.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Module grid */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Platform Modules</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {MODULES.map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <motion.div
                    key={mod.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md p-5 hover:border-emerald-400/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{mod.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{mod.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 sm:px-8 py-16 border-t border-slate-800/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white">Ready to see your risk?</h2>
            <p className="mt-3 text-sm text-slate-400">
              Start with RAVIQEN today and let AI find the risk your systems collect.
            </p>
            <Link
              to="/get-started"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}