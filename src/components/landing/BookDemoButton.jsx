import React, { useState, useRef, useEffect } from "react";
import { Calendar, Mail, ChevronDown } from "lucide-react";

const SUBJECT = "Book a RAVIQEN Demo";
const BODY = "I'd like to book a demo of RAVIQEN. Please contact me with available time slots.";
const TO = "support@raviqen.com";

const PROVIDERS = [
  { id: "gmail", label: "Gmail", url: (to, sub, body) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}` },
  { id: "outlook", label: "Outlook (Web)", url: (to, sub, body) => `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}` },
  { id: "outlook_desktop", label: "Outlook (Desktop)", url: (to, sub, body) => `mailto:${to}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}` },
  { id: "yahoo", label: "Yahoo Mail", url: (to, sub, body) => `https://compose.mail.yahoo.com/?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}` },
  { id: "default", label: "Default Mail App", url: (to, sub, body) => `mailto:${to}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}` },
];

export default function BookDemoButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/[0.05] border border-white/15 text-white text-sm font-semibold hover:bg-white/[0.1] transition-all min-h-[44px] w-full sm:w-auto"
      >
        <Calendar className="w-4 h-4" />
        Book a Demo
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 sm:left-0 w-60 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/60">
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Choose your email provider
            </p>
          </div>
          {PROVIDERS.map((p) => (
            <a
              key={p.id}
              href={p.url(TO, SUBJECT, BODY)}
              target={p.id === "gmail" || p.id === "outlook" || p.id === "yahoo" ? "_blank" : undefined}
              rel={p.id === "gmail" || p.id === "outlook" || p.id === "yahoo" ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors"
            >
              {p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}