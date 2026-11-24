import { useState } from "react";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import CategorySelect from "./CategorySelect";
import { todayISO } from "../categories";

function QuickAdd() {
  const { addTx, error } = useTx();
  const { t } = useLang();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const changeType = (next) => {
    setType(next);
    setCategory(next === "income" ? "salary" : "food");
  };

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(String(amount).replace(/\s/g, "").replace(",", "."));
    if (!value || value <= 0) return;
    setBusy(true);
    const ok = await addTx({ amount: value, type, category, description, date });
    setBusy(false);
    if (ok) {
      setAmount("");
      setDescription("");
    }
  };

  return (
    <form className="box quick-add" onSubmit={submit}>
      <h3>✍️ {t("addTransaction")}</h3>
      <div className="segmented">
        <button type="button" className={type === "expense" ? "active" : ""} onClick={() => changeType("expense")}>
          {t("expense")}
        </button>
        <button type="button" className={type === "income" ? "active" : ""} onClick={() => changeType("income")}>
          {t("income")}
        </button>
      </div>
      <div className="row2">
        <input inputMode="decimal" placeholder={t("amount") + ", ₸"} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <CategorySelect type={type} value={category} onChange={setCategory} />
      <input placeholder={t("descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="red small">{error}</p>}
      <button type="submit" disabled={busy}>{t("add")}</button>
    </form>
  );
}

export default QuickAdd;
