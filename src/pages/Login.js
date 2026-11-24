import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      login(await loginUser({ email, password }));
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleLogin}>
        <h1 className="logo">FlowTrack</h1>
        <p className="muted small">{t("tagline")}</p>
        <h2>{t("login")}</h2>

        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email")} required autoComplete="email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} required autoComplete="current-password" />

        {error && <p className="red small">{error}</p>}

        <button type="submit" disabled={loading}>{loading ? t("loading") : t("login")}</button>

        <p>
          {t("noAccount")} <Link to="/register">{t("register")}</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
