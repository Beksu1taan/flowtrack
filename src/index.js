import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AuthProvider } from "./context/AuthContext";
import { TxProvider } from "./context/TransactionsContext"; // 🔥 ВАЖНО

import "./styles.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <TxProvider> 
        <ThemeProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <App />
            </CurrencyProvider>
          </LanguageProvider>
        </ThemeProvider>
      </TxProvider>
    </AuthProvider>
  </BrowserRouter>
);