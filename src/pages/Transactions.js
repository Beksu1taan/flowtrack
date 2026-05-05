import { useState, useMemo } from "react";
import { useTx } from "../context/TransactionsContext";
import { useNavigate } from "react-router-dom";

function Transactions() {
  const { transactions, deleteTx, loading, error } = useTx();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const safeTransactions = transactions || [];

  // фильтр + поиск (useMemo)
  const filtered = useMemo(() => {
    return safeTransactions.filter((t) => {
      const matchText =
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        String(t.amount).includes(search);

      const matchType =
        typeFilter === "all" ? true : t.type === typeFilter;

      return matchText && matchType;
    });
  }, [safeTransactions, search, typeFilter]);

  return (
    <div className="content">
      <h2>Transactions</h2>

      {/* 🔍 SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* 🔽 FILTER */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
      >
        <option value="all">All</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
      </select>

      {/* ⏳ LOADING */}
      {loading && <p>Loading...</p>}

      {/* ❌ ERROR */}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* 📭 EMPTY */}
      {!loading && filtered.length === 0 && (
        <p>No transactions found</p>
      )}

      {/* 📋 LIST */}
      {filtered.map((t) => (
        <div
          key={t.id}
          className="list-item"
          onClick={() => navigate(`/transaction/${t.id}`)}
          style={{ cursor: "pointer" }}
        >
          <div>
            {t.category} — {t.amount}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteTx(t.id);
            }}
          >
            ❌
          </button>
        </div>
      ))}
    </div>
  );
}

export default Transactions;