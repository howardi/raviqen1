import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  UtensilsCrossed, Landmark, ShoppingBag, HeartPulse,
  Factory, Building2, ArrowRight, CheckCircle2,
} from "lucide-react";

const INDUSTRIES = [
  { icon: UtensilsCrossed, title: "Hospitality", desc: "POS integration, daily reports, payroll fraud detection, and procurement monitoring for hotels and restaurants." },
  { icon: Landmark, title: "Financial Services", desc: "AML transaction monitoring, sanctions screening, SAR/STR generation, and regulatory reporting." },
  { icon: ShoppingBag, title: "Retail", desc: "Procurement fraud, vendor risk scoring, and supply chain anomaly detection across store networks." },
  { icon: HeartPulse, title: "Healthcare", desc: "Billing anomaly detection, vendor compliance, and regulatory adherence for healthcare providers." },
  { icon: Factory, title: "Manufacturing", desc: "Supply chain integrity, vendor verification, and procurement fraud monitoring." },
  { icon: Building2, title: "Government", desc: "Public sector fraud detection, grant monitoring, and procurement compliance." },
];

const OUTCOMES = [
  "Detect anomalies before they escalate",
  "Reduce false positives with grounded AI",
  "Automate regulatory reporting",
  "Prioritise investigations by risk",
  "Screen vendors and counterparties in real time",
  "Build an auditable evidence trail",
];

export default function SolutionsSection() {
  return (
    <section className="px-4 sm:px-8 py-12 lg:py-16 border-t border-slate-800/60">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="max-w-2xl mx-auto text-center mb-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl lg:text-4xl font-bold text-white"
          >
            Solutions for <span className="text-[#52d9a6]">Every Industry</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-sm text-slate-400"
          >
            RAVIQEN adapts to your industry's risk landscape — from hospitality POS fraud to
            financial services AML compliance and beyond.
          </motion.p>
        </div>

        {/* Industry grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {INDUSTRIES.map((ind, i) => {
            const Icon = ind.icon;
            return (
              <motion.div
                key={ind.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-xl bg-[#161616] border border-white/[0.06] p-6 hover:border-[#52d9a6]/30 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-[#52d9a6]/5 border border-[#1f362f] flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#52d9a6]" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{ind.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{ind.desc}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Outcomes */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-white mb-6 text-center">What RAVIQEN Delivers</h3>
          <div className="grid sm:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {OUTCOMES.map((outcome, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4"
              >
                <CheckCircle2 className="w-5 h-5 text-[#52d9a6] shrink-0" />
                <span className="text-sm text-slate-300">{outcome}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <h3 className="text-xl font-bold text-white">Find your industry's risk</h3>
          <p className="mt-2 text-sm text-slate-400">
            See how RAVIQEN adapts to your specific risk landscape.
          </p>
          <Link
            to="/get-started"
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}