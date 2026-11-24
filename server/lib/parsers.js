// Разбор банковских выписок: Kaspi (PDF), Halyk и другие (PDF / CSV / Excel).
// На выходе всегда массив строк одного вида:
// { date: "YYYY-MM-DD", amount: 2350, type: "expense"|"income", description, operation }

const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const ExcelJS = require("exceljs");

// ---------- Общие помощники ----------

// "- 2 350,00 ₸" → -2350 ; "1,234.50" → 1234.5 ; "1 234 567,89" → 1234567.89
function parseAmount(raw) {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw).replace(/[  \s]/g, "").replace(/[₸$€₽]|KZT|тг|тенге/gi, "");
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  if (s.startsWith("-") || s.startsWith("−") || s.startsWith("–")) { sign = -1; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { sign = -1; s = s.slice(0, -1); }

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // десятичный разделитель — тот, что правее
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=.*,)/g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot > -1 && (s.match(/\./g) || []).length > 1) {
    s = s.replace(/\.(?=.*\.)/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return sign * Number(s);
}

const pad = (n) => String(n).padStart(2, "0");

// "05.09.24", "05.09.2024", "2024-09-05", "05/09/2024", Date → "2024-09-05"
function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw)) {
    return `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`;
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const month = Number(m[2]);
    const day = Number(m[1]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

function cleanText(s) {
  return String(s || "").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
}

// ---------- Kaspi Gold (PDF) ----------
// Строки вида: 05.09.24  - 2 350,00 ₸  Покупка  Yandex.Go
// pdf-parse может отдать колонки и одной строкой, и каждую ячейку с новой строки,
// поэтому ищем записи по всему тексту, а детали — до начала следующей записи.

const KASPI_OPS = "Покупк[аи]|Перевод[ы]?|Пополнени[ея]|Сняти[ея]|Снятия|Разное|Платеж[и]?|Платёж|Оплат[аы]";
const KASPI_ROW = new RegExp(
  `(\\d{2}\\.\\d{2}\\.\\d{2,4})\\s*([+\\-−–])\\s*(\\d+(?:[ \\u00a0\\u202f]\\d{3})*(?:,\\d{2})?)\\s*₸?\\s*(${KASPI_OPS})`,
  "g"
);
const KASPI_JUNK = /(АО\s*[«"]?\s*Kaspi|Kaspi\s*Bank|kaspi\.kz|БИК|БСН|Дата\s+Сумма\s+Операция|Страница\s*\d|Page\s*\d|Выписка\s+по|Остаток|Доступно\s+на)/i;

function isKaspi(text) {
  return /kaspi\s*gold|kaspi\s*bank|kaspi\.kz|каспи/i.test(text);
}

function parseKaspiText(text) {
  const flat = cleanText(text);
  const matches = [...flat.matchAll(KASPI_ROW)];
  const rows = [];
  matches.forEach((m, i) => {
    const date = parseDate(m[1]);
    const amount = parseAmount(m[3]);
    if (!date || !isFinite(amount) || amount === 0) return;
    const end = i + 1 < matches.length ? matches[i + 1].index : flat.length;
    let details = flat.slice(m.index + m[0].length, end);
    const junk = details.search(KASPI_JUNK);
    if (junk > -1) details = details.slice(0, junk);
    const sign = m[2] === "+" ? 1 : -1;
    rows.push({
      date,
      amount: Math.abs(amount),
      type: sign > 0 ? "income" : "expense",
      description: cleanText(details).slice(0, 250) || m[4],
      operation: m[4],
    });
  });
  return rows;
}

// ---------- Универсальный построчный разбор PDF (Halyk и др.) ----------

const AMOUNT_IN_LINE = /[+\-−–]?\s?\d{1,3}(?:[   ]\d{3})*(?:[.,]\d{2})|[+\-−–]?\s?\d+[.,]\d{2}/g;
const INCOME_WORDS = /пополнен|зачислен|поступлен|возврат|кэшбэк|cashback|бонус|зарплат|salary|входящ|refund/i;
const EXPENSE_WORDS = /покупк|оплат|списан|перевод|снят|платеж|платёж|purchase|payment|комисси/i;

function parseGenericText(text) {
  const lines = String(text).split(/\r?\n/).map(cleanText).filter(Boolean);
  const rows = [];
  let explicit = 0;
  for (const line of lines) {
    const dm = line.match(/^(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
    if (!dm) continue;
    const date = parseDate(dm[1]);
    if (!date) continue;
    // убираем все даты (часто их две: дата операции и дата обработки) и время
    const rest = line
      .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}/g, " ")
      .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");
    const amounts = [...rest.matchAll(AMOUNT_IN_LINE)];
    if (!amounts.length) continue;
    const first = amounts[0];
    const description = cleanText(rest.slice(0, first.index).replace(/\b(KZT|USD|EUR|RUB)\b/g, ""));
    // Сумма в валюте счёта обычно последняя ненулевая; знак берём из любой суммы
    const values = amounts.map((a) => parseAmount(a[0])).filter((v) => isFinite(v) && v !== 0);
    if (!values.length) continue;
    const signed = values.find((v) => v < 0);
    let type;
    if (signed !== undefined || /^\s*[+]/.test(first[0])) {
      explicit++;
      type = signed !== undefined ? "expense" : "income";
    } else if (INCOME_WORDS.test(line)) {
      explicit++;
      type = "income";
    } else if (EXPENSE_WORDS.test(line)) {
      explicit++;
      type = "expense";
    } else {
      type = "expense";
    }
    rows.push({
      date,
      amount: Math.abs(signed !== undefined ? signed : values[0]),
      type,
      description: description.slice(0, 250) || "Операция",
      operation: "",
    });
  }
  // confidence: доля строк, где тип определён явно
  const confidence = rows.length ? explicit / rows.length : 0;
  return { rows, confidence };
}

// ---------- Таблицы (CSV / Excel) ----------

const COLS = {
  date: /^(дата|date|күні|дата операции|дата проведения|transaction date|posting date)/i,
  amount: /(^сумма|amount|сомасы|сумма в валюте сч|сумма операции)/i,
  income: /(приход|зачислен|поступлен|кредит|credit|income|кіріс)/i,
  expense: /(расход|списан|дебет|debit|expense|шығыс)/i,
  description: /(детал|описан|назначен|description|details|merchant|контрагент|получатель|наименован|операция|сипаттама)/i,
  operation: /^(операция|тип|type|operation)/i,
};

function findHeader(table) {
  for (let i = 0; i < Math.min(table.length, 40); i++) {
    const cells = table[i].map((c) => cleanText(c));
    const hasDate = cells.some((c) => COLS.date.test(c));
    const hasMoney = cells.some((c) => COLS.amount.test(c) || COLS.income.test(c) || COLS.expense.test(c));
    if (hasDate && hasMoney) return i;
  }
  return -1;
}

function pickCol(header, re, exclude = []) {
  return header.findIndex((c, i) => re.test(c) && !exclude.includes(i));
}

function parseTable(table) {
  const h = findHeader(table);
  if (h === -1) return [];
  const header = table[h].map((c) => cleanText(c));
  const dateCol = pickCol(header, COLS.date);
  // «Сумма в валюте счёта» точнее «суммы в валюте операции»
  let amountCol = header.findIndex((c) => /валюте сч/i.test(c));
  if (amountCol === -1) amountCol = pickCol(header, COLS.amount);
  const incomeCol = pickCol(header, COLS.income, [amountCol]);
  const expenseCol = pickCol(header, COLS.expense, [amountCol, incomeCol]);
  const opCol = pickCol(header, COLS.operation, [dateCol]);
  let descCol = pickCol(header, COLS.description, [dateCol, amountCol, opCol]);
  if (descCol === -1) descCol = opCol;

  const rows = [];
  for (const r of table.slice(h + 1)) {
    const date = parseDate(r[dateCol]);
    if (!date) continue;
    let value = NaN;
    if (incomeCol > -1 && expenseCol > -1 && amountCol === -1) {
      const inc = parseAmount(r[incomeCol]);
      const exp = parseAmount(r[expenseCol]);
      if (isFinite(inc) && inc !== 0) value = Math.abs(inc);
      else if (isFinite(exp) && exp !== 0) value = -Math.abs(exp);
    } else if (amountCol > -1) {
      value = parseAmount(r[amountCol]);
    }
    if (!isFinite(value) || value === 0) continue;
    const op = opCol > -1 && opCol !== descCol ? cleanText(r[opCol]) : "";
    let type = value < 0 ? "expense" : "income";
    // Если в выписке все суммы без знака — смотрим на тип операции
    if (value > 0 && op && EXPENSE_WORDS.test(op) && !INCOME_WORDS.test(op)) type = "expense";
    rows.push({
      date,
      amount: Math.abs(value),
      type,
      description: cleanText(r[descCol]).slice(0, 250) || op || "Операция",
      operation: op,
    });
  }
  return rows;
}

function parseCsv(text) {
  const firstLines = text.split(/\r?\n/).slice(0, 20).join("\n");
  const delim = [";", "\t", ","].map((d) => [d, firstLines.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const table = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); table.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); table.push(row); }
  return table;
}

async function parseXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  let best = [];
  wb.eachSheet((ws) => {
    const table = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = [];
      r.eachCell({ includeEmpty: true }, (c, col) => {
        let v = c.value;
        if (v && typeof v === "object" && !(v instanceof Date)) {
          v = v.result !== undefined ? v.result : v.text !== undefined ? v.text : v.richText ? v.richText.map((t) => t.text).join("") : "";
        }
        vals[col - 1] = v;
      });
      table.push(vals);
    });
    const rows = parseTable(table);
    if (rows.length > best.length) best = rows;
  });
  return best;
}

// ---------- Точка входа ----------
// Возвращает { bank, rows, text, needsAi }
async function parseStatement(buffer, filename = "") {
  const name = filename.toLowerCase();
  const isPdf = name.endsWith(".pdf") || buffer.slice(0, 4).toString() === "%PDF";

  if (isPdf) {
    const { text } = await pdfParse(buffer);
    const bank = isKaspi(text) ? "kaspi" : /halyk|халык/i.test(text) ? "halyk" : /jusan|жусан/i.test(text) ? "jusan" : "other";
    if (bank === "kaspi") {
      const rows = parseKaspiText(text);
      if (rows.length) return { bank, rows, text, needsAi: false };
    }
    const { rows, confidence } = parseGenericText(text);
    return { bank, rows, text, needsAi: rows.length === 0 || confidence < 0.6 };
  }

  if (name.endsWith(".xlsx")) {
    const rows = await parseXlsx(buffer);
    return { bank: "excel", rows, text: "", needsAi: false };
  }

  // CSV / TXT. Пробуем UTF-8, при «кракозябрах» — Windows-1251.
  let text = buffer.toString("utf8");
  if (text.includes("�")) text = new TextDecoder("windows-1251").decode(buffer);
  text = text.replace(/^﻿/, "");
  if (isKaspi(text)) {
    const kaspiRows = parseKaspiText(text);
    if (kaspiRows.length) return { bank: "kaspi", rows: kaspiRows, text, needsAi: false };
  }
  const rows = parseTable(parseCsv(text));
  if (rows.length) return { bank: "csv", rows, text, needsAi: false };
  const generic = parseGenericText(text);
  return { bank: "csv", rows: generic.rows, text, needsAi: generic.rows.length === 0 || generic.confidence < 0.6 };
}

module.exports = {
  parseStatement,
  parseKaspiText,
  parseGenericText,
  parseTable,
  parseCsv,
  parseAmount,
  parseDate,
};
