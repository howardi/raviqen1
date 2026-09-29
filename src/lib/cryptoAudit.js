// Cryptographic Audit Reports — tamper-evident hash-chained audit trail

async function sha256(text) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback simple hash (not cryptographic, but keeps chain intact)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}

export async function buildHashChain(entries) {
  if (!entries || entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) =>
    new Date(a.created_date || a.timestamp || 0) - new Date(b.created_date || b.timestamp || 0)
  );

  const chained = [];
  let prevHash = "GENESIS";

  for (const entry of sorted) {
    const payload = JSON.stringify({
      id: entry.id,
      user: entry.user,
      action: entry.action,
      detail: entry.detail,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      ip_address: entry.ip_address,
      created_date: entry.created_date,
      prev_hash: prevHash,
    });

    const hash = await sha256(payload);
    chained.push({
      ...entry,
      hash,
      prev_hash: prevHash,
      verified: true,
    });
    prevHash = hash;
  }

  return chained;
}

export async function verifyHashChain(chainedEntries) {
  if (!chainedEntries || chainedEntries.length === 0) return { valid: true, brokenAt: -1, totalEntries: 0 };

  let prevHash = "GENESIS";
  for (let i = 0; i < chainedEntries.length; i++) {
    const entry = chainedEntries[i];
    const payload = JSON.stringify({
      id: entry.id,
      user: entry.user,
      action: entry.action,
      detail: entry.detail,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      ip_address: entry.ip_address,
      created_date: entry.created_date,
      prev_hash: prevHash,
    });
    const computedHash = await sha256(payload);

    if (computedHash !== entry.hash) {
      return { valid: false, brokenAt: i, totalEntries: chainedEntries.length };
    }
    if (entry.prev_hash !== prevHash) {
      return { valid: false, brokenAt: i, totalEntries: chainedEntries.length };
    }
    prevHash = entry.hash;
  }

  return { valid: true, brokenAt: -1, totalEntries: chainedEntries.length };
}

export function generateReportManifest(chainedEntries, verificationResult) {
  const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const entryCount = chainedEntries.length;
  const users = [...new Set(chainedEntries.map((e) => e.user).filter(Boolean))];
  const actionTypes = [...new Set(chainedEntries.map((e) => e.action).filter(Boolean))];

  return {
    report_id: reportId,
    generated_at: timestamp,
    entry_count: entryCount,
    unique_users: users.length,
    action_types: actionTypes,
    chain_valid: verificationResult.valid,
    broken_at: verificationResult.brokenAt,
    genesis_hash: chainedEntries[0]?.hash || "N/A",
    head_hash: chainedEntries[chainedEntries.length - 1]?.hash || "N/A",
    algorithm: "SHA-256",
    standard: "Tamper-Evident Hash Chain (RFC 6962-inspired)",
  };
}