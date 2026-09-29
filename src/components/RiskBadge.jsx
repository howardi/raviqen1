import React from "react";
import { Shield, ShieldAlert, ShieldX, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { riskLevelFromScore } from "@/lib/riskSeverity";

const config = {
  low: {
    label: "Low",
    icon: ShieldCheck,
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Medium",
    icon: Shield,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  high: {
    label: "High",
    icon: ShieldAlert,
    classes: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  critical: {
    label: "Critical",
    icon: ShieldX,
    classes: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export default function RiskBadge({ level = "low", score, showIcon = true, size = "default" }) {
  const resolvedLevel = Number.isFinite(Number(score)) ? riskLevelFromScore(score) : level;
  const c = config[resolvedLevel] || config.low;
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        c.classes,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
    >
      {showIcon && <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />}
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

export function RiskScoreRing({ score = 0, level = "low", size = 64 }) {
  const c = config[level] || config.low;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const colorMap = { low: "#10b981", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorMap[level] || "#10b981"}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-bold text-slate-800">{Math.round(score)}</span>
    </div>
  );
}