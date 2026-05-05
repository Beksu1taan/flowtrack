import MainContent from "../components/MainContent";

function Dashboard({ transactions, setTransactions }) {
  return (
    <div className="content">
      <h1>Dashboard</h1>

      <MainContent
        transactions={transactions}
        setTransactions={setTransactions}
      />
    </div>
  );
}

export default Dashboard;