import { useParams, useNavigate } from "react-router-dom";
import { useTx } from "../context/TransactionsContext";

function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { transactions } = useTx();

  const tx = (transactions || []).find(
    (t) => t.id === Number(id)
  );

  if (!tx) {
    return (
      <div className="content">
        <p>Transaction not found</p>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  return (
    <div className="content">
      <h2>Transaction Details</h2>

      <div className="box">
        <p><b>Category:</b> {tx.category}</p>
        <p><b>Amount:</b> {tx.amount}</p>
        <p><b>Type:</b> {tx.type}</p>
      </div>

      <button onClick={() => navigate(-1)}>⬅ Back</button>
    </div>
  );
}

export default TransactionDetail;