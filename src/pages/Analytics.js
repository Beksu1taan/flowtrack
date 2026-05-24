import { useMemo } from "react";
import { useTx } from "../context/TransactionsContext";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function Analytics() {
  const { transactions } = useTx();

  // ✅ FIX ESLINT
  const tx = useMemo(() => {
    return transactions || [];
  }, [transactions]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    tx.forEach((t) => {
      if (t.type === "income") {
        income += Number(t.amount);
      } else {
        expense += Number(t.amount);
      }
    });

    return { income, expense };
  }, [tx]);

  const monthlyData = useMemo(() => {
    const map = {};

    tx.forEach((t) => {
      const date = new Date(t.date || Date.now());

      const month = date.toLocaleString("en", {
        month: "short",
      });

      if (!map[month]) {
        map[month] = {
          month,
          income: 0,
          expense: 0,
        };
      }

      if (t.type === "income") {
        map[month].income += Number(t.amount);
      } else {
        map[month].expense += Number(t.amount);
      }
    });

    return Object.values(map);
  }, [tx]);

  const categoryData = useMemo(() => {
    const map = {};

    tx.forEach((t) => {
      if (t.type !== "expense") return;

      if (!map[t.category]) {
        map[t.category] = 0;
      }

      map[t.category] += Number(t.amount);
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [tx]);

  const insights = useMemo(() => {
    const msgs = [];

    if (totals.expense > totals.income) {
      msgs.push("🚨 You spend more than you earn");
    }

    if (totals.expense < totals.income * 0.7) {
      msgs.push("✅ Great job! Your savings rate is strong");
    }

    categoryData.forEach((c) => {
      if (c.value > totals.expense * 0.35) {
        msgs.push(`⚠️ High spending detected in ${c.name}`);
      }
    });

    const predicted = totals.expense * 1.12;

    msgs.push(
      `📉 Predicted monthly spending: ~${predicted.toFixed(0)}`
    );

    return msgs;
  }, [totals, categoryData]);

  const COLORS = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#06b6d4",
  ];

  return (
    <div className="content">
      <h1 style={{ marginBottom: "30px" }}>
        Analytics Dashboard
      </h1>

      <div className="cards">
        <div className="card">
          <h3>Total Income</h3>

          <h1 className="green">
            ₸ {totals.income.toLocaleString()}
          </h1>
        </div>

        <div className="card">
          <h3>Total Expenses</h3>

          <h1 className="red">
            ₸ {totals.expense.toLocaleString()}
          </h1>
        </div>

        <div className="card">
          <h3>Balance</h3>

          <h1 className="blue">
            ₸ {(totals.income - totals.expense).toLocaleString()}
          </h1>
        </div>
      </div>

      <div className="box">
        <h2 style={{ marginBottom: "20px" }}>
          Monthly Spending Trend
        </h2>

        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient
                id="colorExpense"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#ef4444"
                  stopOpacity={0.3}
                />

                <stop
                  offset="95%"
                  stopColor="#ef4444"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              stroke="#94a3b8"
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "none",
                borderRadius: "8px",
              }}
              itemStyle={{
                color: "#fff",
              }}
            />

            <Area
              type="monotone"
              dataKey="expense"
              stroke="#ef4444"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorExpense)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="box">
        <h2 style={{ marginBottom: "20px" }}>
          Spending by Category
        </h2>

        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={categoryData}
              dataKey="value"
              nameKey="name"
              outerRadius={120}
              label
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="box">
        <h2 style={{ marginBottom: "20px" }}>
          AI Financial Insights
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {insights.map((msg, index) => (
            <div
              key={index}
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "#0f172a",
                border: "1px solid #1e293b",
              }}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Analytics;