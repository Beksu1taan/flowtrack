import { useMemo, useState, useEffect } from "react";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { catInfo, money, monthLabel } from "../categories";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const short = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : v);

function Analytics() {
  const { transactions } = useTx();
  const { t, lang } = useLang();
  const [range, setRange] = useState(6);

  const allMonths = useMemo(
    () => [...new Set(transactions.map((tx) => tx.date && tx.date.slice(0, 7)).filter(Boolean))].sort(),
    [transactions]
  );
  const months = range ? allMonths.slice(-range) : allMonths;
  const [selMonth, setSelMonth] = useState(null);
  useEffect(() => {
    if (allMonths.length && (!selMonth || !allMonths.includes(selMonth))) setSelMonth(allMonths[allMonths.length - 1]);
  }, [allMonths, selMonth]);

  const monthly = useMemo(() => {
    const map = Object.fromEntries(months.map((m) => [m, { key: m, month: monthLabel(m, lang), income: 0, expense: 0 }]));
    transactions.forEach((tx) => {
      const m = tx.date && tx.date.slice(0, 7);
      if (map[m]) map[m][tx.type] += tx.amount;
    });
    return months.map((m) => map[m]);
  }, [transactions, months, lang]);

  const kpi = useMemo(() => {
    const n = monthly.length || 1;
    const inc = monthly.reduce((s, m) => s + m.income, 0);
    const exp = monthly.reduce((s, m) => s + m.expense, 0);
    let days = 0;
    months.forEach((m) => {
      const [y, mm] = m.split("-").map(Number);
      const now = new Date();
      const isCurrent = y === now.getFullYear() && mm === now.getMonth() + 1;
      days += isCurrent ? now.getDate() : new Date(y, mm, 0).getDate();
    });
    return {
      avgIncome: inc / n,
      avgExpense: exp / n,
      savingsRate: inc > 0 ? ((inc - exp) / inc) * 100 : 0,
      avgDay: days ? exp / days : 0,
    };
  }, [monthly, months]);

  const prevMonth = selMonth ? allMonths[allMonths.indexOf(selMonth) - 1] : null;
  const categories = useMemo(() => {
    if (!selMonth) return [];
    const cur = {};
    const prev = {};
    transactions.forEach((tx) => {
      if (tx.type !== "expense" || !tx.date) return;
      if (tx.date.startsWith(selMonth)) cur[tx.category] = (cur[tx.category] || 0) + tx.amount;
      if (prevMonth && tx.date.startsWith(prevMonth)) prev[tx.category] = (prev[tx.category] || 0) + tx.amount;
    });
    const total = Object.values(cur).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(cur)
      .map(([id, value]) => ({
        id,
        ...catInfo(id, lang),
        value,
        share: (value / total) * 100,
        change: prev[id] ? ((value - prev[id]) / prev[id]) * 100 : null,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selMonth, prevMonth, lang]);

  const merchants = useMemo(() => {
    if (!selMonth) return [];
    const map = {};
    transactions.forEach((tx) => {
      if (tx.type !== "expense" || !tx.date || !tx.date.startsWith(selMonth) || !tx.description) return;
      const k = tx.description;
      if (!map[k]) map[k] = { name: k, sum: 0, count: 0, category: tx.category };
      map[k].sum += tx.amount;
      map[k].count += 1;
    });
    return Object.values(map).sort((a, b) => b.sum - a.sum).slice(0, 8);
  }, [transactions, selMonth]);

  const topIds = useMemo(() => {
    const total = {};
    transactions.forEach((tx) => {
      const m = tx.date && tx.date.slice(0, 7);
      if (tx.type === "expense" && months.includes(m)) total[tx.category] = (total[tx.category] || 0) + tx.amount;
    });
    return Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  }, [transactions, months]);
  const trend = useMemo(() => {
    const map = Object.fromEntries(months.map((m) => [m, { month: monthLabel(m, lang) }]));
    transactions.forEach((tx) => {
      const m = tx.date && tx.date.slice(0, 7);
      if (tx.type === "expense" && map[m] && topIds.includes(tx.category)) {
        map[m][tx.category] = (map[m][tx.category] || 0) + tx.amount;
      }
    });
    return months.map((m) => map[m]);
  }, [transactions, months, topIds, lang]);

  const tooltipStyle = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" } };

  if (!transactions.length) {
    return (
      <div className="page">
        <h1>📈 {t("analyticsTitle")}</h1>
        <p className="muted">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>📈 {t("analyticsTitle")}</h1>
        <div className="segmented">
          {[3, 6, 12, 0].map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
              {r ? t("last" + r) : t("allTime")}
            </button>
          ))}
        </div>
      </div>

      <div className="cards">
        <div className="card"><h3>{t("avgExpense")}</h3><p className="red">{money(kpi.avgExpense)}</p></div>
        <div className="card"><h3>{t("avgIncome")}</h3><p className="green">{money(kpi.avgIncome)}</p></div>
        <div className="card"><h3>{t("savingsRate")}</h3><p className={kpi.savingsRate < 0 ? "red" : "blue"}>{Math.round(kpi.savingsRate)}%</p></div>
        <div className="card"><h3>{t("avgDay")}</h3><p>{money(kpi.avgDay)}</p></div>
      </div>

      <div className="box">
        <h3>{t("incomeVsExpense")}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthly} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted)" tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={short} width={48} />
            <Tooltip formatter={(v) => money(v)} {...tooltipStyle} />
            <Legend />
            <Bar dataKey="income" name={t("income")} fill="#22c55e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" name={t("expense")} fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="box">
        <div className="coach-head">
          <h3>{t("categoriesFor")}</h3>
          <select className="compact" value={selMonth || ""} onChange={(e) => setSelMonth(e.target.value)}>
            {[...allMonths].reverse().map((m) => (
              <option key={m} value={m}>{monthLabel(m, lang, true)}</option>
            ))}
          </select>
        </div>
        <div className="grid2 tight">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categories} dataKey="value" nameKey="label" innerRadius={70} outerRadius={115} paddingAngle={2}>
                {categories.map((c) => (
                  <Cell key={c.id} fill={c.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money(v)} {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <table className="tx-table">
            <thead>
              <tr>
                <th>{t("category")}</th>
                <th className="num">{t("amount")}</th>
                <th className="num">{t("share")}</th>
                <th className="num">{t("change")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td><span className="dot" style={{ background: c.color }} />{c.icon} {c.label}</td>
                  <td className="num nowrap">{money(c.value)}</td>
                  <td className="num">{Math.round(c.share)}%</td>
                  <td className={`num ${c.change > 0 ? "red" : "green"}`}>
                    {c.change === null ? "—" : `${c.change > 0 ? "+" : ""}${Math.round(c.change)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="box">
          <h3>{t("topMerchants")}</h3>
          {merchants.map((m) => {
            const c = catInfo(m.category, lang);
            return (
              <div key={m.name} className="merchant">
                <span>{c.icon} {m.name}</span>
                <span className="muted small">{m.count} {t("times")}</span>
                <b>{money(m.sum)}</b>
              </div>
            );
          })}
        </div>
        <div className="box">
          <h3>{t("categoryTrend")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={short} width={48} />
              <Tooltip formatter={(v) => money(v)} {...tooltipStyle} />
              <Legend />
              {topIds.map((id) => {
                const c = catInfo(id, lang);
                return <Bar key={id} dataKey={id} name={c.label} stackId="a" fill={c.color} />;
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Analytics;
