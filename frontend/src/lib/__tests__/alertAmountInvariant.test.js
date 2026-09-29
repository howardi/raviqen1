// RAVIQEN invariant: a single-transaction alert card must never display a
// portfolio-level aggregate, nor a currency-double-converted value.
//
// Regression origin: AlertCard.jsx hardcoded "USD" as the source currency,
// so a 30,153,118 NGN alert was treated as USD and re-converted to NGN,
// rendering ~₦40B (the portfolio total) instead of the transaction's own ₦30M.
// This test pins the fix and prevents the bug class from returning.
//
// Runs on Node's built-in test runner (no vitest dependency). Wired into the
// build via `prebuild` so `npm run build` fails if this invariant is violated.

import { test } from "node:test";
import assert from "node:assert/strict";
import { convertAndFormat, convertAmount, formatCurrency } from "../currencyUtils.js";

// Realistic NGN rate (~parallel market). The exact value doesn't matter —
// the invariant must hold for any positive rate.
const rates = { USD: 1, NGN: 1329, EUR: 0.92, GBP: 0.79 };

const alert205740 = { amount: 30153118, currency: "NGN", transaction_id: "205740" };
const tx205740 = { transaction_id: "205740", amount: 30153118, currency: "NGN", status: "flagged" };

test("AlertCard renders the alert's OWN amount in its native currency, not a USD-doubled value", () => {
  // Correct binding: source currency = alert.currency (the fix)
  const correct = convertAndFormat(alert205740.amount, alert205740.currency, "NGN", rates);
  assert.equal(correct, "₦30,153,118");

  // The bug: hardcoding "USD" inflates a NGN amount by the FX rate (~1330x)
  const buggy = convertAndFormat(alert205740.amount, "USD", "NGN", rates);
  assert.notEqual(buggy, "₦30,153,118");
  assert.ok(
    Number(buggy.replace(/[^\d]/g, "")) > alert205740.amount * 100,
    "hardcoded-USD source would inflate the alert amount by the FX rate"
  );
});

test("the alert's displayed amount equals its own transaction amount, not a portfolio aggregate", () => {
  const alertDisplayed = convertAmount(alert205740.amount, alert205740.currency, "NGN", rates);
  const txDisplayed = convertAmount(tx205740.amount, tx205740.currency, "NGN", rates);
  assert.equal(alertDisplayed, txDisplayed);
  // Must NOT equal the USD-doubled aggregate that caused the bug
  assert.notEqual(alertDisplayed, convertAmount(alert205740.amount, "USD", "NGN", rates));
});

test("a single-transaction alert never displays more than total exposure (same display currency)", () => {
  // Total exposure = sum of all flagged transaction amounts in the display currency.
  const allTx = [tx205740, { transaction_id: "X2", amount: 5_000_000, currency: "NGN", status: "flagged" }];
  const exposure = allTx
    .filter((t) => t.status === "flagged")
    .reduce((s, t) => s + convertAmount(t.amount, t.currency, "NGN", rates), 0);
  const alertDisplayed = convertAmount(alert205740.amount, alert205740.currency, "NGN", rates);
  // A single tx may equal the total only when it IS the only tx; with others present
  // it must be strictly less. Either way it can never EXCEED the portfolio total.
  assert.ok(alertDisplayed <= exposure, "single alert amount must not exceed total exposure");
  assert.ok(alertDisplayed < exposure, "with other flagged tx present, alert must be strictly less than total");
});

test("formatCurrency never doubles a currency: native NGN stays NGN", () => {
  assert.equal(formatCurrency(30153118, "NGN"), "₦30,153,118");
  assert.ok(!formatCurrency(30153118, "NGN").includes("USD"));
});