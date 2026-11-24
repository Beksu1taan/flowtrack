const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const { pool } = require("./db");
const { parseStatement } = require("./lib/parsers");
const { categorizeRows } = require("./lib/categorize");
const { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, merchantKey } = require("./lib/categories");
const { computeInsights, templateMessage } = require("./lib/forecast");
const ai = require("./lib/ai");
const { encrypt, decrypt, shortenPersonName, encryptionEnabled } = require("./lib/privacy");

// Версия политики конфиденциальности: при изменении текста поменяй — пользователи примут заново
const PRIVACY_VERSION = "2026-10-27";

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET обязателен в продакшене");
  }
  console.warn("⚠️  JWT_SECRET не задан — используется временный ключ (после перезапуска все выйдут из аккаунта).");
  return crypto.randomBytes(32).toString("hex");
})();
if (JWT_SECRET.length < 16) console.warn("⚠️  JWT_SECRET слишком короткий — используй строку от 32 символов.");
// Короткая жизнь токена: украденный токен быстро становится бесполезным
const JWT_EXPIRES = process.env.JWT_EXPIRES || "1d";
const APP_TZ = process.env.APP_TZ || "Asia/Almaty";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Railway стоит за прокси — нужен реальный IP для лимитов

// Заголовки безопасности: CSP, запрет фреймов, nosniff, HSTS и т.д.
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : true }));
app.use(express.json({ limit: "2mb" }));

// ---------- Ограничение частоты запросов ----------

const limitMsg = (text) => ({ error: text });
const ipKey = (req) => ipKeyGenerator(req.ip);

// Общий лимит на все запросы к API
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: limitMsg("Слишком много запросов, подожди немного"),
}));

// Защита от перебора паролей: 10 неудачных попыток на связку IP + email за 15 минут
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKey(req)}|${String((req.body && req.body.email) || "").trim().toLowerCase()}`,
  message: limitMsg("Слишком много попыток входа. Попробуй через 15 минут"),
});
// И отдельно на IP — чтобы нельзя было перебирать разные email
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  message: limitMsg("Слишком много попыток входа с этого адреса. Попробуй позже"),
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: ipKey,
  message: limitMsg("Слишком много регистраций с этого адреса. Попробуй позже"),
});
// Защита от спама записями
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => `u${req.userId || ipKey(req)}`,
  message: limitMsg("Слишком часто. Подожди минуту"),
});

// ---------- Загрузка файлов ----------

const ALLOWED_EXT = /\.(pdf|csv|txt|xlsx)$/i;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // некоторые браузеры так отдают CSV
]);
const upload = multer({
  storage: multer.memoryStorage(), // файл не сохраняется на диск и не исполняется
  limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EXT.test(file.originalname || "") || !ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error("BAD_TYPE");
      err.code = "BAD_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
});

// Проверка содержимого: расширение можно подделать, сигнатуру файла — сложнее
function checkFileSignature(file) {
  const name = file.originalname.toLowerCase();
  const head = file.buffer.subarray(0, 8);
  if (name.endsWith(".pdf")) return head.subarray(0, 5).toString() === "%PDF-";
  if (name.endsWith(".xlsx")) return head[0] === 0x50 && head[1] === 0x4b; // ZIP
  // CSV/TXT: должен быть текстом без нулевых байтов
  return !file.buffer.subarray(0, 4096).includes(0);
}

// Убираем управляющие символы из пользовательского текста
const cleanStr = (v, max) => String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

// ---------- Помощники ----------

const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date());
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES, algorithm: "HS256" });
}
// Фиктивный хеш: при несуществующем email тоже тратим время на bcrypt, чтобы нельзя было узнать по времени ответа, есть ли аккаунт
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, aiConsent: Boolean(u.ai_consent) });

async function getUser(id) {
  const [rows] = await pool.query("SELECT id, name, email, ai_consent, consent_at, privacy_version, created_at FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}
// AI используется, только если ключ задан И пользователь дал отдельное согласие
async function aiAllowed(userId) {
  if (!ai.isEnabled()) return false;
  const u = await getUser(userId);
  return Boolean(u && u.ai_consent);
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Нужно войти в аккаунт" });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ error: "Сессия истекла, войди заново" });
  }
  // Токен удалённого аккаунта больше не действует
  pool.query("SELECT id FROM users WHERE id = ?", [payload.id])
    .then(([rows]) => {
      if (!rows.length) return res.status(401).json({ error: "Аккаунт не найден" });
      req.userId = payload.id;
      next();
    })
    .catch(next);
}

// Простой лимит запросов к AI, чтобы никто не сжёг ключ
const hits = new Map();
function limit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.userId}`;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: "Слишком много запросов, попробуй чуть позже" });
    list.push(now);
    hits.set(key, list);
    next();
  };
}

function txHash(userId, row, occurrence) {
  return crypto
    .createHash("sha1")
    .update([userId, row.date, Number(row.amount).toFixed(2), row.type, merchantKey(row.description), occurrence].join("|"))
    .digest("hex");
}

async function getRules(userId) {
  const [rows] = await pool.query("SELECT id, pattern, category FROM category_rules WHERE user_id = ?", [userId]);
  return rows;
}

const merchantCache = {
  async get(keys) {
    if (!keys.length) return {};
    const [rows] = await pool.query("SELECT merchant_key, category FROM merchant_cache WHERE merchant_key IN (?)", [keys]);
    return Object.fromEntries(rows.map((r) => [r.merchant_key, r.category]));
  },
  async set(map) {
    const values = Object.entries(map).map(([k, c]) => [k.slice(0, 120), c]);
    if (values.length) {
      await pool.query("INSERT INTO merchant_cache (merchant_key, category) VALUES ? ON DUPLICATE KEY UPDATE category = VALUES(category)", [values]);
    }
  },
};

async function saveRule(userId, description, category) {
  const pattern = merchantKey(description);
  if (!pattern || !ALL_CATEGORIES.includes(category)) return null;
  await pool.query(
    "INSERT INTO category_rules (user_id, pattern, category) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE category = VALUES(category)",
    [userId, pattern, category]
  );
  return pattern;
}

// ---------- Здоровье ----------

app.get("/", (req, res) => res.send("FlowTrack API работает"));
app.get("/api/health", (req, res) => res.json({ ok: true, ai: ai.isEnabled(), encryption: encryptionEnabled(), privacyVersion: PRIVACY_VERSION }));
app.get("/api/categories", (req, res) => res.json({ expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES }));

// ---------- Авторизация ----------

app.post("/api/register", registerLimiter, wrap(async (req, res) => {
  const name = cleanStr(req.body.name, 100);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !email || !password) return res.status(400).json({ error: "Заполни все поля" });
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Неверный email" });
  if (password.length < 8 || !/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
    return res.status(400).json({ error: "Пароль: минимум 8 символов, буквы и цифры" });
  }
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: "Пароль слишком длинный" });
  if (req.body.consent !== true) {
    return res.status(400).json({ error: "Нужно согласие на обработку персональных данных" });
  }
  const aiConsent = req.body.aiConsent === true ? 1 : 0;

  const [exists] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
  if (exists.length) return res.status(400).json({ error: "Пользователь с таким email уже есть" });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, consent_at, privacy_version, ai_consent) VALUES (?, ?, ?, NOW(), ?, ?)",
    [name, email, hash, PRIVACY_VERSION, aiConsent]
  );
  const user = { id: result.insertId, name, email, ai_consent: aiConsent };
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.post("/api/login", loginIpLimiter, loginLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase().slice(0, 254);
  const password = String(req.body.password || "").slice(0, 200);
  const [rows] = await pool.query("SELECT * FROM users WHERE LOWER(email) = ?", [email]);
  const user = rows[0];
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return res.status(401).json({ error: "Неверный email или пароль" });
  }

  let ok = false;
  if (/^\$2[aby]\$/.test(user.password)) {
    ok = await bcrypt.compare(password, user.password);
  } else if (user.password === password) {
    // Старый аккаунт с паролем открытым текстом — сразу перехешируем
    ok = true;
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [await bcrypt.hash(password, 10), user.id]);
  }
  if (!ok) return res.status(401).json({ error: "Неверный email или пароль" });
  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get("/api/me", auth, wrap(async (req, res) => {
  const u = await getUser(req.userId);
  if (!u) return res.status(401).json({ error: "Пользователь не найден" });
  res.json({ ...publicUser(u), consentAt: u.consent_at, privacyVersion: u.privacy_version, needsConsent: u.privacy_version !== PRIVACY_VERSION });
}));

// Изменить согласия (AI можно включить или отозвать в любой момент)
app.patch("/api/me", auth, writeLimiter, wrap(async (req, res) => {
  if (typeof req.body.aiConsent === "boolean") {
    await pool.query("UPDATE users SET ai_consent = ? WHERE id = ?", [req.body.aiConsent ? 1 : 0, req.userId]);
  }
  if (req.body.consent === true) {
    await pool.query("UPDATE users SET consent_at = NOW(), privacy_version = ? WHERE id = ?", [PRIVACY_VERSION, req.userId]);
  }
  res.json(publicUser(await getUser(req.userId)));
}));

// Выгрузка всех своих данных (право субъекта на доступ к своим данным)
app.get("/api/me/export", auth, wrap(async (req, res) => {
  const u = await getUser(req.userId);
  const [txs] = await pool.query("SELECT date, type, amount, category, description, source, created_at FROM transactions WHERE user_id = ? ORDER BY date", [req.userId]);
  const [rules] = await pool.query("SELECT pattern, category, created_at FROM category_rules WHERE user_id = ?", [req.userId]);
  const goal = await getGoal(req.userId);
  res.setHeader("Content-Disposition", 'attachment; filename="flowtrack-my-data.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    user: { name: u.name, email: u.email, createdAt: u.created_at, consentAt: u.consent_at, privacyVersion: u.privacy_version, aiConsent: Boolean(u.ai_consent) },
    goal,
    rules,
    transactions: txs.map((t) => ({ ...t, description: decrypt(t.description) })),
  });
}));

// Полное удаление аккаунта и всех данных (нужен пароль)
app.delete("/api/me", auth, wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [req.userId]);
  if (!rows.length) return res.status(404).json({ error: "Пользователь не найден" });
  const ok = await bcrypt.compare(String(req.body.password || "").slice(0, 200), rows[0].password);
  if (!ok) return res.status(401).json({ error: "Неверный пароль" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM transactions WHERE user_id = ?", [req.userId]);
    await conn.query("DELETE FROM category_rules WHERE user_id = ?", [req.userId]);
    await conn.query("DELETE FROM goals WHERE user_id = ?", [req.userId]);
    await conn.query("DELETE FROM users WHERE id = ?", [req.userId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.json({ ok: true });
}));

// ---------- Транзакции ----------

app.get("/api/transactions", auth, wrap(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, amount, category, type, date, description, source FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC",
    [req.userId]
  );
  res.json(rows.map((r) => ({ ...r, description: decrypt(r.description) })));
}));

app.post("/api/transactions", auth, writeLimiter, wrap(async (req, res) => {
  const amount = Math.abs(Number(req.body.amount));
  const type = req.body.type === "income" ? "income" : "expense";
  const category = String(req.body.category || "");
  const date = isDate(req.body.date) ? req.body.date : todayStr();
  const description = cleanStr(req.body.description, 250) || null;
  if (!amount || !isFinite(amount) || amount > 1e12) return res.status(400).json({ error: "Укажи сумму" });
  if (!ALL_CATEGORIES.includes(category)) return res.status(400).json({ error: "Неизвестная категория" });

  const [result] = await pool.query(
    "INSERT INTO transactions (user_id, amount, category, type, date, description, source) VALUES (?, ?, ?, ?, ?, ?, 'manual')",
    [req.userId, amount, category, type, date, encrypt(description)]
  );
  res.json({ id: result.insertId });
}));

// Смена категории. remember=true → правило «всегда так» + применить к похожим операциям
app.patch("/api/transactions/:id", auth, writeLimiter, wrap(async (req, res) => {
  const { category, remember } = req.body;
  if (!ALL_CATEGORIES.includes(category)) return res.status(400).json({ error: "Неверная категория" });
  const [rows] = await pool.query("SELECT * FROM transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  const tx = rows[0];
  if (!tx) return res.status(404).json({ error: "Операция не найдена" });

  await pool.query("UPDATE transactions SET category = ? WHERE id = ?", [category, tx.id]);
  let alsoUpdated = 0;
  const txDescription = decrypt(tx.description);
  if (remember && txDescription) {
    const pattern = await saveRule(req.userId, txDescription, category);
    if (pattern) {
      const [all] = await pool.query(
        "SELECT id, description FROM transactions WHERE user_id = ? AND type = ? AND id <> ? AND description IS NOT NULL",
        [req.userId, tx.type, tx.id]
      );
      const ids = all.filter((t) => merchantKey(decrypt(t.description)).includes(pattern)).map((t) => t.id);
      if (ids.length) {
        await pool.query("UPDATE transactions SET category = ? WHERE user_id = ? AND id IN (?)", [category, req.userId, ids]);
        alsoUpdated = ids.length;
      }
    }
  }
  res.json({ ok: true, alsoUpdated });
}));

app.delete("/api/transactions/:id", auth, wrap(async (req, res) => {
  const [result] = await pool.query("DELETE FROM transactions WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  if (!result.affectedRows) return res.status(404).json({ error: "Операция не найдена" });
  res.json({ ok: true });
}));

app.delete("/api/transactions", auth, wrap(async (req, res) => {
  const [result] = await pool.query("DELETE FROM transactions WHERE user_id = ?", [req.userId]);
  res.json({ deleted: result.affectedRows });
}));

// ---------- Импорт выписок ----------

app.post("/api/import/preview", auth, limit("import", 30, 3600000), upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не получен" });
  if (!checkFileSignature(req.file)) {
    return res.status(400).json({ error: "Содержимое файла не совпадает с его типом" });
  }

  let parsed;
  try {
    parsed = await parseStatement(req.file.buffer, req.file.originalname);
  } catch (err) {
    console.error("Parse error:", err);
    return res.status(422).json({ error: "Не получилось прочитать файл. Поддерживаются PDF, CSV и Excel (.xlsx)." });
  }

  let { rows } = parsed;
  let aiUsed = false;
  const useAi = await aiAllowed(req.userId);
  if (parsed.needsAi && useAi && parsed.text) {
    const aiRows = await ai.extractTransactions(parsed.text);
    if (aiRows && aiRows.length >= rows.length) {
      rows = aiRows;
      aiUsed = true;
    }
  }
  if (!rows.length) {
    return res.status(422).json({
      error: useAi
        ? "В файле не нашлось операций. Проверь, что это выписка по счёту или карте."
        : "Формат этой выписки пока не поддерживается без AI. Kaspi PDF, CSV и Excel работают без AI; для других PDF включи AI-обработку в настройках.",
    });
  }

  // Полные ФИО третьих лиц сокращаем до «Имя Ф.»
  rows = rows.map((r) => ({ ...r, description: shortenPersonName(r.description) }));
  const rules = await getRules(req.userId);
  const categorized = await categorizeRows(rows, { rules, cache: merchantCache, useAi });
  if (categorized.some((r) => r.categorySource === "ai")) aiUsed = true;

  // Хеш для защиты от повторной загрузки той же выписки
  const seen = {};
  categorized.forEach((r) => {
    const base = [r.date, r.amount, r.type, merchantKey(r.description)].join("|");
    seen[base] = (seen[base] || 0) + 1;
    r.hash = txHash(req.userId, r, seen[base]);
  });
  const hashes = categorized.map((r) => r.hash);
  const [existing] = await pool.query("SELECT hash FROM transactions WHERE user_id = ? AND hash IN (?)", [req.userId, hashes]);
  const existingSet = new Set(existing.map((e) => e.hash));
  categorized.forEach((r) => { r.duplicate = existingSet.has(r.hash); });

  const dates = categorized.map((r) => r.date).sort();
  res.json({
    bank: parsed.bank,
    aiUsed,
    period: { from: dates[0], to: dates[dates.length - 1] },
    rows: categorized.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
  });
}));

app.post("/api/import/commit", auth, writeLimiter, wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 5000) : [];
  const ruleList = Array.isArray(req.body.rules) ? req.body.rules.slice(0, 200) : [];
  const bank = String(req.body.bank || "import").replace(/[^a-z]/gi, "").slice(0, 20) || "import";

  const values = [];
  for (const r of rows) {
    const amount = Math.abs(Number(r.amount));
    if (!isDate(r.date) || !amount || !isFinite(amount)) continue;
    if (!/^[a-f0-9]{40}$/.test(r.hash || "")) continue;
    const type = r.type === "income" ? "income" : "expense";
    const category = ALL_CATEGORIES.includes(r.category) ? r.category : type === "income" ? "other_income" : "other";
    values.push([req.userId, amount, category, type, r.date, encrypt(shortenPersonName(cleanStr(r.description, 250))), bank, r.hash]);
  }

  let inserted = 0;
  if (values.length) {
    const [result] = await pool.query(
      "INSERT IGNORE INTO transactions (user_id, amount, category, type, date, description, source, hash) VALUES ?",
      [values]
    );
    inserted = result.affectedRows;
  }
  let rulesSaved = 0;
  for (const r of ruleList) {
    if (await saveRule(req.userId, r.description, r.category)) rulesSaved++;
  }
  res.json({ inserted, skipped: values.length - inserted, rulesSaved });
}));

// ---------- Правила категорий ----------

app.get("/api/rules", auth, wrap(async (req, res) => {
  const [rows] = await pool.query("SELECT id, pattern, category FROM category_rules WHERE user_id = ? ORDER BY pattern", [req.userId]);
  res.json(rows);
}));

app.delete("/api/rules/:id", auth, wrap(async (req, res) => {
  await pool.query("DELETE FROM category_rules WHERE id = ? AND user_id = ?", [req.params.id, req.userId]);
  res.json({ ok: true });
}));

// ---------- Цель ----------

async function getGoal(userId) {
  const [rows] = await pool.query(
    "SELECT id, title, target_amount, start_amount, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(deadline, '%Y-%m-%d') AS deadline FROM goals WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

app.get("/api/goal", auth, wrap(async (req, res) => res.json(await getGoal(req.userId))));

app.put("/api/goal", auth, writeLimiter, wrap(async (req, res) => {
  const title = cleanStr(req.body.title, 120) || "Накопления";
  const target = Number(req.body.target_amount);
  const startAmount = Math.max(0, Number(req.body.start_amount) || 0);
  const deadline = req.body.deadline;
  if (!target || target <= 0 || target > 1e12) return res.status(400).json({ error: "Укажи сумму цели" });
  if (!isDate(deadline) || deadline <= todayStr()) return res.status(400).json({ error: "Срок должен быть в будущем" });

  const existing = await getGoal(req.userId);
  const startDate = existing && !req.body.restart ? existing.start_date : todayStr();
  await pool.query(
    `INSERT INTO goals (user_id, title, target_amount, start_amount, start_date, deadline) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), target_amount = VALUES(target_amount),
       start_amount = VALUES(start_amount), start_date = VALUES(start_date), deadline = VALUES(deadline)`,
    [req.userId, title, target, startAmount, startDate, deadline]
  );
  res.json(await getGoal(req.userId));
}));

app.delete("/api/goal", auth, wrap(async (req, res) => {
  await pool.query("DELETE FROM goals WHERE user_id = ?", [req.userId]);
  res.json({ ok: true });
}));

// ---------- AI-прогноз ----------

const coachCache = new Map();

app.get("/api/insights", auth, wrap(async (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "ru";
  const today = isDate(req.query.today) ? req.query.today : todayStr();
  const [txs] = await pool.query("SELECT amount, category, type, date FROM transactions WHERE user_id = ?", [req.userId]);
  const goal = await getGoal(req.userId);
  const stats = computeInsights(txs, goal, today);
  const message = templateMessage(stats, lang);

  let aiMessage = null;
  const useAi = await aiAllowed(req.userId);
  if (req.query.ai !== "0" && useAi && stats.hasData) {
    const { series, ...forAi } = stats;
    const key = `${req.userId}:${lang}:${crypto.createHash("sha1").update(JSON.stringify(forAi)).digest("hex")}`;
    const hit = coachCache.get(key);
    if (hit && Date.now() - hit.at < 6 * 3600000) {
      aiMessage = hit.text;
    } else {
      const recent = (hits.get(`coach:${req.userId}`) || []).filter((t) => Date.now() - t < 3600000);
      if (recent.length < 30) {
        recent.push(Date.now());
        hits.set(`coach:${req.userId}`, recent);
        aiMessage = await ai.coachMessage(forAi, lang);
        if (aiMessage) {
          if (coachCache.size > 1000) coachCache.clear();
          coachCache.set(key, { text: aiMessage, at: Date.now() });
        }
      }
    }
  }
  res.json({ stats, message, aiMessage, aiEnabled: useAi });
}));

// ---------- Ошибки ----------

app.use((err, req, res, next) => {
  if (err && err.code === "BAD_TYPE") {
    return res.status(400).json({ error: "Можно загружать только PDF, CSV или Excel (.xlsx)" });
  }
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "Неверный формат запроса" });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Слишком большой запрос" });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Файл больше 15 МБ" : "Ошибка загрузки файла" });
  }
  console.error(err);
  res.status(500).json({ error: "Ошибка сервера" });
});

module.exports = app;
