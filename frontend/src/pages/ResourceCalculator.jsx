import React, { useState, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import { calculateResourceAllocation } from "@/lib/resourceAllocation";
import { Users, Droplet, Cross, Bed, Tent, SprayCan as Spray, Truck, DollarSign, Calculator, AlertTriangle, RotateCcw } from "lucide-react";

const RESOURCE_ICONS = {
  utensils: Users,
  droplet: Droplet,
  cross: Cross,
  bed: Bed,
  tent: Tent,
  spray: Spray,
};

const CRISIS_TYPES = [
  { value: "low", label: "Low — Early warning / monitoring", color: "bg-emerald-100 text-emerald-700" },
  { value: "moderate", label: "Moderate — Active displacement", color: "bg-amber-100 text-amber-700" },
  { value: "high", label: "High — Mass displacement / conflict", color: "bg-orange-100 text-orange-700" },
  { value: "critical", label: "Critical — Catastrophic / natural disaster", color: "bg-red-100 text-red-700" },
];

export default function ResourceCalculator() {
  const { toast } = useToast();
  const [population, setPopulation] = useState(50000);
  const [durationDays, setDurationDays] = useState(7);
  const [crisisSeverity, setCrisisSeverity] = useState("moderate");
  const [childrenPct, setChildrenPct] = useState(40);
  const [displacedPct, setDisplacedPct] = useState(100);
  const [saving, setSaving] = useState(false);

  const result = useMemo(
    () => calculateResourceAllocation({ population, durationDays, crisisSeverity, childrenPct, displacedPct }),
    [population, durationDays, crisisSeverity, childrenPct, displacedPct]
  );

  const handleReset = () => {
    setPopulation(50000);
    setDurationDays(7);
    setCrisisSeverity("moderate");
    setChildrenPct(40);
    setDisplacedPct(100);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-600" />
              Resource Allocation Calculator
            </h1>
            <p className="text-xs text-slate-500">
              Sphere-standard humanitarian logistics · Food, water, medical & shelter planning
            </p>
          </div>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-24">
            <h2 className="text-sm font-bold text-[#231F20] mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Crisis Zone Parameters
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Affected Population
                </label>
                <input
                  type="number"
                  value={population}
                  onChange={(e) => setPopulation(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  min="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">Total people in the crisis zone</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Duration (days)
                </label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Crisis Severity
                </label>
                <select
                  value={crisisSeverity}
                  onChange={(e) => setCrisisSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 bg-white"
                >
                  {CRISIS_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Children (% of population) — <span className="text-slate-400">{childrenPct}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={childrenPct}
                  onChange={(e) => setChildrenPct(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <p className="text-[10px] text-slate-400 mt-1">Children need 20% more food, 30% more water</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Displaced (% of population) — <span className="text-slate-400">{displacedPct}%</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={displacedPct}
                  onChange={(e) => setDisplacedPct(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Affected people</span>
                <span className="font-bold text-slate-800">{result.affectedPopulation.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Severity multiplier</span>
                <span className="font-bold text-slate-800">{result.multipliers.severity}x</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Duration factor</span>
                <span className="font-bold text-slate-800">{result.multipliers.duration.toFixed(2)}x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Total cost banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">Estimated Total Cost</span>
            </div>
            <p className="text-3xl font-bold">${result.totalCost.toLocaleString()}</p>
            <p className="text-xs opacity-80 mt-1">
              {durationDays}-day operation · {result.affectedPopulation.toLocaleString()} affected · {result.logistics.trucksPerDay} trucks/day needed
            </p>
          </div>

          {/* Resource cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.resources.map((res, i) => {
              const Icon = RESOURCE_ICONS[res.icon] || Users;
              return (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#231F20]">{res.name}</p>
                        <p className="text-[10px] text-slate-400">{res.category}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">${res.cost.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-slate-400 text-[10px]">Total needed</p>
                      <p className="font-bold text-slate-800">{res.total.toLocaleString()} {res.unit}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-slate-400 text-[10px]">Per day</p>
                      <p className="font-bold text-slate-800">{res.daily.toLocaleString()} {res.unit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Logistics summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-[#231F20] mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-600" />
              Logistics Requirements
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <Truck className="w-5 h-5 mx-auto text-slate-500 mb-1" />
                <p className="text-lg font-bold text-slate-800">{result.logistics.trucksPerDay}</p>
                <p className="text-[10px] text-slate-400">Trucks / day</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-800">{result.logistics.totalDeliveries}</p>
                <p className="text-[10px] text-slate-400">Total deliveries</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-800">{Math.round(result.totalCost / result.affectedPopulation || 0).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">Cost / person ($)</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg p-3">
                <p className="text-lg font-bold text-slate-800">{Math.round(result.totalCost / durationDays).toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">Cost / day ($)</p>
              </div>
            </div>
          </div>

          {/* Standards reference */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-800">
              <strong>Sphere Standards Applied:</strong> 2,100 kcal food/person/day · 15L water/person/day ·
              1 medical kit per 10,000 people · 1 shelter unit per family (5 persons) ·
              Severity and duration multipliers applied for crisis escalation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}