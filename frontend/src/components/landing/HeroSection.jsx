import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, Clock, Cpu, Layers, ShieldCheck } from "lucide-react";
import BookDemoButton from "@/components/landing/BookDemoButton";

const STATS = [
  { value: "24/7", label: "Autonomous Monitoring", detail: "Continuously monitors business activity and operational data.", icon: Clock },
  { value: "360°", label: "Business Visibility", detail: "Centralises critical information for a clearer view of your business.", icon: Eye },
  { value: "AI", label: "Risk & Anomaly Detection", detail: "Identifies unusual activity, control gaps, and emerging risks.", icon: Cpu },
  { value: "1", label: "Intelligent Layer", detail: "One intelligent layer connecting your business information, reporting, operations, and risk intelligence.", icon: Layers },
];

export default function HeroSection() {
  return (
    <div className="relative overflow-hidden">
      {/* Floating background orbs */}
      <motion.div
        className="absolute top-10 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"
        animate={{ y: [0, -30, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        animate={{ y: [0, 40, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-300">AI-Powered Risk & Compliance Intelligence</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight"
        >
          <span className="text-white">SEE</span>{" "}
          <span className="text-emerald-400">RISK.</span>
          <br />
          <span className="text-white">ACT</span>{" "}
          <span className="text-emerald-400">EARLIER.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-sm md:text-base text-slate-300 leading-relaxed max-w-xl"
        >
          <span className="text-white font-medium">AI-powered intelligence for smarter business control.</span>{" "}
          RAVIQEN brings your business information and daily operations into one intelligent platform, helping you centralise information, streamline reporting, and gain greater visibility into your business activities.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-3 text-sm md:text-base text-slate-300 leading-relaxed max-w-xl"
        >
          RAVIQEN continuously analyses your business data to identify unusual transactions, control gaps, procurement irregularities, financial anomalies, operational exceptions, and other potential risks — giving your team the insight they need to know what requires attention, where it matters, and when to act.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-3 text-sm text-emerald-300 font-medium italic max-w-xl"
        >
          Turn business data into clearer visibility, stronger controls, and smarter decisions.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 flex flex-col sm:flex-row gap-3"
        >
          <Link
            to="/get-started"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 min-h-[44px]"
          >
            Start with RAVIQEN
            <ArrowRight className="w-4 h-4" />
          </Link>
          <BookDemoButton />
        </motion.div>

        {/* Stats — flex row that wraps to 2x2 on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-7 grid grid-cols-2 gap-2.5 sm:gap-3 max-w-xl"
        >
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="relative rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md p-3 overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <Icon className="w-4 h-4 text-emerald-400 mb-2 relative" />
                <p className="text-xl font-bold text-white relative">{stat.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium relative">{stat.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug mt-1.5 relative">{stat.detail}</p>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-6 flex items-center gap-2 text-xs text-slate-500"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>New accounts start as Pending — your Super Admin assigns roles after verification</span>
        </motion.div>
      </div>
    </div>
  );
}