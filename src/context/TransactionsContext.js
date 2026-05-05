import { createContext, useContext, useState, useEffect } from "react";
import {
  getTransactions,
  addTransaction,
  deleteTransaction,
} from "../services/api";
import { useAuth } from "./AuthContext";

const TxContext = createContext();
export const useTx = () => useContext(TxContext);

export function TxProvider({ children }) {
  const { user } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError("");

    getTransactions(user.id)
      .then((data) => setTransactions(data))
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, [user]);

  const addTx = async (tx) => {
    try {
      await addTransaction({ ...tx, user_id: user.id });

      const updated = await getTransactions(user.id);
      setTransactions(updated);
    } catch {
      setError("Add error");
    }
  };

  const deleteTx = async (id) => {
    try {
      await deleteTransaction(id);

      const updated = await getTransactions(user.id);
      setTransactions(updated);
    } catch {
      setError("Delete error");
    }
  };

  return (
    <TxContext.Provider
      value={{
        transactions,
        addTx,
        deleteTx,
        loading,
        error,
      }}
    >
      {children}
    </TxContext.Provider>
  );
}