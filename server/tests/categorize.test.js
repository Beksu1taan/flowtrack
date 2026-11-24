const test = require("node:test");
const assert = require("node:assert");
const { matchDictionary, merchantKey, matchUserRules } = require("../lib/categories");
const { categorizeRows } = require("../lib/categorize");

test("Словарь мерчантов", () => {
  const cases = {
    "Yandex.Go": "transport", "YANDEX.TAXI ALMATY": "transport", "Яндекс Еда": "food",
    "Yandex Lavka": "groceries", "Yandex Plus": "entertainment", "GLOVO ALMATY": "food",
    "Wolt": "food", "MAGNUM CASH&CARRY": "groceries", "Small": "groceries",
    "Kaspi Магазин": "shopping", "Wildberries": "shopping", "Onay": "transport", "inDrive": "transport",
    "Beeline KZ": "utilities", "Аптека Europharma": "health", "Netflix.com": "entertainment",
    "Kinopark 8 IMAX": "entertainment", "Helios АЗС": "transport", "Technodom": "shopping",
    "Smart Office Supplies": null,
  };
  for (const [text, cat] of Object.entries(cases)) {
    assert.strictEqual(matchDictionary(text), cat, text);
  }
});

test("Ключ мерчанта убирает город и номера", () => {
  assert.strictEqual(merchantKey("GLOVO*ALMATY KZ 123456789"), "glovo");
  assert.strictEqual(merchantKey("ИП Иванов"), "иванов");
});

test("Правила пользователя важнее словаря", async () => {
  const rules = [{ pattern: "yandex go", category: "food" }];
  assert.strictEqual(matchUserRules("Yandex.Go Almaty", rules), "food");
  const rows = await categorizeRows([
    { date: "2024-09-02", amount: 2350, type: "expense", description: "Yandex.Go", operation: "Покупка" },
    { date: "2024-09-03", amount: 15000, type: "expense", description: "Айгерим Б.", operation: "Перевод" },
    { date: "2024-09-05", amount: 20000, type: "expense", description: "Банкомат", operation: "Снятие" },
    { date: "2024-09-01", amount: 300000, type: "income", description: "Зарплата ТОО Ромашка", operation: "" },
    { date: "2024-09-01", amount: 5000, type: "income", description: "С Halyk Bank", operation: "Пополнение" },
    { date: "2024-09-07", amount: 999, type: "expense", description: "XYZ непонятно", operation: "Покупка" },
  ], { rules });
  assert.deepStrictEqual(rows.map((r) => r.category), ["food", "transfers", "cash", "salary", "transfer_in", "other"]);
  assert.strictEqual(rows[0].categorySource, "rule");
  assert.strictEqual(rows[5].categorySource, "default");
});

test("Имена людей не уходят в AI", async () => {
  const ai = require("../lib/ai");
  const orig = ai.categorizeMerchants;
  const sent = [];
  ai.categorizeMerchants = async (list) => { sent.push(...list.map((m) => m.description)); return {}; };
  try {
    const rows = await categorizeRows([
      { date: "2026-10-01", amount: 1, type: "expense", description: "Иванов Иван Иванович", operation: "" },
      { date: "2026-10-01", amount: 1, type: "expense", description: "Unknown Merchant 77", operation: "" },
    ]);
    assert.strictEqual(rows[0].category, "transfers");
    assert.deepStrictEqual(sent, ["Unknown Merchant 77"]);
    sent.length = 0;
    await categorizeRows([{ date: "2026-10-01", amount: 1, type: "expense", description: "Zzz Shop X1", operation: "" }], { useAi: false });
    assert.deepStrictEqual(sent, []); // без согласия AI не вызывается
  } finally {
    ai.categorizeMerchants = orig;
  }
});
