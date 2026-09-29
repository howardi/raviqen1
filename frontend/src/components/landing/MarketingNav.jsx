import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import { useCompanyProfile } from "@/lib/CompanyProfileContext";

const RAVIQEN_LOGO_URL = "https://media.base44.com/images/public/6a90b256868de35f9bd5d6b1/da89a92c0_Raviqen.jpeg";

const NAV_LINKS = [
  { label: "Pricing", path: "/pricing" },
  { label: "About", path: "/about" },
];

export default function MarketingNav() {
  const { profile } = useCompanyProfile();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const logoUrl = profile?.logo_url || RAVIQEN_LOGO_URL;
  const logoAlt = profile?.company_name || "RAVIQEN — AI Risk & Compliance Intelligence";

  return (
    <header className="sticky top-0 z-40 bg-[#0a0c10]/95 backdrop-blur-sm border-b border-slate-800/60">
      <div className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4">
        <Link to="/" onClick={() => setOpen(false)}>
          <img
            src={logoUrl}
            alt={logoAlt}
            className="h-8 sm:h-10 w-auto object-contain rounded-md p-1 bg-white shadow-sm"
          />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`transition-colors ${location.pathname === link.path ? "text-white" : "hover:text-white"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/get-started"
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign up <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setOpen((p) => !p)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-white/5 transition-colors"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-slate-800/60 px-4 py-3 flex flex-col gap-1 bg-[#0a0c10]">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === link.path ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/get-started"
            onClick={() => setOpen(false)}
            className="sm:hidden mt-1 px-3 py-2.5 rounded-lg text-sm text-white bg-white/5 border border-white/10 text-center"
          >
            Log in
          </Link>
          <Link
            to="/register"
            onClick={() => setOpen(false)}
            className="sm:hidden mt-1 px-3 py-2.5 rounded-lg text-sm text-white font-semibold text-center bg-gradient-to-r from-emerald-500 to-teal-500"
          >
            Sign up
          </Link>
        </nav>
      )}
    </header>
  );
}