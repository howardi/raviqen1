// Insider Threat Detection — analyzes user sessions and audit logs for anomalous access patterns

const OFF_HOURS_START = 20; // 8 PM
const OFF_HOURS_END = 6; // 6 AM
const BULK_EXPORT_THRESHOLD = 5;
const HIGH_ACTION_THRESHOLD = 50;

export function analyzeSessionActivity(sessions, auditLogs) {
  if (!sessions || sessions.length === 0) {
    return { threats: [], stats: { total: 0, suspicious: 0, critical: 0 }, byUser: [] };
  }

  const threats = [];
  const userMap = {};

  sessions.forEach((s) => {
    const flags = [];
    const loginDate = new Date(s.login_time);
    const hour = loginDate.getHours();

    // Off-hours access
    if (hour >= OFF_HOURS_START || hour < OFF_HOURS_END) {
      flags.push(`Off-hours login at ${hour}:00`);
    }

    // Bulk exports
    if ((s.bulk_exports || 0) >= BULK_EXPORT_THRESHOLD) {
      flags.push(`${s.bulk_exports} bulk data exports in one session`);
    }

    // High action volume
    if ((s.actions_count || 0) > HIGH_ACTION_THRESHOLD) {
      flags.push(`Abnormal activity volume: ${s.actions_count} actions`);
    }

    // Long session
    if ((s.session_duration || 0) > 480) {
      flags.push(`Extended session: ${Math.round(s.session_duration / 60)}h`);
    }

    // New IP / location
    const userSessions = sessions.filter((x) => x.user_email === s.user_email);
    if (userSessions.length > 1) {
      const locations = new Set(userSessions.map((x) => x.ip_address));
      if (locations.size > 3) {
        flags.push(`Multiple IP addresses (${locations.size}) for same user`);
      }
    }

    const threatLevel = flags.length >= 3 ? "critical" : flags.length >= 2 ? "suspicious" : flags.length >= 1 ? "elevated" : "normal";

    if (threatLevel !== "normal") {
      threats.push({
        session: s,
        flags,
        threatLevel,
        score: Math.min(100, flags.length * 25 + (s.bulk_exports || 0) * 5),
      });
    }

    if (!userMap[s.user_email]) {
      userMap[s.user_email] = { email: s.user_email, name: s.user_name, sessions: 0, totalActions: 0, totalExports: 0, flags: 0 };
    }
    userMap[s.user_email].sessions++;
    userMap[s.user_email].totalActions += s.actions_count || 0;
    userMap[s.user_email].totalExports += s.bulk_exports || 0;
    userMap[s.user_email].flags += flags.length;
  });

  // Cross-reference audit logs for data exfiltration patterns
  if (auditLogs && auditLogs.length > 0) {
    const exportActions = auditLogs.filter((l) =>
      l.action?.toLowerCase().includes("export") ||
      l.action?.toLowerCase().includes("download") ||
      l.action?.toLowerCase().includes("bulk")
    );
    const byUserExports = {};
    exportActions.forEach((e) => {
      const key = e.user || "unknown";
      byUserExports[key] = (byUserExports[key] || 0) + 1;
    });
    Object.entries(byUserExports).forEach(([user, count]) => {
      if (count >= BULK_EXPORT_THRESHOLD && userMap[user]) {
        userMap[user].flags += count;
      }
    });
  }

  const byUser = Object.values(userMap).sort((a, b) => b.flags - a.flags);
  const suspicious = threats.filter((t) => t.threatLevel === "suspicious" || t.threatLevel === "critical").length;
  const critical = threats.filter((t) => t.threatLevel === "critical").length;

  return {
    threats: threats.sort((a, b) => b.score - a.score),
    stats: { total: sessions.length, suspicious, critical, normal: sessions.length - threats.length },
    byUser,
  };
}

export function generateInsiderThreatNarrative({ stats, topThreats, byUser }) {
  const prompt = `You are RAVIQEN, an insider threat detection AI. Analyze the following session activity data and generate a concise threat assessment.

Session Statistics:
- Total sessions analyzed: ${stats.total}
- Normal sessions: ${stats.normal}
- Suspicious sessions: ${stats.suspicious}
- Critical threat sessions: ${stats.critical}

Top Threat Indicators:
${(topThreats || []).slice(0, 5).map((t, i) => `${i + 1}. ${t.session.user_email} — ${t.threatLevel.toUpperCase()} (score ${t.score}): ${t.flags.join(", ")}`).join("\n") || "None"}

High-Risk Users:
${(byUser || []).slice(0, 5).map((u, i) => `${i + 1}. ${u.email}: ${u.sessions} sessions, ${u.totalActions} actions, ${u.totalExports} exports, ${u.flags} risk flags`).join("\n") || "None"}

Write a 2-3 sentence insider threat assessment that identifies the primary risk vectors, names specific users if critical, and recommends one immediate containment action. Use a professional, security-focused tone.`;

  return prompt;
}

// Generate synthetic session data from audit logs when no UserSession records exist
export function deriveSessionsFromAuditLogs(auditLogs) {
  if (!auditLogs || auditLogs.length === 0) return [];

  const byUser = {};
  auditLogs.forEach((log) => {
    const key = log.user || "unknown";
    if (!byUser[key]) {
      byUser[key] = {
        user_email: key,
        user_name: key,
        login_time: log.created_date || new Date().toISOString(),
        ip_address: log.ip_address || "unknown",
        actions_count: 0,
        bulk_exports: 0,
        risk_flags: [],
      };
    }
    byUser[key].actions_count++;
    if (log.action?.toLowerCase().includes("export") || log.action?.toLowerCase().includes("download")) {
      byUser[key].bulk_exports++;
    }
  });

  return Object.values(byUser).map((s) => ({
    ...s,
    session_duration: Math.round(s.actions_count * 0.5),
    logout_time: null,
    location: "Unknown",
    device: "Unknown",
  }));
}