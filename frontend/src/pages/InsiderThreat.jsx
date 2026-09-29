import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldAlert, Eye, Download, Clock, AlertTriangle, Activity, UserX } from "lucide-react";
import { analyzeSessionActivity, deriveSessionsFromAuditLogs, generateInsiderThreatNarrative } from "@/lib/insiderThreat";
import StatCard from "@/components/StatCard";
import RiskBadge from "@/components/RiskBadge";
import BackToTop from "@/components/BackToTop";

const THREAT_CONFIG = {
  normal: { label: "Normal", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  elevated: { label: "Elevated", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  suspicious: { label: "Suspicious", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  critical: { label: "Critical", classes: "bg-red-50 text-red-700 border-red-200" },
};

export default function InsiderThreat() {
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sessionData, logData] = await Promise.all([
          base44.entities.UserSession.list("-created_date", 50).catch(() => []),
          base44.entities.AuditLogEntry.list("-created_date", 100).catch(() => []),
        ]);
        setSessions(sessionData);
        setAuditLogs(logData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const analysis = useMemo(() => {
    const sessionData = sessions.length > 0 ? sessions : deriveSessionsFromAuditLogs(auditLogs);
    return analyzeSessionActivity(sessionData, auditLogs);
  }, [sessions, auditLogs]);

  useEffect(() => {
    if (!analysis || analysis.stats.total === 0) return;
    setNarrativeLoading(true);
    (async () => {
      try {
        const prompt = generateInsiderThreatNarrative({
          stats: analysis.stats,
          topThreats: analysis.threats,
          byUser: analysis.byUser,
        });
        const res = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              assessment: { type: "string" },
              threat_level: { type: "string", enum: ["stable", "elevated", "critical"] },
              recommendation: { type: "string" },
            },
          },
        });
        setNarrative(typeof res === "string" ? { assessment: res } : res);
      } catch {
        setNarrative(null);
      } finally {
        setNarrativeLoading(false);
      }
    })();
  }, [analysis]);

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
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insider Threat & Session Analytics</h1>
          <p className="text-sm text-slate-500">Behavioral monitoring of user sessions for anomalous access patterns</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sessions Analyzed" value={analysis.stats.total} icon={Activity} accent="blue" />
        <StatCard label="Normal Activity" value={analysis.stats.normal || 0} icon={Eye} accent="emerald" />
        <StatCard label="Suspicious Sessions" value={analysis.stats.suspicious || 0} icon={AlertTriangle} accent="amber" />
        <StatCard label="Critical Threats" value={analysis.stats.critical || 0} icon={UserX} accent="red" />
      </div>

      {narrative && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">AI Threat Assessment</h3>
            {narrative.threat_level && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${narrative.threat_level === "critical" ? "bg-red-100 text-red-700" : narrative.threat_level === "elevated" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {narrative.threat_level}
              </span>
            )}
          </div>
          {narrativeLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-amber-200/50 rounded animate-pulse" />
              <div className="h-3 bg-amber-200/50 rounded w-4/5 animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">{narrative.assessment}</p>
              {narrative.recommendation && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs font-semibold text-amber-700">Recommended Action:</p>
                  <p className="text-sm text-slate-600 mt-1">{narrative.recommendation}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Flagged Sessions ({analysis.threats.length})
          </h3>
          {analysis.threats.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No anomalous sessions detected</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysis.threats.map((t, i) => {
                const cfg = THREAT_CONFIG[t.threatLevel] || THREAT_CONFIG.normal;
                return (
                  <div key={i} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-800">{t.session.user_email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.classes}`}>{cfg.label}</span>
                    </div>
                    <div className="space-y-1">
                      {t.flags.map((flag, j) => (
                        <div key={j} className="flex items-start gap-2 text-xs text-slate-600">
                          <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(t.session.login_time).toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" />{t.session.bulk_exports || 0} exports</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-500" />
            High-Risk Users
          </h3>
          {analysis.byUser.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No user activity data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.byUser.slice(0, 10).map((u, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.email}</p>
                    <p className="text-xs text-slate-400">{u.sessions} sessions · {u.totalActions} actions · {u.totalExports} exports</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.flags > 0 && <RiskBadge level={u.flags >= 5 ? "critical" : u.flags >= 3 ? "high" : "medium"} size="sm" showIcon={false} />}
                    <span className="text-xs font-semibold text-slate-500">{u.flags} flags</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BackToTop />
    </div>
  );
}