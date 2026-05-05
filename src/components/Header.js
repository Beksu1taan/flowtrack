import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

function Header() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="sidebar">
      <h2 className="logo">FlowTrack</h2>

      {user && (
        <div className="user-box">
          <p>👋 {user.name}</p>
          <span>{user.email}</span>
        </div>
      )}

      <nav className="nav">
        <NavLink to="/">{t("dashboard")}</NavLink>
        <NavLink to="/transactions">{t("transactions")}</NavLink>
        <NavLink to="/analytics">{t("analytics")}</NavLink>
        <NavLink to="/forecast">{t("forecast")}</NavLink>
        <NavLink to="/settings">{t("settings")}</NavLink>
      </nav>

      <div className="controls">
        <button onClick={toggleTheme}>
          {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>

        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>

        {user && (
          <button className="logout" onClick={handleLogout}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default Header;