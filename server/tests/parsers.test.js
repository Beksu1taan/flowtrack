const test = require("node:test");
const assert = require("node:assert");
const { parseKaspiText, parseGenericText, parseTable, parseCsv, parseAmount, parseDate } = require("../lib/parsers");

test("parseAmount: разные форматы", () => {
  assert.strictEqual(parseAmount("- 2 350,00 ₸"), -2350);
  assert.strictEqual(parseAmount("+ 150 000,00 ₸"), 150000);
  assert.strictEqual(parseAmount("1,234.50"), 1234.5);
  assert.strictEqual(parseAmount("1 234 567,89"), 1234567.89);
  assert.strictEqual(parseAmount("-5000"), -5000);
  assert.strictEqual(parseAmount("12.345,60"), 12345.6);
  assert.ok(isNaN(parseAmount("abc")));
});

test("parseDate", () => {
  assert.strictEqual(parseDate("05.09.24"), "2024-09-05");
  assert.strictEqual(parseDate("5/9/2024"), "2024-09-05");
  assert.strictEqual(parseDate("2024-09-05 10:00"), "2024-09-05");
  assert.strictEqual(parseDate("32.01.2024"), null);
});

const KASPI_LINES = `ВЫПИСКА по Kaspi Gold за период с 01.09.24 по 30.09.24
Дата Сумма Операция Детали
01.09.24 + 250 000,00 ₸ Пополнение С Halyk Bank
02.09.24 - 2 350,00 ₸ Покупка Yandex.Go
02.09.24 - 4 990,00 ₸ Покупка GLOVO ALMATY
03.09.24 - 15 000,00 ₸ Перевод Айгерим Б.
05.09.24 - 20 000,00 ₸ Снятие Банкомат Kaspi
06.09.24 - 12 480,50 ₸ Покупка MAGNUM CASH&CARRY
АО «Kaspi Bank», БИК CASPKZKA, www.kaspi.kz`;

test("Kaspi: строки в одну линию", () => {
  const rows = parseKaspiText(KASPI_LINES);
  assert.strictEqual(rows.length, 6);
  assert.deepStrictEqual(rows[0], { date: "2024-09-01", amount: 250000, type: "income", description: "С Halyk Bank", operation: "Пополнение" });
  assert.strictEqual(rows[1].description, "Yandex.Go");
  assert.strictEqual(rows[5].amount, 12480.5);
  assert.strictEqual(rows[5].description, "MAGNUM CASH&CARRY");
});

test("Kaspi: каждая ячейка с новой строки, без пробелов", () => {
  const text = "Kaspi Gold\n02.09.24\n-2 350,00 ₸\nПокупка\nYandex.Go\nAlmaty\n03.09.24\n+10 000,00 ₸\nПеревод\nАрман К.";
  const rows = parseKaspiText(text);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].description, "Yandex.Go Almaty");
  assert.strictEqual(rows[1].type, "income");
});

test("Универсальный разбор (Halyk-подобный)", () => {
  const text = `Halyk Bank выписка
12.10.2024 12.10.2024 Покупка STARBUCKS ALMATY KZ -3 200,00 KZT -3 200,00
13.10.2024 14.10.2024 Зачисление зарплаты ТОО Ромашка 450 000,00 KZT 450 000,00
Итого`;
  const { rows, confidence } = parseGenericText(text);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].type, "expense");
  assert.strictEqual(rows[0].amount, 3200);
  assert.match(rows[0].description, /STARBUCKS/);
  assert.strictEqual(rows[1].type, "income");
  assert.strictEqual(confidence, 1);
});

test("CSV с отдельными колонками прихода и расхода", () => {
  const csv = `Отчёт;;;\nДата;Описание;Приход;Расход\n01.10.2024;Зарплата;300 000,00;\n02.10.2024;"Glovo; заказ";;5 500,00\n`;
  const rows = parseTable(parseCsv(csv));
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].type, "income");
  assert.strictEqual(rows[1].description, "Glovo; заказ");
  assert.strictEqual(rows[1].amount, 5500);
  assert.strictEqual(rows[1].type, "expense");
});

test("CSV с одной колонкой суммы", () => {
  const csv = `Date,Amount,Details\n2024-10-01,-1200.00,Onay\n2024-10-02,5000.00,Refund`;
  const rows = parseTable(parseCsv(csv));
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].type, "expense");
  assert.strictEqual(rows[1].type, "income");
});
