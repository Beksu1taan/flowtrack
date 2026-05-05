function Forecast({ transactions }) {

  const total = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const forecast = total * 2;

  return (
    <div className="box">

      <h3>Forecast</h3>

      <h2 className="red">${forecast}</h2>

      <p>Based on your spending pattern</p>

    </div>
  );
}

export default Forecast;