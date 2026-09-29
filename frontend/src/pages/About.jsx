import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ShieldCheck, FileSearch, TrendingUp, ArrowRight, Target, Eye } from "lucide-react";
import MarketingNav from "@/components/landing/MarketingNav";
import MarketingFooter from "@/components/landing/MarketingFooter";

const VALUES = [
  { icon: ShieldCheck, title: "Trust First", desc: "We build trust through transparency, evidence, and accuracy in everything we do." },
  { icon: FileSearch, title: "Evidence-Based", desc: "Every alert, investigation, and recommendation is grounded in cited evidence." },
  { icon: TrendingUp, title: "Act Earlier", desc: "We help teams see risk before it becomes a problem — not after." },
];

const STATS = [
  { value: "24/7", label: "Autonomous Monitoring" },
  { value: "100%", label: "Data Integrity" },
  { value: "30+", label: "Platform Modules" },
  { value: "AI", label: "Risk Detection" },
];

export default function About() {
  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 sm:px-8 py-16 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6"
            >
              <Eye className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">See Risk. Act Earlier.</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl lg:text-5xl font-bold text-white"
            >
              About <span className="text-emerald-400">RAVIQEN</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 text-base text-slate-400 max-w-2xl mx-auto"
            >
              We build the intelligent layer that sits above your business systems — turning
              thousands of daily transactions into clear, prioritised risk insight.
            </motion.p>
          </div>
        </section>

        {/* Mission */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-3xl mx-auto text-center">
            <Target className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Our Mission</h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed">
              Every business collects data. Most can't see the risk hidden inside it. RAVIQEN
              exists to change that — giving teams the intelligence to detect anomalies, investigate
              with evidence, and remediate with confidence. We believe risk should be seen early,
              understood clearly, and acted on decisively.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {STATS.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="relative rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md p-4 text-center overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  <p className="text-2xl font-bold text-white relative">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1 relative">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Our Values</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {VALUES.map((val, i) => {
                const Icon = val.icon;
                return (
                  <motion.div
                    key={val.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md p-6"
                  >
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{val.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{val.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 sm:px-8 py-16 border-t border-slate-800/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white">Join the RAVIQEN vision</h2>
            <p className="mt-3 text-sm text-slate-400">
              Start seeing your risk earlier. Build trust through evidence.
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