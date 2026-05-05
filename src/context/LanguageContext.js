import { createContext, useContext, useEffect, useState } from "react";

const LanguageContext = createContext();

export const useLang = () => useContext(LanguageContext);

// словари
const translations = {
  en: {
    dashboard: "Dashboard",
    transactions: "Transactions",
    analytics: "Analytics",
    forecast: "Forecast",
    settings: "Settings",

    welcome: "Welcome back",

    addTransaction: "Add Transaction",
    income: "Income",
    expense: "Expense",
    category: "Category",
    enterAmount: "Enter amount",

    savingGoal: "Saving Goal",
    changeGoal: "Change Goal",
    setGoal: "Set Goal",
    enterGoal: "Enter your goal",
    goal: "Goal",
    completed: "completed",

    balance: "Balance",

    noData: "No transactions yet",

    insight: "Smart Insight",
    overspending: "You are overspending",
    warning: "You are close to overspending",
    goodSaving: "Great! You are saving well"
  },

  ru: {
    dashboard: "Главная",
    transactions: "Транзакции",
    analytics: "Аналитика",
    forecast: "Прогноз",
    settings: "Настройки",

    welcome: "С возвращением",

    addTransaction: "Добавить транзакцию",
    income: "Доход",
    expense: "Расход",
    category: "Категория",
    enterAmount: "Введите сумму",

    savingGoal: "Цель накопления",
    changeGoal: "Изменить цель",
    setGoal: "Установить цель",
    enterGoal: "Введите сумму цели",
    goal: "Цель",
    completed: "выполнено",

    balance: "Баланс",

    noData: "Нет транзакций",

    insight: "Анализ",
    overspending: "Вы тратите слишком много",
    warning: "Вы близки к перерасходу",
    goodSaving: "Отлично! Вы хорошо экономите"
  }
};

export function LanguageProvider({ children }) {

  const [lang, setLang] = useState(() => {
    return localStorage.getItem("lang") || "en";
  });

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}