import { useState, useEffect } from "react";
import BudgetInput from "./BudgetInput";
import AddButton from "./AddButton";
import TransactionList from "./TransactionList";
import ExpenseChart from "./ExpenseChart";
import Forecast from "./Forecast";
import { useLang } from "../context/LanguageContext";
import { useCurrency } from "../context/CurrencyContext";
import { useTx } from "../context/TransactionsContext";

function MainContent() {

  const { transactions, addTx, deleteTx } = useTx(); 

  const { t } = useLang();
  const { getSymbol } = useCurrency();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("income");

  const [goal, setGoal] = useState("");
  const [savedGoal, setSavedGoal] = useState(0);

  const format = (num) => num.toLocaleString();

  useEffect(() => {
    const saved = localStorage.getItem("goal");
    if (saved) setSavedGoal(Number(saved));
  }, []);

  const safeTransactions = transactions || [];

  const handleGoal = () => {
    if (!goal || Number(goal) <= 0) return;

    setSavedGoal(Number(goal));
    localStorage.setItem("goal", goal);
    setGoal("");
  };

  const resetGoal = () => {
    setSavedGoal(0);
    localStorage.removeItem("goal");
  };

  const addTransaction = () => {
    if (!amount || !category) return;

    const newItem = {
      amount: Number(amount),
      category,
      type
    };

    addTx(newItem);

    setAmount("");
    setCategory("");
  };

  const deleteTransaction = (id) => {
    deleteTx(id); 
  };

  const income = safeTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = safeTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expense;

  const progress = savedGoal
    ? Math.min((balance / savedGoal) * 100, 100)
    : 0;

  return (
    <div className="content">

      <h2>{t("welcome")} 👋</h2>

      <div className="cards">
        <div className="card">
          <h3>{t("balance")}</h3>
          <p className="blue">{getSymbol()}{format(balance)}</p>
        </div>

        <div className="card">
          <h3>{t("income")}</h3>
          <p className="green">{getSymbol()}{format(income)}</p>
        </div>

        <div className="card">
          <h3>{t("expense")}</h3>
          <p className="red">{getSymbol()}{format(expense)}</p>
        </div>
      </div>

      <div className="box">
        <h3>{t("savingGoal")}</h3>

        {savedGoal === 0 ? (
          <>
            <input
              placeholder={t("enterGoal")}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <button onClick={handleGoal}>{t("setGoal")}</button>
          </>
        ) : (
          <>
            <p>{t("goal")}: {getSymbol()}{format(savedGoal)}</p>

            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>

            <p>{Math.round(progress)}% {t("completed")}</p>

            <button onClick={resetGoal}>{t("changeGoal")}</button>
          </>
        )}
      </div>

      <div className="box">
        <h3>{t("addTransaction")}</h3>

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="income">{t("income")}</option>
          <option value="expense">{t("expense")}</option>
        </select>

        <input
          placeholder={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <BudgetInput
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <AddButton onClick={addTransaction} />
      </div>

      <TransactionList
        transactions={safeTransactions}
        onDelete={deleteTransaction}
      />

      <div className="box">
        <h3>{t("insight")}</h3>

        {expense > income && <p className="red">{t("overspending")}</p>}
        {expense <= income && expense > income * 0.7 && (
          <p style={{ color: "#facc15" }}>{t("warning")}</p>
        )}
        {expense < income * 0.5 && (
          <p className="green">{t("goodSaving")}</p>
        )}
      </div>

      <div className="analytics">
        <ExpenseChart transactions={safeTransactions} />
        <Forecast transactions={safeTransactions} />
      </div>

    </div>
  );
}

export default MainContent;