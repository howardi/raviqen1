// A replay of the same source transaction is not new historical evidence.
// Different amounts, dates or vendors with the same reference remain reviewable.
export function sameSourceTransaction(a, b) {
  if (!a?.transaction_id || !b?.transaction_id) return false;
  return !!a.source_filename && a.source_filename === b.source_filename
    && String(a.transaction_id).trim().toLowerCase() === String(b.transaction_id).trim().toLowerCase()
    && String(a.vendor || '').trim().toLowerCase() === String(b.vendor || '').trim().toLowerCase()
    && Number(a.amount) === Number(b.amount)
    && String(a.currency || '').toUpperCase() === String(b.currency || '').toUpperCase()
    && String(a.transaction_date || '') === String(b.transaction_date || '');
}

export function withoutReplayedTransaction(record, historical) {
  return historical.filter((prior) => !sameSourceTransaction(record, prior));
}

// Used only for documents without a source reference. Stable across rescans,
// even when the source parser returns object keys in a different order.
export function stableDocumentId(record) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
      : value;
  const text = JSON.stringify(canonical(record)) || '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `DOC-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}