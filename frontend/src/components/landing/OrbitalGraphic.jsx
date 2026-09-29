import React from "react";
import { motion } from "framer-motion";
import {
  Search, ShieldCheck, TrendingUp, AlertTriangle,
  FileSearch, Database, Cpu, Network, Activity, Globe, Lock, BarChart3,
} from "lucide-react";

const ORBIT_1 = [
  { icon: Search, angle: 0 },
  { icon: ShieldCheck, angle: 60 },
  { icon: TrendingUp, angle: 120 },
  { icon: AlertTriangle, angle: 180 },
  { icon: FileSearch, angle: 240 },
  { icon: Database, angle: 300 },
];

const ORBIT_2 = [
  { icon: Cpu, angle: 30 },
  { icon: Network, angle: 90 },
  { icon: Activity, angle: 150 },
  { icon: Globe, angle: 210 },
  { icon: Lock, angle: 270 },
  { icon: BarChart3, angle: 330 },
];

const SIZE = 400;
const CENTER = SIZE / 2;
const R1 = 130;
const R2 = 180;

function pos(angle, r) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

export default function OrbitalGraphic() {
  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      {/* Glow background */}
      <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 w-full h-full">
        {/* Orbit rings */}
        <circle cx={CENTER} cy={CENTER} r={R1} fill="none" stroke="rgba(95,255,193,0.12)" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={R2} fill="none" stroke="rgba(95,255,193,0.08)" strokeWidth="1" />

        {/* Lines — orbit 1 */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        >
          {ORBIT_1.map((n, i) => {
            const p = pos(n.angle, R1);
            return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="rgba(95,255,193,0.12)" strokeWidth="1" />;
          })}
        </motion.g>

        {/* Lines — orbit 2 */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
        >
          {ORBIT_2.map((n, i) => {
            const p = pos(n.angle, R2);
            return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="rgba(95,255,193,0.08)" strokeWidth="1" />;
          })}
        </motion.g>
      </svg>

      {/* Orbit 1 nodes */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
      >
        {ORBIT_1.map((n, i) => {
          const p = pos(n.angle, R1);
          const Icon = n.icon;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%`, transform: "translate(-50%, -50%)" }}
            >
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center backdrop-blur-sm shadow-lg shadow-emerald-500/10"
              >
                <Icon className="w-5 h-5 text-emerald-400" />
              </motion.div>
            </div>
          );
        })}
      </motion.div>

      {/* Orbit 2 nodes */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0"
      >
        {ORBIT_2.map((n, i) => {
          const p = pos(n.angle, R2);
          const Icon = n.icon;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%`, transform: "translate(-50%, -50%)" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-400/20 flex items-center justify-center backdrop-blur-sm"
              >
                <Icon className="w-4 h-4 text-teal-300" />
              </motion.div>
            </div>
          );
        })}
      </motion.div>

      {/* Central AI node */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
        >
          <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-xl" />
          <span className="relative text-2xl font-bold text-[#0a0c10]">AI</span>
        </motion.div>
      </div>
    </div>
  );
}