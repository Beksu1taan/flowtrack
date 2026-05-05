import TransactionItem from "./TransactionItem";

function TransactionList({ transactions, onDelete }) {

  if (transactions.length === 0) {
    return (
      <p className="empty">
        No transactions yet. Start adding 🚀
      </p>
    );
  }

  return (
    <ul>
      {transactions.map(item => (
        <TransactionItem
          key={item.id}
          item={item}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

export default TransactionList;