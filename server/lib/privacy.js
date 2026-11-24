// Защита персональных данных:
// 1) вырезание ПД из текста перед отправкой во внешний AI;
// 2) распознавание имён людей (переводы), чтобы не отправлять их в AI и общий кэш;
// 3) шифрование описаний операций в базе (AES-256-GCM).

const crypto = require("crypto");

// ---------- 1. Вырезание персональных данных ----------

const PII_PATTERNS = [
  // Строки-реквизиты целиком: ФИО, ИИН, номер счёта и т.п.
  [/^.*(ФИО|Ф\.И\.О|Клиент|Владелец|Держатель|Получатель|Отправитель|Cardholder|Client|Name)\s*[:：].*$/gim, "[ДАННЫЕ КЛИЕНТА]"],
  [/^.*(ИИН|БИН|IIN|BIN|Удостоверени|паспорт|Дата рождения)\s*[:：№]?.*$/gim, "[ДОКУМЕНТ]"],
  // IBAN Казахстана: KZ + 2 цифры + 16 символов (с пробелами или без)
  [/\bKZ\d{2}(?:\s?[A-Z0-9]{4}){4}\b/gi, "[СЧЁТ]"],
  // Номера карт, в том числе маскированные: 4400 4301 **** 1234, *1234
  [/\b\d{4}[\s-]?(?:\d{2}|\*{2})[\d*]{2}[\s-]?[\d*]{4}[\s-]?\d{4}\b/g, "[КАРТА]"],
  [/\*{1,4}\s?\d{4}\b/g, "[КАРТА]"],
  // ИИН/БИН: ровно 12 цифр
  [/\b\d{12}\b/g, "[ИИН]"],
  // Телефоны: +7 707 123 45 67, 8(701)1234567
  [/(?:\+7|\b8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/g, "[ТЕЛЕФОН]"],
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[EMAIL]"],
  // Полное ФИО: Иванов Иван Иванович / Сейтказы Айгерим Нурлановна
  // (\b не работает с кириллицей, поэтому границы через \p{L})
  [/(?<!\p{L})[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:вич|вна|ұлы|қызы|улы|кызы)(?!\p{L})/gu, "[ФИО]"],
];

function redactPII(text) {
  let out = String(text || "");
  for (const [re, repl] of PII_PATTERNS) out = out.replace(re, repl);
  return out;
}

// ---------- 2. Имена людей ----------

const CAP = "[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]";
const LOW = "[а-яёәғқңөұүһіa-z]";
// «Айгерим Б.», «Иванов И.И.», «Arman K.», «Сейтказы Айгерим», «Иванов Иван Иванович»
const PERSON_RE = new RegExp(
  `^(?:${CAP}${LOW}+\\s+${CAP}\\.(?:\\s?${CAP}\\.)?|${CAP}${LOW}+\\s+${CAP}${LOW}+(?:\\s+${CAP}${LOW}+)?)$`
);
// Слова, по которым понятно, что это компания, а не человек
const BUSINESS_WORDS = /(тоо|ип|ао|llp|ltd|shop|market|маркет|магазин|кафе|cafe|coffee|bank|банк|аптека|store|pay|go|eda|taxi|такси|сервис|service|клиник|салон|центр|mall|plaza|cinema|кино|ресторан|бар|club|клуб)/i;

function looksLikePerson(description) {
  const s = String(description || "").trim().replace(/\s+/g, " ");
  if (!s || s.length > 60 || /\d/.test(s) || BUSINESS_WORDS.test(s)) return false;
  return PERSON_RE.test(s);
}

// «Иванов Иван Иванович» → «Иван И.» (как показывает Kaspi), чтобы не хранить полное ФИО третьих лиц
function shortenPersonName(description) {
  const s = String(description || "").trim().replace(/\s+/g, " ");
  if (!looksLikePerson(s)) return description;
  const parts = s.split(" ");
  if (parts.length === 3) return `${parts[1]} ${parts[0][0]}.`; // Фамилия Имя Отчество
  if (parts.length === 2 && parts[1].length > 2 && !parts[1].endsWith(".")) return `${parts[0]} ${parts[1][0]}.`;
  return s;
}

// ---------- 3. Шифрование ----------

const PREFIX = "enc:v1:";
let KEY = null;

function loadKey() {
  const raw = process.env.DATA_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("DATA_KEY должен быть 32 байта (64 hex-символа)");
  return buf;
}

function initEncryption() {
  KEY = loadKey();
  if (!KEY) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_KEY обязателен в продакшене");
    console.warn("⚠️  DATA_KEY не задан — описания операций хранятся без шифрования.");
  }
  return Boolean(KEY);
}

const encryptionEnabled = () => Boolean(KEY);

function encrypt(text) {
  if (text === null || text === undefined || text === "") return text;
  if (!KEY) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, data]).toString("base64");
}

function decrypt(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value; // старые незашифрованные записи
  if (!KEY) return "[зашифровано]";
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "[не удалось расшифровать]";
  }
}

const isEncrypted = (v) => typeof v === "string" && v.startsWith(PREFIX);

module.exports = {
  redactPII,
  looksLikePerson,
  shortenPersonName,
  initEncryption,
  encryptionEnabled,
  encrypt,
  decrypt,
  isEncrypted,
};
