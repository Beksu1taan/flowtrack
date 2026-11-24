import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getTransactions,
  addTransaction,
  deleteTransaction,
  updateTransaction,
  getGoal,
  saveGoal as saveGoalApi,
  deleteGoal as deleteGoalApi,
  getInsights,
} from "../services/api";
import { useAuth } from "./AuthContext";
import { useLang } from "./LanguageContext";

const TxContext = createContext();
export const useTx = () => useContext(TxContext);

// MySQL может отдать сумму строкой — приводим к числу
const normalize = (list) =>
  (list || []).map((t) => ({
    ...t,
    amount: Number(t.amount),
    date: t.date ? String(t.date).slice(0, 10) : null,
  }));

export function TxProvider({ children }) {
  const { user } = useAuth();
  const { lang } = useLang();

  const [transactions, setTransactions] = useState([]);
  const [goal, setGoal] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshInsights = useCallback(async () => {
    if (!user) return;
    setInsightsLoading(true);
    try {
      setInsights(await getInsights(lang));
    } catch (e) {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, [user, lang]);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [txs, g] = await Promise.all([getTransactions(), getGoal()]);
      setTransactions(normalize(txs));
      setGoal(g);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setGoal(null);
      setInsights(null);
      return;
    }
    reload();
  }, [user, reload]);

  useEffect(() => {
    refreshInsights();
  }, [refreshInsights]);

  const afterChange = async () => {
    const txs = await getTransactions();
    setTransactions(normalize(txs));
    refreshInsights();
  };

  const addTx = async (tx) => {
    setError("");
    try {
      await addTransaction(tx);
      await afterChange();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const deleteTx = async (id) => {
    try {
      await deleteTransaction(id);
      await afterChange();
    } catch (e) {
      setError(e.message);
    }
  };

  const updateCategory = async (id, category, remember = false) => {
    const res = await updateTransaction(id, { category, remember });
    await afterChange();
    return res;
  };

  const saveGoal = async (data) => {
    const g = await saveGoalApi(data);
    setGoal(g);
    refreshInsights();
  };

  const removeGoal = async () => {
    await deleteGoalApi();
    setGoal(null);
    refreshInsights();
  };

  return (
    <TxContext.Provider
      value={{
        transactions,
        goal,
        insights,
        loading,
        insightsLoading,
        error,
        addTx,
        deleteTx,
        updateCategory,
        saveGoal,
        removeGoal,
        reload: async () => {
          await reload();
          refreshInsights();
        },
      }}
    >
      {children}
    </TxContext.Provider>
  );
}
