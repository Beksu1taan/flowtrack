import { useMemo } from "react";
import { useTx } from "../context/TransactionsContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

function Analytics() {
  const { transactions } = useTx();
  const tx = transactions || [];
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    tx.forEach((t) => {
      if (t.type === "income") income += +t.amount;
      else expense += +t.amount;
    });

    return { income, expense };
  }, [tx]);

  const monthly = useMemo(() => {
    const map = {};

    tx.forEach((t) => {
      const m = new Date().toLocaleString("en", { month: "short" });

      if (!map[m]) map[m] = { income: 0, expense: 0 };

      if (t.type === "income") map[m].income += +t.amount;
      else map[m].expense += +t.amount;
    });

    return Object.entries(map).map(([month, v]) => ({
      month,
      ...v,
    }));
  }, [tx]);

  const categories = useMemo(() => {
    const map = {};

    tx.forEach((t) => {
      if (t.type !== "expense") return;

      if (!map[t.category]) map[t.category] = 0;
      map[t.category] += +t.amount;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [tx]);

  const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

  const insights = useMemo(() => {
    const msgs = [];

    const totalExpense = totals.expense;

    if (totalExpense > totals.income) {
      msgs.push("🚨 You are spending more than you earn!");
    }

    if (totalExpense < totals.income * 0.7) {
      msgs.push("Great job! You're saving money");
    }

    categories.forEach((c) => {
      if (c.value > totalExpense * 0.3) {
        msgs.push(`High spending on ${c.name}`);
      }
    });

    const forecast = totalExpense * 1.15;

    msgs.push(`Forecast: ~${forecast.toFixed(0)} this month`);

    return msgs;
  }, [totals, categories]);

  return (
    <div className="content">
      <h2>Analytics Dashboard</h2>

      {/* 💰 CARDS */}
      <div className="cards">
        <div className="card">
          <h3>Income</h3>
          <p className="green">{totals.income}</p>
        </div>

        <div className="card">
          <h3>Expenses</h3>
          <p className="red">{totals.expense}</p>
        </div>
      </div>

      {/* 📈 AREA */}
      <div className="box">
        <h3>Monthly Trend</h3>

        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />

            <Area dataKey="income" stroke="#22c55e" fill="#22c55e" />
            <Area dataKey="expense" stroke="#ef4444" fill="#ef4444" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 📊 BAR */}
      <div className="box">
        <h3>Income vs Expense</h3>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />

            <Bar dataKey="income" fill="#22c55e" />
            <Bar dataKey="expense" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🥧 PIE */}
      <div className="box">
        <h3>Spending by Category</h3>

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={categories} dataKey="value" outerRadius={100}>
              {categories.map((c, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 🤖 INSIGHTS */}
      <div className="box">
        <h3>Smart Insights</h3>

        {insights.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
    </div>
  );
}

export default Analytics;