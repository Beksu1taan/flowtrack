import { useTx } from "../context/TransactionsContext";

function Forecast() {
  const { transactions } = useTx();

  const safeTransactions = transactions || [];

  const income = safeTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = safeTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expense;

  return (
    <div className="box">
      <h3>Forecast</h3>

      <p>Income: {income}</p>
      <p>Expense: {expense}</p>
      <p>Balance: {balance}</p>

      {balance < 0 && (
        <p style={{ color: "red" }}>
          ⚠️ You may run out of money
        </p>
      )}

      {balance > 0 && (
        <p style={{ color: "green" }}>
          ✔️ Your finances look stable
        </p>
      )}
    </div>
  );
}

export default Forecast;