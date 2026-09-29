import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import MarketingNav from "@/components/landing/MarketingNav";
import MarketingFooter from "@/components/landing/MarketingFooter";
import { PLANS, getPlanLimits } from "@/lib/plans";
import { useToast } from "@/components/ui/use-toast";

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const planId = urlParams.get("plan") || "starter";
  const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
  const limits = getPlanLimits(plan.id);
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async () => {
    setSubmitting(true);
    // Payment gateway wiring (Stripe) is the next step — for now we confirm
    // the selection and direct the user to sign up so the subscription is
    // recorded against their organization after onboarding.
    toast({
      title: "Plan selected",
      description: `Your ${plan.name} plan ($${plan.price}/mo) is ready. Complete your account to activate billing.`,
    });
    setTimeout(() => navigate("/get-started"), 800);
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        <section className="px-5 sm:px-8 py-12 lg:py-16">
          <div className="max-w-3xl mx-auto">
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to plans
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-md overflow-hidden"
            >
              <div className="p-6 sm:p-8 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{plan.emoji}</span>
                  <div>
                    <h1 className="text-xl font-bold text-white">{plan.name} Plan</h1>
                    <p className="text-sm text-slate-400">{plan.desc}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">{plan.priceLabel}</span>
                  {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Users</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {limits.max_users === null ? "Unlimited" : `Up to ${limits.max_users}`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Locations</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {limits.max_locations === null ? "Unlimited" : `Up to ${limits.max_locations}`}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Txns / mo</p>
                    <p className="text-sm font-semibold text-white mt-1">
                      {limits.max_transactions_per_month === null
                        ? "Unlimited"
                        : limits.max_transactions_per_month.toLocaleString()}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-300">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={handlePay}
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-60"
                >
                  {submitting ? (
                    "Redirecting..."
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Complete Subscription — {plan.priceLabel}
                      {plan.period}
                    </>
                  )}
                </button>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5" /> Secure checkout · Cancel anytime
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}