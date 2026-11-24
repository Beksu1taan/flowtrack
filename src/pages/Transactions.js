import { useState, useMemo } from "react";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { catInfo, money, monthLabel } from "../categories";
import CategorySelect from "../components/CategorySelect";
import TxRow from "../components/TxRow";

const PAGE = 50;

function Transactions() {
  const { transactions, deleteTx, updateCategory, loading, error } = useTx();
  const { t, lang } = useLang();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [ask, setAsk] = useState(null); // { tx, category }
  const [notice, setNotice] = useState("");

  const months = useMemo(
    () => [...new Set(transactions.map((tx) => tx.date && tx.date.slice(0, 7)).filter(Boolean))].sort().reverse(),
    [transactions]
  );
  const usedCategories = useMemo(() => [...new Set(transactions.map((tx) => tx.category))], [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const label = catInfo(tx.category, lang).label.toLowerCase();
      const matchText =
        !q ||
        (tx.description || "").toLowerCase().includes(q) ||
        label.includes(q) ||
        String(Math.round(tx.amount)).includes(q.replace(/\s/g, ""));
      return (
        matchText &&
        (typeFilter === "all" || tx.type === typeFilter) &&
        (catFilter === "all" || tx.category === catFilter) &&
        (monthFilter === "all" || (tx.date && tx.date.startsWith(monthFilter)))
      );
    });
  }, [transactions, search, typeFilter, catFilter, monthFilter, lang]);

  const total = filtered.reduce((s, tx) => s + (tx.type === "income" ? tx.amount : -tx.amount), 0);

  const onCategory = (tx, category) => {
    if (category === tx.category) return;
    if (tx.description) setAsk({ tx, category });
    else updateCategory(tx.id, category);
  };

  const confirmAsk = async (remember) => {
    const { tx, category } = ask;
    setAsk(null);
    const res = await updateCategory(tx.id, category, remember);
    if (res && res.alsoUpdated) {
      setNotice(t("alsoUpdated", { count: res.alsoUpdated }));
      setTimeout(() => setNotice(""), 4000);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>🧾 {t("transactions")}</h1>
        <span className="muted">
          {filtered.length} · {t("total")}: <b>{money(total, { sign: true })}</b>
        </span>
      </div>

      <div className="box filters">
        <input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">{t("allTypes")}</option>
          <option value="expense">{t("expense")}</option>
          <option value="income">{t("income")}</option>
        </select>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">{t("allCategories")}</option>
          {usedCategories.map((id) => {
            const c = catInfo(id, lang);
            return (
              <option key={id} value={id}>
                {c.icon} {c.label}
              </option>
            );
          })}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">{t("allMonths")}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, lang, true)}
            </option>
          ))}
        </select>
      </div>

      {ask && (
        <div className="box ask">
          <p>
            {t("rememberAsk", { name: ask.tx.description, cat: catInfo(ask.category, lang).label })}
          </p>
          <div className="btn-row">
            <button onClick={() => confirmAsk(true)}>{t("rememberYes")}</button>
            <button className="ghost" onClick={() => confirmAsk(false)}>{t("rememberNo")}</button>
            <button className="ghost" onClick={() => setAsk(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}
      {notice && <div className="box success small-box">{notice}</div>}

      {loading && <p className="muted">{t("loading")}</p>}
      {error && <p className="red">{error}</p>}
      {!loading && filtered.length === 0 && <p className="muted">{t("noData")}</p>}

      <div className="box list">
        {filtered.slice(0, limit).map((tx) => (
          <TxRow key={tx.id} tx={tx} onDelete={deleteTx}>
            <CategorySelect className="compact" type={tx.type} value={tx.category} onChange={(c) => onCategory(tx, c)} />
          </TxRow>
        ))}
        {filtered.length > limit && (
          <button className="ghost wide" onClick={() => setLimit(limit + PAGE)}>
            + {Math.min(PAGE, filtered.length - limit)}
          </button>
        )}
      </div>
    </div>
  );
}

export default Transactions;
