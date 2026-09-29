import React from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { getRoleHomeRoute } from "@/lib/permissions";
import NewsTicker from "@/components/landing/NewsTicker";
import LiveInfoBar from "@/components/landing/LiveInfoBar";
import HeroSection from "@/components/landing/HeroSection";
import OrbitalGraphic from "@/components/landing/OrbitalGraphic";
import SolutionsSection from "@/components/landing/SolutionsSection";
import MarketingNav from "@/components/landing/MarketingNav";
import { Image } from "@/components/ui/image";

export default function Landing() {
  const { user, isLoadingAuth } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const isPreview = urlParams.get("preview") === "true";

  // Redirect logged-in users to their role-based dashboard (unless previewing)
  if (!isLoadingAuth && user && !isPreview) {
    return <Navigate to={getRoleHomeRoute(user)} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col overflow-x-hidden">
      {/* Nav header */}
      <MarketingNav />

      {/* Weekly live news ticker */}
      <NewsTicker />

      {/* Live visitor greeting + weather + clock */}
      <LiveInfoBar />

      {/* Hero section — split layout */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 lg:py-16">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="order-1"
          >
            <HeroSection />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-lg mx-auto order-2"
          >
            <OrbitalGraphic />
          </motion.div>
        </div>
      </main>

      {/* Lower section — One intelligent layer */}
      <section className="px-4 sm:px-8 py-10 lg:py-16 border-t border-slate-800/60">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white">
              One intelligent layer. Total visibility. Smarter decisions.
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-md">
              RAVIQEN works above the systems you already use, turning thousands of daily
              transactions and business activities into clear, prioritised risk insights.
            </p>
            <p className="mt-3 text-sm font-bold text-emerald-400 tracking-wide">
              Detect. Prioritise. Act.
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-6 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 rounded-2xl overflow-hidden border border-slate-700/40 shadow-2xl">
              <Image
                src="https://media.base44.com/images/public/6a90b256868de35f9bd5d6b1/39be2756b_generated_image.png"
                alt="RAVIQEN — 3D isometric intelligent layer visualization"
                fittingType="fit"
                className="w-full aspect-[4/3]"
              />
            </div>
            <p className="text-center text-xs text-slate-500 mt-4 px-4">
              The intelligent layer above your systems — detecting risk, surfacing anomalies, prioritising action.
            </p>
          </div>
        </div>
      </section>

      {/* Solutions for every industry */}
      <SolutionsSection />

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>© 2026 RAVIQEN — AI Risk & Compliance Intelligence</span>
          <span>Build trust first • Investigate with evidence • Remediate with confidence</span>
        </div>
      </footer>
    </div>
  );
}