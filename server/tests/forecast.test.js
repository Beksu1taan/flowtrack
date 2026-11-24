const test = require("node:test");
const assert = require("node:assert");
const { computeInsights, templateMessage } = require("../lib/forecast");

const tx = (date, amount, type = "expense", category = "food") => ({ date, amount, type, category });

// Сентябрь: доход 400к, расходы 300к (по 10к в день). Октябрь: к 15-му потрачено 225к (15к в день).
const data = [tx("2024-09-01", 400000, "income", "salary")];
for (let d = 1; d <= 30; d++) data.push(tx(`2024-09-${String(d).padStart(2, "0")}`, 10000));
data.push(tx("2024-10-01", 400000, "income", "salary"));
for (let d = 1; d <= 15; d++) data.push(tx(`2024-10-${String(d).padStart(2, "0")}`, 15000, "expense", d % 2 ? "food" : "transport"));

test("Сравнение с прошлым месяцем и прогноз", () => {
  const s = computeInsights(data, null, "2024-10-15");
  assert.strictEqual(s.spentMTD, 225000);
  assert.strictEqual(s.prevSamePeriodSpent, 150000);
  assert.strictEqual(s.changePct, 50);
  // линейно: 15к*31 = 465к; история: 300к; вес 15/31 → ~379 839
  assert.ok(s.projectedSpend > 370000 && s.projectedSpend < 390000, String(s.projectedSpend));
  assert.strictEqual(s.expectedIncome, 400000);
  assert.strictEqual(s.projectedLeftover, 400000 - s.projectedSpend);
  assert.strictEqual(s.series.length, 31);
  assert.strictEqual(s.series[14].current, 225000);
  assert.strictEqual(s.series[30].projection, s.projectedSpend);
});

test("Цель 1 000 000 за 3 месяца — в минусе", () => {
  const goal = { title: "Ноутбук", target_amount: 1000000, start_amount: 0, start_date: "2024-10-01", deadline: "2024-12-31" };
  const s = computeInsights(data, goal, "2024-10-15");
  assert.ok(s.goal.requiredThisMonth > 320000 && s.goal.requiredThisMonth < 340000, String(s.goal.requiredThisMonth));
  assert.ok(s.goal.gapThisMonth < 0);
  assert.strictEqual(s.goal.status, "off_track");
  assert.strictEqual(s.goal.saved, 400000 - 225000);
  const msg = templateMessage(s, "ru");
  assert.match(msg, /на 50% больше/);
  assert.match(msg, /в минусе/);
  assert.match(msg, /исчерпан/);
});

test("Цель достижима", () => {
  const goal = { title: "Отпуск", target_amount: 240000, start_amount: 0, start_date: "2024-10-01", deadline: "2025-12-31" };
  const s = computeInsights(data, goal, "2024-10-15");
  assert.strictEqual(s.goal.status, "on_track");
  assert.match(templateMessage(s, "ru"), /успеваешь/);
});

test("Нет данных", () => {
  const s = computeInsights([], null, "2024-10-15");
  assert.strictEqual(s.hasData, false);
  assert.match(templateMessage(s, "ru"), /Загрузи выписку/);
});

test("Цель, поставленная в середине месяца, требует часть суммы", () => {
  const goal = { title: "Ноутбук", target_amount: 300000, start_amount: 0, start_date: "2024-10-15", deadline: "2025-01-14" };
  const s = computeInsights(data, goal, "2024-10-15");
  // ~100к в месяц, но в октябре осталось 17 дней из 31
  assert.ok(s.goal.requiredThisMonth > 50000 && s.goal.requiredThisMonth < 60000, String(s.goal.requiredThisMonth));
});
