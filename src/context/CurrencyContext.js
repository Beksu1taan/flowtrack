import { createContext, useContext, useEffect, useState } from "react";

const CurrencyContext = createContext();

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencyProvider({ children }) {

  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem("currency") || "USD";
  });

  useEffect(() => {
    localStorage.setItem("currency", currency);
  }, [currency]);

  const getSymbol = () => {
    if (currency === "USD") return "$";
    if (currency === "KZT") return "₸";
    if (currency === "EUR") return "€";
    return "$";
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, getSymbol }}>
      {children}
    </CurrencyContext.Provider>
  );
}