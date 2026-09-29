import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import MarketingNav from "@/components/landing/MarketingNav";
import MarketingFooter from "@/components/landing/MarketingFooter";
import { PLANS } from "@/lib/plans";

export default function Pricing() {
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
              Simple, <span className="text-emerald-400">Transparent</span> Pricing
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 text-base text-slate-400 max-w-2xl mx-auto"
            >
              Choose the plan that fits your organisation. Every tier starts with a paid plan —
              scale up as your team grows and your risk landscape evolves.
            </motion.p>
          </div>
        </section>

        {/* Pricing tiers */}
        <section className="px-5 sm:px-8 py-8 border-t border-slate-800/60">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PLANS.map((tier, i) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`relative flex flex-col rounded-xl border p-6 backdrop-blur-md ${
                    tier.highlight
                      ? "border-emerald-400/40 bg-emerald-500/[0.06]"
                      : "border-white/[0.08] bg-white/[0.04]"
                  }`}
                >
                  {tier.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-[10px] font-bold text-[#0a0c10] uppercase tracking-wide">
                        <Sparkles className="w-3 h-3" /> Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{tier.emoji}</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">{tier.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{tier.desc}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{tier.priceLabel}</span>
                    {tier.period && <span className="text-sm text-slate-500">{tier.period}</span>}
                  </div>

                  {tier.intro && (
                    <p className="mt-4 text-xs font-semibold text-slate-300">{tier.intro}</p>
                  )}

                  <ul className="mt-3 space-y-2.5 flex-1">
                    {tier.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-300">{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.cta.href ? (
                    <a
                      href={tier.cta.href}
                      className={`mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        tier.highlight
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      {tier.cta.label} <ArrowRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <Link
                      to={tier.cta.to}
                      className={`mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        tier.highlight
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                          : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      }`}
                    >
                      {tier.cta.label} <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ / note */}
        <section className="px-5 sm:px-8 py-12 border-t border-slate-800/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-bold text-white">Need a custom plan?</h2>
            <p className="mt-3 text-sm text-slate-400">
              Contact us to discuss custom integrations, on-premise deployment, and enterprise SLAs.
            </p>
            <Link
              to="/get-started"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Talk to Us <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}