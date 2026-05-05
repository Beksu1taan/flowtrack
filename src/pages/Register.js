import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      alert("Fill all fields");
      return;
    }

    if (!email.includes("@")) {
      alert("Invalid email");
      return;
    }

    if (password.length < 3) {
      alert("Password too short");
      return;
    }

    try {
      await registerUser({ name, email, password });
      alert("Registered!");
      navigate("/login");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Register</h2>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />

        <button onClick={handleRegister}>Register</button>
      </div>
    </div>
  );
}

export default Register;