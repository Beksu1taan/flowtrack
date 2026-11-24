import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

const NAV = [
  ["/", "📊", "dashboard"],
  ["/import", "📥", "import"],
  ["/transactions", "🧾", "transactions"],
  ["/analytics", "📈", "analytics"],
  ["/forecast", "🔮", "forecast"],
  ["/settings", "⚙️", "settings"],
];

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
    <aside className="sidebar">
      <h2 className="logo">FlowTrack</h2>

      {user && (
        <div className="user-box">
          <p>👋 {user.name}</p>
          <span>{user.email}</span>
        </div>
      )}

      <nav className="nav">
        {NAV.map(([to, icon, key]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{t(key)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="controls">
        <button className="ghost" onClick={toggleTheme}>
          {theme === "dark" ? t("themeDark") : t("themeLight")}
        </button>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
        <button className="logout" onClick={handleLogout}>
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}

export default Header;
