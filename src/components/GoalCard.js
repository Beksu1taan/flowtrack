import { useState } from "react";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { money, dateLabel } from "../categories";

const plusMonths = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

function GoalCard() {
  const { goal, insights, saveGoal, removeGoal } = useTx();
  const { t, lang } = useLang();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", target_amount: "", start_amount: "", deadline: plusMonths(3) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setForm(
      goal
        ? { title: goal.title, target_amount: goal.target_amount, start_amount: goal.start_amount, deadline: goal.deadline }
        : { title: "", target_amount: "", start_amount: "", deadline: plusMonths(3) }
    );
    setError("");
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveGoal({
        title: form.title,
        target_amount: Number(String(form.target_amount).replace(/\s/g, "")),
        start_amount: Number(String(form.start_amount || 0).replace(/\s/g, "")),
        deadline: form.deadline,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (window.confirm(t("goalDelete"))) await removeGoal();
  };

  if (!goal || editing) {
    return (
      <form className="box goal" onSubmit={submit}>
        <h3>🎯 {t("goalTitle")}</h3>
        <label>
          {t("goalName")}
          <input value={form.title} placeholder={t("goalNamePlaceholder")} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <div className="row2">
          <label>
            {t("goalTarget")}
            <input inputMode="numeric" value={form.target_amount} placeholder="1 000 000" required onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
          </label>
          <label>
            {t("goalStart")}
            <input inputMode="numeric" value={form.start_amount} placeholder="0" onChange={(e) => setForm({ ...form, start_amount: e.target.value })} />
          </label>
        </div>
        <label>
          {t("goalDeadline")}
          <input type="date" value={form.deadline} required onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </label>
        {error && <p className="red small">{error}</p>}
        <div className="btn-row">
          <button type="submit" disabled={busy}>{goal ? t("save") : t("setGoal")}</button>
          {goal && <button type="button" className="ghost" onClick={() => setEditing(false)}>{t("cancel")}</button>}
        </div>
        <p className="muted small">{t("goalHint")}</p>
      </form>
    );
  }

  const g = insights && insights.stats && insights.stats.goal;
  const progress = g ? g.progressPct : 0;

  return (
    <div className="box goal">
      <div className="coach-head">
        <h3>🎯 {goal.title}</h3>
        <button className="link" onClick={startEdit}>{t("edit")}</button>
        <button className="link danger" onClick={remove}>{t("delete")}</button>
      </div>

      {g ? (
        <>
          <p className="goal-amount">
            {t("goalSaved", { saved: money(Math.max(0, g.saved)), target: money(g.target) })}
          </p>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="goal-meta">
            <span>{Math.round(progress)}%</span>
            <span>
              {dateLabel(g.deadline, lang)} · {t("goalLeftDays", { days: g.daysToDeadline })}
            </span>
          </div>
          {g.status !== "done" && (
            <ul className="goal-facts">
              <li>{t("goalPerMonth", { amount: money(g.requiredPerMonth) })}</li>
              <li>
                {t("goalThisMonth", {
                  need: money(g.requiredThisMonth),
                  have: money(insights.stats.projectedLeftover),
                })}
              </li>
              <li className={g.projectedAtDeadline >= g.target ? "green" : "red"}>
                {t("goalAtDeadline", { amount: money(g.projectedAtDeadline) })}
              </li>
            </ul>
          )}
        </>
      ) : (
        <p className="muted">{t("loading")}</p>
      )}
    </div>
  );
}

export default GoalCard;
