import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { catInfo, money, monthLabel, todayISO } from "../categories";
import CoachCard from "../components/CoachCard";
import GoalCard from "../components/GoalCard";
import QuickAdd from "../components/QuickAdd";
import TxRow from "../components/TxRow";

function Dashboard() {
  const { transactions, loading, deleteTx, insights } = useTx();
  const { t, lang } = useLang();
  const { user } = useAuth();

  const month = (insights && insights.stats.month) || todayISO().slice(0, 7);

  const monthTx = useMemo(() => transactions.filter((tx) => tx.date && tx.date.startsWith(month)), [transactions, month]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthTx.forEach((tx) => (tx.type === "income" ? (income += tx.amount) : (expense += tx.amount)));
    return { income, expense };
  }, [monthTx]);

  const byCategory = useMemo(() => {
    const map = {};
    monthTx.filter((tx) => tx.type === "expense").forEach((tx) => (map[tx.category] = (map[tx.category] || 0) + tx.amount));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTx]);

  const maxCat = byCategory.length ? byCategory[0][1] : 1;

  if (!loading && transactions.length === 0) {
    return (
      <div className="page">
        <h1>{t("welcome", { name: user.name })} 👋</h1>
        <div className="box empty-state">
          <div className="empty-icon">📄</div>
          <h2>{t("emptyTitle")}</h2>
          <p className="muted">{t("emptyText")}</p>
          <Link className="btn" to="/import">{t("uploadStatement")}</Link>
        </div>
        <div className="grid2">
          <GoalCard />
          <QuickAdd />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("welcome", { name: user.name })} 👋</h1>
        <span className="muted">{monthLabel(month, lang, true)}</span>
      </div>

      <div className="cards">
        <div className="card">
          <h3>{t("incomeMonth")}</h3>
          <p className="green">{money(totals.income)}</p>
        </div>
        <div className="card">
          <h3>{t("expenseMonth")}</h3>
          <p className="red">{money(totals.expense)}</p>
        </div>
        <div className="card">
          <h3>{t("monthBalance")}</h3>
          <p className="blue">{money(totals.income - totals.expense)}</p>
        </div>
        <div className="card">
          <h3>{t("projectedLeft")}</h3>
          <p className={insights && insights.stats.projectedLeftover < 0 ? "red" : "green"}>
            {insights ? money(insights.stats.projectedLeftover) : "…"}
          </p>
        </div>
      </div>

      <CoachCard />

      <div className="grid2">
        <GoalCard />

        <div className="box">
          <h3>🧩 {t("byCategoryMonth")}</h3>
          {byCategory.length === 0 && <p className="muted">{t("noData")}</p>}
          <div className="cat-bars">
            {byCategory.slice(0, 7).map(([id, sum]) => {
              const c = catInfo(id, lang);
              return (
                <div key={id} className="cat-bar">
                  <div className="cat-bar-label">
                    <span>{c.icon} {c.label}</span>
                    <b>{money(sum)}</b>
                  </div>
                  <div className="cat-bar-track">
                    <div style={{ width: `${(sum / maxCat) * 100}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="box">
          <div className="coach-head">
            <h3>🧾 {t("recent")}</h3>
            <Link className="link" to="/transactions">{t("showAll")}</Link>
          </div>
          {transactions.slice(0, 8).map((tx) => (
            <TxRow key={tx.id} tx={tx} onDelete={deleteTx} />
          ))}
        </div>
        <QuickAdd />
      </div>
    </div>
  );
}

export default Dashboard;
