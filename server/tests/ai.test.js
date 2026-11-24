const test = require("node:test");
const assert = require("node:assert");
const ai = require("../lib/ai");
const { categorizeRows } = require("../lib/categorize");

test("extractJson достаёт JSON из ответа модели", () => {
  assert.deepStrictEqual(ai.extractJson('Вот: {"0":"food"} готово'), { 0: "food" });
  assert.deepStrictEqual(ai.extractJson("```json\n[1,2]\n```"), [1, 2]);
  assert.strictEqual(ai.extractJson("нет json"), null);
});

test("Неизвестные мерчанты: кэш, затем AI, ответ сохраняется в кэш", async () => {
  const original = ai.categorizeMerchants;
  const asked = [];
  ai.categorizeMerchants = async (list) => {
    asked.push(...list.map((m) => m.key));
    return { "zoo shop": "shopping" };
  };
  const store = { "tea house": "food" };
  const cache = {
    get: async (keys) => Object.fromEntries(keys.filter((k) => store[k]).map((k) => [k, store[k]])),
    set: async (map) => Object.assign(store, map),
  };
  try {
    const rows = await categorizeRows([
      { date: "2026-10-01", amount: 100, type: "expense", description: "TEA HOUSE ALMATY", operation: "Покупка" },
      { date: "2026-10-01", amount: 100, type: "expense", description: "ZOO SHOP", operation: "Покупка" },
    ], { cache });
    assert.deepStrictEqual(rows.map((r) => [r.category, r.categorySource]), [["food", "ai"], ["shopping", "ai"]]);
    assert.deepStrictEqual(asked, ["zoo shop"]);
    assert.strictEqual(store["zoo shop"], "shopping");
  } finally {
    ai.categorizeMerchants = original;
  }
});
