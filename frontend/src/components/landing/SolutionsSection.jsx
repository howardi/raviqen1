import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  UtensilsCrossed, Landmark, ShoppingBag, HeartPulse,
  Factory, Building2, ArrowRight, CheckCircle2,
} from "lucide-react";

const INDUSTRIES = [
  { icon: UtensilsCrossed, title: "Hospitality", lead: "See the full picture across your hotel or restaurant operations.", body: "Connect POS data, daily sales reports, payroll, procurement, and operational information in one intelligent layer. Gain greater visibility into daily activities while detecting revenue leakage, payroll fraud, unusual transactions, procurement irregularities, and control gaps." },
  { icon: Landmark, title: "Financial Services", lead: "Turn complex financial data into actionable intelligence.", body: "Centralise transaction and operational information, streamline reporting, and continuously monitor for AML risks, sanctions concerns, unusual transactions, and regulatory exceptions — with evidence ready for investigation and reporting." },
  { icon: ShoppingBag, title: "Retail", lead: "Bring visibility across every store, vendor, and transaction.", body: "Centralise operational and sales information while monitoring procurement, vendors, transactions, and supply chains for anomalies, fraud indicators, control gaps, and unusual activity." },
  { icon: HeartPulse, title: "Healthcare", lead: "Strengthen visibility and control across healthcare operations.", body: "Bring billing, procurement, vendor, and operational data together to identify billing anomalies, vendor compliance issues, unusual activity, and regulatory exceptions while streamlining reporting and investigations." },
  { icon: Factory, title: "Manufacturing", lead: "Connect operational data to stronger supply chain intelligence.", body: "Monitor procurement, vendors, transactions, and supply chain activity in one place. Identify anomalies, verify vendors, detect procurement risks, and gain greater visibility into operational controls." },
  { icon: Building2, title: "Government", lead: "Bring greater transparency and control to public sector operations.", body: "Centralise operational, procurement, grant, and financial information to improve reporting and visibility while identifying potential fraud, procurement irregularities, compliance gaps, and unusual activity." },
];

const OUTCOMES = [
  "Centralise business information across your key operations and systems",
  "Gain real-time visibility into daily business activities",
  "Streamline reporting and reduce manual reporting processes",
  "Detect anomalies before they escalate",
  "Reduce false positives with grounded AI",
  "Automate regulatory reporting",
  "Prioritise investigations by risk",
  "Screen vendors and counterparties in real time",
  "Build an auditable evidence trail",
  "Identify control gaps and operational exceptions",
  "Turn business data into clear, actionable intelligence",
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
            RAVIQEN adapts to your industry's unique operational and risk landscape — bringing critical business information together to improve visibility, streamline reporting, strengthen controls, and identify risk earlier. From hospitality POS and procurement monitoring to financial services AML compliance, retail vendor risk, healthcare billing, manufacturing supply chains, and government procurement, RAVIQEN turns complex business data into clear, actionable intelligence.
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
                <p className="text-sm text-slate-200 italic leading-relaxed">{ind.lead}</p>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{ind.body}</p>
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
          <h3 className="text-xl font-bold text-white">Find Your Industry's Risk</h3>
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