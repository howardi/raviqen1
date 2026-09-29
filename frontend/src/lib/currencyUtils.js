// Currency metadata — add more currencies here to extend support
export const CURRENCY_META = {
  USD: { symbol: "$", label: "USD - US Dollar" },
  EUR: { symbol: "€", label: "EUR - Euro" },
  GBP: { symbol: "£", label: "GBP - British Pound" },
  NGN: { symbol: "₦", label: "NGN - Nigerian Naira" },
  JPY: { symbol: "¥", label: "JPY - Japanese Yen" },
  CAD: { symbol: "C$", label: "CAD - Canadian Dollar" },
  AUD: { symbol: "A$", label: "AUD - Australian Dollar" },
  INR: { symbol: "₹", label: "INR - Indian Rupee" },
  ZAR: { symbol: "R", label: "ZAR - South African Rand" },
  GHS: { symbol: "₵", label: "GHS - Ghanaian Cedi" },
  KES: { symbol: "KSh", label: "KES - Kenyan Shilling" },
  EGP: { symbol: "E£", label: "EGP - Egyptian Pound" },
};

// Fallback rates (relative to USD) used if the live API is unreachable
const FALLBACK_RATES = {
  USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1600, JPY: 155, CAD: 1.36, AUD: 1.52, INR: 83,
  ZAR: 18.5, GHS: 15.5, KES: 129, EGP: 48.5,
};

// Fetch live FX rates from the free, no-key open.er-api.com endpoint.
// Rates are returned relative to the base currency (e.g. rates.EUR = EUR per 1 USD).
export async function fetchFxRates(baseCurrency = "USD") {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    const data = await res.json();
    if (data && data.rates) return data.rates;
  } catch (e) {
    console.error("FX rate fetch failed, using fallback rates", e);
  }
  return FALLBACK_RATES;
}

// Convert an amount from one currency to another using USD-based rates
export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!amount || fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

// Format a number as a currency string using the localized symbol (Format A).
// Recognized code   -> "₦30,153,118"
// Unrecognized code -> "30,153,118 XYZ"  (raw amount + provided code, no default symbol)
// Missing code      -> "30,153,118 [Unknown Code]"
export function formatCurrency(amount, currency = "") {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
  const code = (currency || "").toUpperCase().trim();
  if (code && CURRENCY_META[code]) return `${CURRENCY_META[code].symbol}${num}`;
  if (code) return `${num} ${code}`;
  return `${num} [Unknown Code]`;
}

// Format a number with the ISO code suffix (Format B): "30,153,118 NGN".
export function formatCurrencyISO(amount, currency = "") {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n));
  const code = (currency || "").toUpperCase().trim();
  if (code) return `${num} ${code}`;
  return `${num} [Unknown Code]`;
}

// Unified single-indicator formatter. style: "symbol" (default, Format A) | "code" (Format B).
// Never emits both a symbol and an ISO code for the same value.
export function formatMoney(amount, currency, { style = "symbol" } = {}) {
  return style === "code" ? formatCurrencyISO(amount, currency) : formatCurrency(amount, currency);
}

// Compact format with K/M suffixes (e.g. ₦324.9K). Same fallback rules as formatCurrency.
export function formatCompact(amount, currency = "") {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (isNaN(n)) return "—";
  const abs = Math.abs(n);
  let str;
  if (abs >= 1e6) str = (n / 1e6).toFixed(1) + "M";
  else if (abs >= 1e3) str = (n / 1e3).toFixed(1) + "K";
  else str = Math.round(n).toString();
  const code = (currency || "").toUpperCase().trim();
  if (code && CURRENCY_META[code]) return `${CURRENCY_META[code].symbol}${str}`;
  if (code) return `${str} ${code}`;
  return `${str} [Unknown Code]`;
}

// Convert and format in the target currency
export function convertAndFormat(amount, fromCurrency, toCurrency, rates) {
  const converted = convertAmount(amount, fromCurrency, toCurrency, rates);
  return formatCurrency(converted, toCurrency);
}

// Show original currency alongside converted value when they differ
// e.g. "€12,500 (~$13,480)" — original first, converted in parens
export function formatWithOriginal(amount, originalCurrency, displayCurrency, rates) {
  if (!originalCurrency || originalCurrency === displayCurrency) {
    return formatCurrency(amount, displayCurrency);
  }
  const converted = convertAmount(amount, originalCurrency, displayCurrency, rates);
  return `${formatCurrency(amount, originalCurrency)} (~${formatCurrency(converted, displayCurrency)})`;
}