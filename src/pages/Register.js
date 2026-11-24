import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8 || !/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
      setError("Пароль: минимум 8 символов, буквы и цифры");
      return;
    }
    if (!consent) {
      setError("Нужно согласие на обработку персональных данных");
      return;
    }
    setLoading(true);
    try {
    
      login(await registerUser({ name, email, password, consent, aiConsent }));
      navigate("/import");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleRegister}>
        <h1 className="logo">FlowTrack</h1>
        <p className="muted small">{t("tagline")}</p>
        <h2>{t("register")}</h2>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name")} required autoComplete="name" />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email")} required autoComplete="email" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} required autoComplete="new-password" minLength={8} />

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Я согласен(на) на сбор и обработку моих персональных данных в соответствии с{" "}
            <Link to="/privacy" target="_blank">Политикой конфиденциальности</Link> <span className="red">*</span>
          </span>
        </label>
        <label className="consent">
          <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
          <span>
            Разрешаю AI-обработку (Claude, Anthropic, США) — трансграничная передача названий магазинов и сводных сумм без ФИО, ИИН и номеров карт.
            Необязательно, можно включить позже.
          </span>
        </label>

        {error && <p className="red small">{error}</p>}

        <button type="submit" disabled={loading || !consent}>{loading ? t("loading") : t("register")}</button>

        <p>
          {t("haveAccount")} <Link to="/login">{t("login")}</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
