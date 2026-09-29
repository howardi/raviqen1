import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Radar, Loader, Calendar, ExternalLink, AlertTriangle, CheckCircle, FileWarning, Sparkles } from "lucide-react";
import { scanRegulatoryHorizon, analyzeRegulatoryImpact, CATEGORY_CONFIG, IMPACT_CONFIG, STATUS_CONFIG } from "@/lib/regulatoryHorizon";
import StatCard from "@/components/StatCard";
import BackToTop from "@/components/BackToTop";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { stampTenant } from "@/lib/tenantScope";

export default function RegulatoryHorizon() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.RegulatoryUpdate.list("-created_date", 30).catch(() => []);
        setUpdates(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const results = await scanRegulatoryHorizon(["US", "EU", "UK", "Global", "APAC"]);
      // Persist to database
      for (const update of results) {
        await base44.entities.RegulatoryUpdate.create(stampTenant(update, user)).catch(() => {});
      }
      setUpdates((prev) => [...results, ...prev]);
      toast({
        title: "Horizon Scan Complete",
        description: `${results.length} regulatory updates discovered`,
      });
    } catch (err) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyze = async (update) => {
    setAnalyzing(update.id || update.title);
    try {
      const analyzed = await analyzeRegulatoryImpact(update, {
        coverage: "Transaction monitoring, KYC/KYB, Sanctions screening, Regulatory reporting",
      });
      if (update.id) {
        await base44.entities.RegulatoryUpdate.update(update.id, {
          ai_analysis: analyzed.ai_analysis,
          status: "assessing",
        });
      }
      setUpdates((prev) =>
        prev.map((u) => (u.id === update.id ? { ...u, ai_analysis: analyzed.ai_analysis, status: "assessing" } : u))
      );
      toast({ title: "Impact analysis complete", description: update.title });
    } catch (err) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  };

  const filteredUpdates = selectedCategory === "all"
    ? updates
    : updates.filter((u) => u.category === selectedCategory);

  const stats = {
    total: updates.length,
    critical: updates.filter((u) => u.impact_level === "critical").length,
    actionRequired: updates.filter((u) => u.status === "action_required").length,
    compliant: updates.filter((u) => u.status === "compliant").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
          <Radar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Regulatory Horizon Scanning</h1>
          <p className="text-sm text-slate-500">Monitor upcoming regulatory changes and assess compliance impact with AI</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Updates" value={stats.total} icon={FileWarning} accent="blue" />
        <StatCard label="Critical Impact" value={stats.critical} icon={AlertTriangle} accent="red" />
        <StatCard label="Action Required" value={stats.actionRequired} icon={AlertTriangle} accent="orange" />
        <StatCard label="Compliant" value={stats.compliant} icon={CheckCircle} accent="emerald" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {scanning ? <><Loader className="w-4 h-4 animate-spin" /> Scanning Horizons...</> : <><Radar className="w-4 h-4" /> Scan for Regulatory Updates</>}
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Filter:</span>
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn("text-xs px-3 py-1.5 rounded-full transition-colors", selectedCategory === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            All
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn("text-xs px-3 py-1.5 rounded-full transition-colors", selectedCategory === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredUpdates.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No regulatory updates found. Click "Scan for Regulatory Updates" to search the web.</p>
          </div>
        ) : (
          filteredUpdates.map((update, i) => {
            const catCfg = CATEGORY_CONFIG[update.category] || CATEGORY_CONFIG.other;
            const impactCfg = IMPACT_CONFIG[update.impact_level] || IMPACT_CONFIG.medium;
            const statusCfg = STATUS_CONFIG[update.status] || STATUS_CONFIG.new;
            return (
              <div key={update.id || i} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-slate-800">{update.title}</h4>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", catCfg.classes)}>{catCfg.label}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", impactCfg.classes)}>{impactCfg.label} Impact</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", statusCfg.classes)}>{statusCfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {update.jurisdiction} · {update.regulator || "Unknown regulator"}
                      {update.effective_date && (
                        <span className="flex items-center gap-1 ml-2 inline-flex">
                          <Calendar className="w-3 h-3" />
                          Effective: {update.effective_date === "TBD" ? "TBD" : new Date(update.effective_date).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  {update.source_url && (
                    <a href={update.source_url} target="_blank" rel="noreferrer" className="text-violet-600 hover:text-violet-700 shrink-0 ml-2">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <p className="text-sm text-slate-600 mb-3">{update.summary}</p>

                {update.affected_areas && update.affected_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {update.affected_areas.map((area, j) => (
                      <span key={j} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{area}</span>
                    ))}
                  </div>
                )}

                {update.required_actions && update.required_actions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-slate-600 mb-1">Required Actions:</p>
                    <ul className="space-y-1">
                      {update.required_actions.map((action, j) => (
                        <li key={j} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-violet-500 mt-0.5">▸</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {update.ai_analysis ? (
                  <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-violet-700 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Impact Analysis:
                    </p>
                    <p className="text-sm text-slate-700">{update.ai_analysis}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAnalyze(update)}
                    disabled={analyzing === (update.id || update.title)}
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50 transition-colors"
                  >
                    {analyzing === (update.id || update.title) ? <><Loader className="w-3 h-3 animate-spin" /> Analyzing...</> : <><Sparkles className="w-3 h-3" /> Analyze Compliance Impact</>}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <BackToTop />
    </div>
  );
}