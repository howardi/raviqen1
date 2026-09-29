import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchFxRates } from "./currencyUtils";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [displayCurrency, setDisplayCurrency] = useState(() =>
    localStorage.getItem("raviqen_display_currency") || "USD"
  );
  const [baseCurrency, setBaseCurrency] = useState(() =>
    localStorage.getItem("raviqen_base_currency") || "USD"
  );
  const [rates, setRates] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("raviqen_fx_rates") || "null");
      if (cached && cached.date === new Date().toDateString()) return cached.rates;
    } catch (e) { /* ignore */ }
    return { USD: 1 };
  });

  // Fetch live FX rates (cached daily) whenever the base currency changes
  useEffect(() => {
    (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem("raviqen_fx_rates") || "null");
        if (cached && cached.date === new Date().toDateString() && cached.rates) {
          setRates(cached.rates);
          return;
        }
      } catch (e) { /* ignore */ }
      const r = await fetchFxRates(baseCurrency);
      setRates(r);
      localStorage.setItem("raviqen_fx_rates", JSON.stringify({ rates: r, date: new Date().toDateString() }));
    })();
  }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem("raviqen_display_currency", displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    localStorage.setItem("raviqen_base_currency", baseCurrency);
  }, [baseCurrency]);

  return (
    <CurrencyContext.Provider value={{ displayCurrency, setDisplayCurrency, baseCurrency, setBaseCurrency, rates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      displayCurrency: "USD",
      setDisplayCurrency: () => {},
      baseCurrency: "USD",
      setBaseCurrency: () => {},
      rates: { USD: 1 },
    };
  }
  return ctx;
}