import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { catInfo, money, monthLabel } from "../categories";
import CoachCard from "../components/CoachCard";
import GoalCard from "../components/GoalCard";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";

const short = (v) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : v);

function ForecastPage() {
  const { insights } = useTx();
  const { t, lang } = useLang();

  if (!insights) {
    return (
      <div className="page">
        <h1>🔮 {t("forecastTitle")}</h1>
        <p className="muted">{t("loading")}</p>
      </div>
    );
  }

  const s = insights.stats;
  const tooltipStyle = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)" } };

  return (
    <div className="page">
      <div className="page-head">
        <h1>🔮 {t("forecastTitle")}</h1>
        <span className="muted">{monthLabel(s.month, lang, true)}</span>
      </div>

      <CoachCard />

      {s.hasData && (
        <>
          <div className="cards">
            <div className="card"><h3>{t("projectedSpend")}</h3><p className="red">{money(s.projectedSpend)}</p></div>
            <div className="card"><h3>{t("expectedIncome")}</h3><p className="green">{money(s.expectedIncome)}</p></div>
            <div className="card"><h3>{t("projectedLeft")}</h3><p className={s.projectedLeftover < 0 ? "red" : "blue"}>{money(s.projectedLeftover)}</p></div>
            <div className="card"><h3>{t("avgDay")}</h3><p>{money(s.avgDailySpend)}</p></div>
          </div>

          <div className="box">
            <h3>{t("cumulative")}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={s.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--muted)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={short} width={48} />
                <Tooltip formatter={(v) => money(v)} labelFormatter={(d) => `${t("day")} ${d}`} {...tooltipStyle} />
                <Legend />
                {s.expectedIncome > 0 && (
                  <ReferenceLine y={s.expectedIncome} stroke="#22c55e" strokeDasharray="4 4" label={{ value: t("expectedIncome"), fill: "#22c55e", fontSize: 12, position: "insideTopLeft" }} />
                )}
                <Line type="monotone" dataKey="previous" name={t("prevMonth")} stroke="#64748b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="current" name={t("curMonth")} stroke="#3b82f6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="projection" name={t("projection")} stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid2">
            <GoalCard />
            <div className="box">
              <h3>{t("categoryGrowth")}</h3>
              <p className="muted small">{t("vsSamePeriod")}</p>
              {s.categoryChanges.map((c) => {
                const info = catInfo(c.category, lang);
                return (
                  <div key={c.category} className="merchant">
                    <span>{info.icon} {info.label}</span>
                    <span className="muted small">{money(c.previous)} → {money(c.current)}</span>
                    <b className={c.diff > 0 ? "red" : "green"}>{money(c.diff, { sign: true })}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ForecastPage;
