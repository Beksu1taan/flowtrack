// Прогноз и прогресс к цели. Чистые функции — легко тестировать.

const DAY_MS = 86400000;
const AVG_MONTH_DAYS = 30.44;

const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
const monthKey = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
function shiftMonth(y, m, delta) {
  const idx = y * 12 + (m - 1) + delta;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}
const sum = (arr) => arr.reduce((s, t) => s + Number(t.amount), 0);
const round = (n) => Math.round(n);

function computeInsights(transactions, goal, today) {
  const tx = (transactions || []).filter((t) => t.date);
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const d = +today.slice(8, 10);
  const D = daysInMonth(y, m);
  const curKey = monthKey(y, m);
  const [py, pm] = shiftMonth(y, m, -1);
  const prevKey = monthKey(py, pm);
  const prevDays = daysInMonth(py, pm);

  const inMonth = (key) => tx.filter((t) => t.date.startsWith(key));
  const exp = (list) => list.filter((t) => t.type === "expense");
  const inc = (list) => list.filter((t) => t.type === "income");

  const cur = inMonth(curKey).filter((t) => +t.date.slice(8, 10) <= d);
  const prev = inMonth(prevKey);
  const prevSame = prev.filter((t) => +t.date.slice(8, 10) <= Math.min(d, prevDays));

  const spentMTD = sum(exp(cur));
  const incomeMTD = sum(inc(cur));
  const prevSamePeriodSpent = sum(exp(prevSame));
  const prevMonthSpent = sum(exp(prev));
  const changePct = prevSamePeriodSpent > 0 ? ((spentMTD - prevSamePeriodSpent) / prevSamePeriodSpent) * 100 : null;

  // Средние за последние 3 полных месяца, где были данные
  const history = [1, 2, 3].map((k) => {
    const [hy, hm] = shiftMonth(y, m, -k);
    const list = inMonth(monthKey(hy, hm));
    return { spent: sum(exp(list)), income: sum(inc(list)), has: list.length > 0 };
  }).filter((h) => h.has);
  const avgSpent = history.length ? history.reduce((s, h) => s + h.spent, 0) / history.length : null;
  const avgIncome = history.length ? history.reduce((s, h) => s + h.income, 0) / history.length : 0;

  // Прогноз расходов: в начале месяца больше доверяем истории, к концу — текущему темпу
  const linear = (spentMTD / d) * D;
  let projectedSpend = linear;
  if (avgSpent !== null) {
    const w = d / D;
    projectedSpend = w * linear + (1 - w) * Math.max(avgSpent, spentMTD);
  }
  projectedSpend = Math.max(projectedSpend, spentMTD);

  // Зарплата могла ещё не прийти — берём максимум из текущего и среднего дохода
  const expectedIncome = Math.max(incomeMTD, avgIncome);
  const projectedLeftover = expectedIncome - projectedSpend;
  const daysLeft = D - d + 1;

  // Категории, где траты выросли сильнее всего
  const byCat = (list) => exp(list).reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
    return acc;
  }, {});
  const curCats = byCat(cur);
  const prevCats = byCat(prevSame);
  const categoryChanges = Object.keys({ ...curCats, ...prevCats })
    .map((c) => ({
      category: c,
      current: round(curCats[c] || 0),
      previous: round(prevCats[c] || 0),
      diff: round((curCats[c] || 0) - (prevCats[c] || 0)),
    }))
    .sort((a, b) => b.diff - a.diff);
  const topCategory = Object.entries(curCats).sort((a, b) => b[1] - a[1])[0] || null;

  // ----- Цель -----
  let goalStats = null;
  let requiredThisMonth = 0;
  if (goal) {
    const monthStart = `${curKey}-01`;
    const start = String(goal.start_date).slice(0, 10);
    const deadline = String(goal.deadline).slice(0, 10);
    const net = (list) => sum(inc(list)) - sum(exp(list));
    const sinceStart = tx.filter((t) => t.date >= start && t.date <= today);
    const beforeMonth = sinceStart.filter((t) => t.date < monthStart);

    const target = Number(goal.target_amount);
    const startAmount = Number(goal.start_amount || 0);
    const saved = startAmount + net(sinceStart);
    const savedBeforeMonth = startAmount + net(beforeMonth);
    const remainingBeforeMonth = Math.max(0, target - savedBeforeMonth);

    const from = start > monthStart ? start : monthStart;
    const daysToDeadline = Math.max(0, (toUTC(deadline) - toUTC(today)) / DAY_MS);
    const monthsFromMonthStart = Math.max((toUTC(deadline) - toUTC(from)) / DAY_MS / AVG_MONTH_DAYS, daysLeft / AVG_MONTH_DAYS);
    const requiredPerMonth = remainingBeforeMonth / Math.max(monthsFromMonthStart, 1 / AVG_MONTH_DAYS);
    // Если цель поставили в середине месяца — в этом месяце нужна только часть суммы
    const startedThisMonth = start > monthStart;
    const shareOfMonth = startedThisMonth ? (D - +start.slice(8, 10) + 1) / D : 1;
    requiredThisMonth = Math.min(remainingBeforeMonth, requiredPerMonth * shareOfMonth);

    const gapThisMonth = projectedLeftover - requiredThisMonth;
    // Прогноз на дедлайн: если каждый месяц откладывать как в этом
    const restOfThisMonth = projectedLeftover - (incomeMTD - spentMTD);
    const fullMonthsAfter = Math.max(0, (daysToDeadline - daysLeft) / AVG_MONTH_DAYS);
    const projectedAtDeadline = saved + restOfThisMonth + Math.max(0, projectedLeftover) * fullMonthsAfter;

    let status = "on_track";
    if (saved >= target) status = "done";
    else if (daysToDeadline <= 0) status = "overdue";
    else if (gapThisMonth < 0) status = gapThisMonth > -0.15 * requiredThisMonth ? "at_risk" : "off_track";

    goalStats = {
      title: goal.title,
      target: round(target),
      saved: round(saved),
      progressPct: target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0,
      remaining: round(Math.max(0, target - saved)),
      deadline,
      daysToDeadline: Math.round(daysToDeadline),
      requiredPerMonth: round(requiredPerMonth),
      requiredThisMonth: round(requiredThisMonth),
      gapThisMonth: round(gapThisMonth),
      projectedAtDeadline: round(projectedAtDeadline),
      status,
    };
  }

  // Сколько можно тратить в день до конца месяца
  const allowedMonthSpend = expectedIncome - requiredThisMonth;
  const dailyLimit = (allowedMonthSpend - spentMTD) / daysLeft;

  let status = "ok";
  if (goalStats) status = goalStats.status;
  else if (projectedLeftover < 0) status = "off_track";
  else if (changePct !== null && changePct > 15) status = "at_risk";

  // Накопленные траты по дням: этот месяц, прошлый и прогноз
  const cumulative = (list, days) => {
    const perDay = new Array(days + 1).fill(0);
    exp(list).forEach((t) => { perDay[+t.date.slice(8, 10)] += Number(t.amount); });
    let acc = 0;
    return perDay.slice(1).map((v) => (acc += v));
  };
  const curCum = cumulative(cur, D);
  const prevCum = cumulative(prev, prevDays);
  const series = Array.from({ length: D }, (_, i) => {
    const day = i + 1;
    const projection = day >= d ? spentMTD + ((projectedSpend - spentMTD) * (day - d)) / Math.max(1, D - d) : null;
    return {
      day,
      current: day <= d ? round(curCum[i]) : null,
      previous: day <= prevDays ? round(prevCum[i]) : null,
      projection: projection !== null ? round(projection) : null,
    };
  });

  return {
    today,
    month: curKey,
    dayOfMonth: d,
    daysInMonth: D,
    daysLeft,
    spentMTD: round(spentMTD),
    incomeMTD: round(incomeMTD),
    prevSamePeriodSpent: round(prevSamePeriodSpent),
    prevMonthSpent: round(prevMonthSpent),
    changePct: changePct === null ? null : Math.round(changePct),
    avgDailySpend: round(spentMTD / d),
    projectedSpend: round(projectedSpend),
    expectedIncome: round(expectedIncome),
    projectedLeftover: round(projectedLeftover),
    dailyLimit: round(dailyLimit),
    topCategory: topCategory ? { category: topCategory[0], amount: round(topCategory[1]) } : null,
    categoryChanges: categoryChanges.slice(0, 5),
    goal: goalStats,
    status,
    hasData: tx.length > 0,
    series,
  };
}

// ----- Шаблонный текст (работает без AI) -----

const CAT_RU = {
  food: "кафе и доставку", groceries: "продукты", transport: "транспорт", shopping: "покупки",
  utilities: "коммуналку и связь", health: "здоровье", entertainment: "развлечения", education: "учёбу",
  beauty: "красоту", transfers: "переводы", cash: "наличные", other: "другое",
};
const CAT_EN = {
  food: "eating out", groceries: "groceries", transport: "transport", shopping: "shopping",
  utilities: "bills", health: "health", entertainment: "entertainment", education: "education",
  beauty: "beauty", transfers: "transfers", cash: "cash", other: "other",
};

const fmt = (n) => `${Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/,/g, " ")} ₸`;

function templateMessage(s, lang = "ru") {
  const en = lang === "en";
  const cat = (c) => (en ? CAT_EN : CAT_RU)[c] || c;
  if (!s.hasData) {
    return en
      ? "No data yet. Import a Kaspi or Halyk statement — I'll sort your spending into categories and show a forecast."
      : "Пока нет данных. Загрузи выписку Kaspi или Halyk — я разложу траты по категориям и покажу прогноз.";
  }
  const parts = [];

  if (s.changePct !== null) {
    const more = s.changePct > 0;
    parts.push(en
      ? `This month you've spent ${fmt(s.spentMTD)} — ${Math.abs(s.changePct)}% ${more ? "more" : "less"} than in the same days last month (${fmt(s.prevSamePeriodSpent)}).`
      : `За этот месяц ты потратил ${fmt(s.spentMTD)} — на ${Math.abs(s.changePct)}% ${more ? "больше" : "меньше"}, чем за те же дни прошлого месяца (${fmt(s.prevSamePeriodSpent)}).`);
  } else {
    parts.push(en ? `This month you've spent ${fmt(s.spentMTD)}.` : `За этот месяц ты потратил ${fmt(s.spentMTD)}.`);
  }

  parts.push(s.projectedLeftover >= 0
    ? (en ? `At this pace you'll have about ${fmt(s.projectedLeftover)} left at the end of the month.`
          : `Если тратить в таком темпе, к концу месяца останется около ${fmt(s.projectedLeftover)}.`)
    : (en ? `At this pace you'll be ${fmt(s.projectedLeftover)} short by the end of the month.`
          : `Если тратить в таком темпе, к концу месяца уйдёшь в минус примерно на ${fmt(s.projectedLeftover)}.`));

  const g = s.goal;
  if (g) {
    if (g.status === "done") {
      parts.push(en ? `Goal «${g.title}» is reached — great job!` : `Цель «${g.title}» достигнута — отличная работа!`);
    } else if (g.status === "overdue") {
      parts.push(en ? `The deadline for «${g.title}» has passed, ${fmt(g.remaining)} left. Set a new date.` : `Срок цели «${g.title}» прошёл, осталось ${fmt(g.remaining)}. Поставь новую дату.`);
    } else if (g.gapThisMonth < 0) {
      parts.push(en
        ? `For «${g.title}» you need to save ${fmt(g.requiredThisMonth)} this month, so you're ${fmt(g.gapThisMonth)} behind the goal.`
        : `Для цели «${g.title}» в этом месяце нужно отложить ${fmt(g.requiredThisMonth)}, так что по цели ты в минусе на ${fmt(g.gapThisMonth)}.`);
    } else {
      parts.push(en
        ? `You're on track for «${g.title}»: you need ${fmt(g.requiredThisMonth)} this month and should have ${fmt(g.gapThisMonth)} extra.`
        : `По цели «${g.title}» ты успеваешь: нужно отложить ${fmt(g.requiredThisMonth)}, и ещё останется запас ${fmt(g.gapThisMonth)}.`);
    }
  }

  const grow = s.categoryChanges.find((c) => c.diff > 0);
  if (s.status !== "ok" && s.status !== "on_track" && s.status !== "done") {
    if (grow) {
      parts.push(en ? `Biggest growth is in ${cat(grow.category)} (+${fmt(grow.diff)}).` : `Больше всего выросли траты на ${cat(grow.category)} (+${fmt(grow.diff)}).`);
    }
    parts.push(s.dailyLimit > 0
      ? (en ? `Try to keep spending under ${fmt(s.dailyLimit)} a day until the end of the month.`
            : `Постарайся тратить не больше ${fmt(s.dailyLimit)} в день до конца месяца.`)
      : (en ? "This month's budget is already used up — until the month ends, spend only on essentials."
            : "Бюджет этого месяца уже исчерпан — до конца месяца лучше тратить только на самое необходимое."));
  }
  return parts.join(" ");
}

module.exports = { computeInsights, templateMessage, daysInMonth };
