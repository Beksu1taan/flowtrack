import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { money } from "../categories";

const STATUS_CLASS = {
  ok: "good",
  on_track: "good",
  done: "good",
  at_risk: "warn",
  off_track: "bad",
  overdue: "bad",
};

function CoachCard({ compact = false }) {
  const { insights, insightsLoading } = useTx();
  const { t } = useLang();

  if (!insights) {
    return (
      <div className="box coach">
        <div className="coach-head">
          <h3>🤖 {t("coachTitle")}</h3>
        </div>
        <p className="muted">{insightsLoading ? t("loading") : "—"}</p>
      </div>
    );
  }

  const { stats, message, aiMessage } = insights;
  const status = stats.status;
  const statusKey = "status" + status.charAt(0).toUpperCase() + status.slice(1);
  const text = aiMessage || message;

  return (
    <div className={`box coach coach-${STATUS_CLASS[status] || "good"}`}>
      <div className="coach-head">
        <h3>🤖 {t("coachTitle")}</h3>
        {stats.hasData && <span className={`chip chip-${STATUS_CLASS[status] || "good"}`}>{t(statusKey)}</span>}
        <span className={`chip ${aiMessage ? "chip-ai" : ""}`}>{aiMessage ? t("coachAi") : t("coachBasic")}</span>
      </div>

      <p className={`coach-text ${insightsLoading ? "fading" : ""}`}>{text}</p>

      {stats.hasData && !compact && (
        <div className="coach-stats">
          <div>
            <span>{t("spentThisMonth")}</span>
            <b>{money(stats.spentMTD)}</b>
            {stats.changePct !== null && (
              <small className={stats.changePct > 0 ? "red" : "green"}>
                {stats.changePct > 0 ? "▲" : "▼"} {Math.abs(stats.changePct)}% {t("vsLastMonth")}
              </small>
            )}
          </div>
          <div>
            <span>{t("projectedLeft")}</span>
            <b className={stats.projectedLeftover < 0 ? "red" : "green"}>{money(stats.projectedLeftover)}</b>
          </div>
          <div>
            <span>{t("dailyLimit")}</span>
            <b className={stats.dailyLimit <= 0 ? "red" : ""}>
              {stats.dailyLimit > 0 ? money(stats.dailyLimit) : t("limitUsed")}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoachCard;
