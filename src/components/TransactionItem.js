import { useNavigate } from "react-router-dom";

function TransactionItem({ item, onDelete }) {

  const navigate = useNavigate();

  return (
    <div
      className="list-item"
      onClick={() => navigate(`/transactions/details/${item.id}`)}
    >

      <div className="left">
        <div className="icon">💸</div>

        <div>
          <b>{item.category}</b>
          <p>{item.type}</p>
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <span className={item.type === "expense" ? "red" : "green"}>
          ${item.amount.toLocaleString()}
        </span>

        <button onClick={() => onDelete(item.id)}>✕</button>
      </div>

    </div>
  );
}

export default TransactionItem;