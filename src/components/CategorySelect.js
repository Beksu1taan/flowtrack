import { CATEGORIES, EXPENSE_IDS, INCOME_IDS } from "../categories";
import { useLang } from "../context/LanguageContext";

function CategorySelect({ value, onChange, type, className = "", ...rest }) {
  const { lang, t } = useLang();
  const ids = type === "income" ? INCOME_IDS : type === "expense" ? EXPENSE_IDS : null;
  const option = (id) => (
    <option key={id} value={id}>
      {CATEGORIES[id].icon} {CATEGORIES[id][lang]}
    </option>
  );
  const isCustom = value && !CATEGORIES[value];

  return (
    <select className={className} value={value || ""} onChange={(e) => onChange(e.target.value)} {...rest}>
      {isCustom && <option value={value}>📌 {value}</option>}
      {ids ? (
        ids.map(option)
      ) : (
        <>
          <optgroup label={t("expense")}>{EXPENSE_IDS.map(option)}</optgroup>
          <optgroup label={t("income")}>{INCOME_IDS.map(option)}</optgroup>
        </>
      )}
    </select>
  );
}

export default CategorySelect;
