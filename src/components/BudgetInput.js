function BudgetInput({ value, onChange }) {
  return (
    <input
      type="number"
      placeholder="Enter amount"
      value={value}
      onChange={onChange}
    />
  );
}

export default BudgetInput;