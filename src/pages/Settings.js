import { useEffect, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";

function Settings() {

  const { currency, setCurrency } = useCurrency();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [cards, setCards] = useState([]);
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");

  const [budget, setBudget] = useState("");
  const [savedBudget, setSavedBudget] = useState(0);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    const cards = JSON.parse(localStorage.getItem("cards"));
    const budget = localStorage.getItem("budget");

    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }

    if (cards) setCards(cards);
    if (budget) setSavedBudget(Number(budget));
  }, []);

  const saveUser = () => {
    localStorage.setItem("user", JSON.stringify({ name, email }));
    alert("Saved");
  };

  const addCard = () => {
    if (!cardNumber || !cardName || !expiry) return;

    const newCard = {
      id: Date.now(),
      number: cardNumber,
      name: cardName,
      expiry
    };

    const updated = [...cards, newCard];

    setCards(updated);
    localStorage.setItem("cards", JSON.stringify(updated));

    setCardNumber("");
    setCardName("");
    setExpiry("");
  };

  const deleteCard = (id) => {
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
    localStorage.setItem("cards", JSON.stringify(updated));
  };

  const mask = (num) => "**** **** **** " + num.slice(-4);

  const saveBudget = () => {
    if (!budget) return;

    setSavedBudget(Number(budget));
    localStorage.setItem("budget", budget);
    setBudget("");
  };

  const resetAll = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="content">

      <h1>Settings</h1>

      <div className="box">
        <h3>Profile</h3>

        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button onClick={saveUser}>Save</button>
      </div>

      <div className="box">
        <h3>Currency</h3>

        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option value="USD">$ USD</option>
          <option value="KZT">₸ KZT</option>
          <option value="EUR">€ EUR</option>
        </select>
      </div>

      <div className="box">
        <h3>Monthly Budget</h3>

        {savedBudget === 0 ? (
          <>
            <input
              placeholder="Enter monthly limit"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <button onClick={saveBudget}>Set Budget</button>
          </>
        ) : (
          <>
            <p>Limit: {savedBudget}</p>
            <button onClick={() => {
              setSavedBudget(0);
              localStorage.removeItem("budget");
            }}>
              Change Budget
            </button>
          </>
        )}
      </div>

      <div className="box">
        <h3>Payment Cards</h3>

        <input
          placeholder="Card number"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
        />

        <input
          placeholder="Card holder"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
        />

        <input
          placeholder="MM/YY"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
        />

        <button onClick={addCard}>Add Card</button>

        {cards.map(card => (
          <div className="list-item" key={card.id}>
            <div>
              <b>{mask(card.number)}</b>
              <p>{card.name}</p>
            </div>

            <div>
              <span>{card.expiry}</span>
              <button onClick={() => deleteCard(card.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className="box">
        <h3>Danger Zone</h3>
        <button style={{ background: "#ef4444" }} onClick={resetAll}>
          Reset All Data
        </button>
      </div>

    </div>
  );
}

export default Settings;