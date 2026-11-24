import { useParams, useNavigate } from "react-router-dom";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { catInfo, money, dateLabel } from "../categories";

function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { transactions, deleteTx } = useTx();
  const { t, lang } = useLang();

  const tx = transactions.find((x) => x.id === Number(id));

  if (!tx) {
    return (
      <div className="page">
        <p className="muted">{t("noData")}</p>
        <button onClick={() => navigate(-1)}>⬅ {t("back")}</button>
      </div>
    );
  }

  const c = catInfo(tx.category, lang);
  const same = tx.description ? transactions.filter((x) => x.description === tx.description && x.type === tx.type) : [tx];
  const sameTotal = same.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="page">
      <h1>
        {c.icon} {tx.description || c.label}
      </h1>
      <div className="box detail">
        <p><span>{t("amount")}</span><b className={tx.type === "income" ? "green" : "red"}>{money(tx.type === "income" ? tx.amount : -tx.amount, { sign: true })}</b></p>
        <p><span>{t("date")}</span><b>{dateLabel(tx.date, lang)}</b></p>
        <p><span>{t("category")}</span><b>{c.label}</b></p>
        <p><span>{t("source")}</span><b>{tx.source === "manual" ? t("source_manual") : tx.source}</b></p>
        {same.length > 1 && (
          <p><span>{t("total")} ({same.length} {t("times")})</span><b>{money(sameTotal)}</b></p>
        )}
      </div>
      <div className="btn-row">
        <button onClick={() => navigate(-1)}>⬅ {t("back")}</button>
        <button
          className="ghost danger"
          onClick={async () => {
            await deleteTx(tx.id);
            navigate(-1);
          }}
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}

export default TransactionDetail;
