// Определение категории для каждой операции.
// Порядок: правила пользователя → тип операции банка → словарь → кэш AI → AI → «другое».

const { merchantKey, matchDictionary, matchUserRules } = require("./categories");
const ai = require("./ai");
const { looksLikePerson } = require("./privacy");

function incomeCategory(text) {
  if (/зарплат|заработн|salary|payroll|аванс|оклад/i.test(text)) return "salary";
  if (/кэшбэк|кешбэк|cashback|бонус|bonus/i.test(text)) return "cashback";
  if (/пополнен|перевод|transfer|с карты|from card/i.test(text) || /[А-ЯA-Z][а-яa-z]+ [А-ЯA-Z]\./.test(text)) return "transfer_in";
  return "other_income";
}

function operationHint(row) {
  const op = (row.operation || "").toLowerCase();
  if (row.type === "income") return null; // доходы решаем отдельно
  if (/сняти|снятия|cash|atm|банкомат/.test(op) || /банкомат|atm|снятие налич/i.test(row.description)) return "cash";
  if (/перевод/.test(op)) {
    // перевод на Kaspi магазин / в кафе бывает — тогда пусть решит словарь
    return matchDictionary(row.description) ? null : "transfers";
  }
  return null;
}

// rows: [{date, amount, type, description, operation}]
// opts: { rules: [{pattern, category}], cache: { get(keys) → {key:cat}, set({key:cat}) } }
async function categorizeRows(rows, { rules = [], cache = null, useAi = true } = {}) {
  const out = rows.map((r) => ({ ...r, category: null, categorySource: null }));
  const unknown = new Map(); // key → {key, description, type}

  for (const r of out) {
    const ruleCat = matchUserRules(r.description, rules);
    if (ruleCat) { r.category = ruleCat; r.categorySource = "rule"; continue; }

    if (r.type === "income") {
      r.category = incomeCategory(`${r.operation} ${r.description}`);
      r.categorySource = "dict";
      continue;
    }

    const hint = operationHint(r);
    if (hint) { r.category = hint; r.categorySource = "dict"; continue; }

    const dict = matchDictionary(r.description);
    if (dict) { r.category = dict; r.categorySource = "dict"; continue; }

    if (/платеж|платёж/i.test(r.operation || "")) { r.category = "utilities"; r.categorySource = "dict"; continue; }

    // Перевод человеку: имя не отправляем ни в AI, ни в общий кэш
    if (looksLikePerson(r.description)) { r.category = "transfers"; r.categorySource = "dict"; continue; }

    const key = merchantKey(r.description);
    if (key && !unknown.has(key)) unknown.set(key, { key, description: r.description, type: r.type });
  }

  if (unknown.size) {
    const keys = [...unknown.keys()];
    const cached = cache ? await cache.get(keys) : {};
    const toAsk = keys.filter((k) => !cached[k]).map((k) => unknown.get(k));
    const fresh = useAi ? await ai.categorizeMerchants(toAsk) : {};
    if (cache && Object.keys(fresh).length) await cache.set(fresh);
    const known = { ...cached, ...fresh };

    for (const r of out) {
      if (r.category) continue;
      const k = merchantKey(r.description);
      if (known[k]) { r.category = known[k]; r.categorySource = "ai"; }
    }
  }

  for (const r of out) {
    if (!r.category) { r.category = r.type === "income" ? "other_income" : "other"; r.categorySource = "default"; }
  }

  return out;
}

module.exports = { categorizeRows, incomeCategory };
