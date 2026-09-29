import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSourceTransaction, withoutReplayedTransaction, stableDocumentId } from '../scanConsistency.js';

const row = { transaction_id: ' INV-1 ', vendor: 'ACME', amount: 123, currency: 'NGN', transaction_date: '2026-01-01', source_filename: 'source.csv' };
test('replay does not count as new historical evidence', () => {
  assert.equal(sameSourceTransaction(row, { ...row, transaction_id: 'inv-1' }), true);
  assert.deepEqual(withoutReplayedTransaction(row, [{ ...row }, { ...row, amount: 124 }]), [{ ...row, amount: 124 }]);
  assert.equal(sameSourceTransaction(row, { ...row, source_filename: 'other.csv' }), false);
});
test('reference fallback is stable regardless of key ordering', () => {
  assert.equal(stableDocumentId({ vendor: 'A', amount: 12 }), stableDocumentId({ amount: 12, vendor: 'A' }));
  assert.notEqual(stableDocumentId({ vendor: 'A' }), stableDocumentId({ vendor: 'B' }));
});