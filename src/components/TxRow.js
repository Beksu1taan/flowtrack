import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { catInfo, money, dateLabel } from "../categories";

function TxRow({ tx, onDelete, children }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const c = catInfo(tx.category, lang);

  return (
    <div className="tx-row" onClick={() => navigate(`/transaction/${tx.id}`)}>
      <div className="tx-icon" style={{ background: c.color + "22", color: c.color }}>{c.icon}</div>
      <div className="tx-main">
        <b>{tx.description || c.label}</b>
        <span>
          {dateLabel(tx.date, lang)} · {c.label}
        </span>
      </div>
      {children && <div className="tx-extra" onClick={(e) => e.stopPropagation()}>{children}</div>}
      <div className={`tx-amount ${tx.type === "income" ? "green" : ""}`}>
        {money(tx.type === "income" ? tx.amount : -tx.amount, { sign: true })}
      </div>
      {onDelete && (
        <button
          className="icon-btn"
          title="Удалить"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tx.id);
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default TxRow;
