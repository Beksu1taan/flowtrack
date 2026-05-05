import { Pie } from "react-chartjs-2";
import {
Chart as ChartJS,
ArcElement,
Tooltip,
Legend
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

function ExpenseChart({ transactions }) {

  const expenses = transactions.filter(t => t.type === "expense");

  const categories = {};

  expenses.forEach(t => {
    categories[t.category] =
      (categories[t.category] || 0) + t.amount;
  });

  const data = {
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: [
        "#38bdf8",
        "#818cf8",
        "#4ade80",
        "#f87171",
        "#facc15"
      ]
    }]
  };

  return (
    <div className="box">
      <h3>Spending Breakdown</h3>
      <Pie data={data}/>
    </div>
  );
}

export default ExpenseChart;