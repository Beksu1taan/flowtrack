// Работа с Claude API. Если ключа нет или запрос упал — возвращаем null,
// и приложение продолжает работать на словаре и шаблонных подсказках.

const Anthropic = require("@anthropic-ai/sdk");
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require("./categories");
const { redactPII } = require("./privacy");

const FAST_MODEL = process.env.AI_MODEL_FAST || "claude-haiku-5-5";
const SMART_MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 2 });
  return client;
}

const isEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function ask(model, system, user, maxTokens = 2000) {
  const c = getClient();
  if (!c) return null;
  const res = await c.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

function extractJson(text) {
  if (!text) return null;
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === "[" ? "]" : "}";
  const end = text.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// merchants: [{ key, description, type }] → { key: category }
async function categorizeMerchants(merchants) {
  if (!isEnabled() || !merchants.length) return {};
  const result = {};
  const BATCH = 80;
  for (let i = 0; i < merchants.length; i += BATCH) {
    const batch = merchants.slice(i, i + BATCH);
    // В AI уходит только название мерчанта, без номеров карт, телефонов и ФИО
    const list = batch.map((m, idx) => `${idx}. [${m.type}] ${redactPII(m.description)}`).join("\n");
    try {
      const text = await ask(
        FAST_MODEL,
        `Ты категоризируешь банковские операции жителей Казахстана (Kaspi, Halyk и др.).
Категории расходов: ${EXPENSE_CATEGORIES.join(", ")}.
Категории доходов: ${INCOME_CATEGORIES.join(", ")}.
Подсказки: Yandex Go/inDrive/Onay — transport; Glovo/Wolt/кафе — food; Magnum/Small — groceries;
Kaspi магазин/Wildberries — shopping; перевод человеку (имя и инициал) — transfers;
входящий перевод от человека — transfer_in; зарплата — salary.
Если не уверен — other (для доходов other_income).
Ответь ТОЛЬКО JSON-объектом вида {"0":"food","1":"transport"} без пояснений.`,
        list,
        1500
      );
      const json = extractJson(text) || {};
      const allowed = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
      batch.forEach((m, idx) => {
        const cat = json[idx] || json[String(idx)];
        if (allowed.has(cat)) result[m.key] = cat;
      });
    } catch (err) {
      console.error("AI categorize error:", err.message);
    }
  }
  return result;
}

// Достаёт операции из текста выписки неизвестного формата.
async function extractTransactions(text) {
  if (!isEnabled() || !text) return null;
  // Перед отправкой вырезаем ФИО, ИИН, номера карт и счетов, телефоны
  const lines = redactPII(text).split(/\r?\n/).filter((l) => l.trim());
  const CHUNK = 120;
  const all = [];
  for (let i = 0; i < lines.length; i += CHUNK) {
    const chunk = lines.slice(i, i + CHUNK).join("\n");
    try {
      const out = await ask(
        SMART_MODEL,
        `Ты извлекаешь операции из текста банковской выписки (Казахстан, валюта по умолчанию KZT).
Верни ТОЛЬКО JSON-массив объектов:
{"date":"YYYY-MM-DD","amount":число без знака,"type":"expense" или "income","description":"мерчант или назначение"}
Пропускай заголовки, итоги, остатки, курсы валют. Ничего не выдумывай: если строк с операциями нет — верни [].`,
        chunk,
        8000
      );
      const json = extractJson(out);
      if (Array.isArray(json)) all.push(...json);
    } catch (err) {
      console.error("AI extract error:", err.message);
      return all.length ? all : null;
    }
  }
  return all
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number(r.amount) > 0)
    .map((r) => ({
      date: r.date,
      amount: Math.abs(Number(r.amount)),
      type: r.type === "income" ? "income" : "expense",
      description: String(r.description || "Операция").slice(0, 250),
      operation: "",
    }));
}

// Короткий совет по уже посчитанным цифрам. Цифры считает сервер, AI только формулирует.
async function coachMessage(stats, lang = "ru") {
  if (!isEnabled()) return null;
  try {
    const text = await ask(
      FAST_MODEL,
      `Ты дружелюбный финансовый помощник в приложении-трекере бюджета.
Пиши на языке: ${lang === "en" ? "English" : "русский"}. Обращайся на «ты».
Используй ТОЛЬКО цифры из присланного JSON, не придумывай новые. Суммы в тенге (₸), с пробелами между тысячами.
3–4 коротких предложения: как идут траты по сравнению с прошлым месяцем, сколько останется к концу месяца,
успевает ли пользователь к цели и один конкретный совет (например, какую категорию урезать и на сколько в день).
Без заголовков, списков и эмодзи в начале.`,
      JSON.stringify(stats),
      400
    );
    return text ? text.trim() : null;
  } catch (err) {
    console.error("AI coach error:", err.message);
    return null;
  }
}

module.exports = { isEnabled, categorizeMerchants, extractTransactions, coachMessage, extractJson };
