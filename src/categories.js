// Категории: подписи, иконки и цвета. id совпадают с сервером.
export const CATEGORIES = {
  food: { ru: "Кафе и доставка", en: "Eating out", icon: "🍔", color: "#f97316", type: "expense" },
  groceries: { ru: "Продукты", en: "Groceries", icon: "🛒", color: "#22c55e", type: "expense" },
  transport: { ru: "Транспорт", en: "Transport", icon: "🚕", color: "#3b82f6", type: "expense" },
  shopping: { ru: "Покупки", en: "Shopping", icon: "🛍️", color: "#a855f7", type: "expense" },
  utilities: { ru: "Коммуналка и связь", en: "Bills", icon: "💡", color: "#eab308", type: "expense" },
  health: { ru: "Здоровье", en: "Health", icon: "💊", color: "#ef4444", type: "expense" },
  entertainment: { ru: "Развлечения", en: "Entertainment", icon: "🎬", color: "#ec4899", type: "expense" },
  education: { ru: "Образование", en: "Education", icon: "📚", color: "#14b8a6", type: "expense" },
  beauty: { ru: "Красота", en: "Beauty", icon: "💅", color: "#f472b6", type: "expense" },
  transfers: { ru: "Переводы", en: "Transfers", icon: "💸", color: "#64748b", type: "expense" },
  cash: { ru: "Наличные", en: "Cash", icon: "🏧", color: "#94a3b8", type: "expense" },
  other: { ru: "Другое", en: "Other", icon: "📦", color: "#78716c", type: "expense" },
  salary: { ru: "Зарплата", en: "Salary", icon: "💼", color: "#4ade80", type: "income" },
  transfer_in: { ru: "Входящие переводы", en: "Incoming transfers", icon: "📥", color: "#38bdf8", type: "income" },
  cashback: { ru: "Кэшбэк", en: "Cashback", icon: "🎁", color: "#facc15", type: "income" },
  other_income: { ru: "Другой доход", en: "Other income", icon: "💰", color: "#2dd4bf", type: "income" },
};

export const EXPENSE_IDS = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].type === "expense");
export const INCOME_IDS = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].type === "income");

// Для старых записей с произвольной категорией («Food», «еда»)
const FALLBACK_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#e11d48", "#6366f1"];
function hashColor(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

export function catInfo(id, lang = "ru") {
  const c = CATEGORIES[id];
  if (c) return { id, label: c[lang] || c.ru, icon: c.icon, color: c.color };
  return { id, label: id || "—", icon: "📌", color: hashColor(id) };
}

// 1234567.8 → "1 234 568 ₸"
export function money(n, { sign = false } = {}) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toLocaleString("ru-RU").replace(/ /g, " ");
  const prefix = v < 0 ? "−" : sign && v > 0 ? "+" : "";
  return `${prefix}${s} ₸`;
}

const MONTHS = {
  ru: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_FULL = {
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export function monthLabel(key, lang = "ru", full = false) {
  const [y, m] = key.split("-").map(Number);
  const names = (full ? MONTHS_FULL : MONTHS)[lang] || MONTHS.ru;
  return full ? `${names[m - 1]} ${y}` : `${names[m - 1]} ${String(y).slice(2)}`;
}

// "2026-10-05" → "5 окт"
export function dateLabel(date, lang = "ru") {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const names = MONTHS[lang] || MONTHS.ru;
  const thisYear = new Date().getFullYear();
  return `${d} ${names[m - 1]}${y !== thisYear ? ` ${y}` : ""}`;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
