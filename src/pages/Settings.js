import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useTx } from "../context/TransactionsContext";
import { Link } from "react-router-dom";
import { getRules, deleteRule, getHealth, deleteAllTransactions, getMe, updateMe, exportMe, deleteMe } from "../services/api";
import { catInfo } from "../categories";

function Settings() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const { reload } = useTx();
  const [me, setMe] = useState(null);
  const [delPassword, setDelPassword] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delError, setDelError] = useState("");

  const [rules, setRules] = useState([]);
  const [aiOn, setAiOn] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRules().then(setRules).catch(() => {});
    getHealth().then((h) => setAiOn(h.ai)).catch(() => setAiOn(false));
    getMe().then(setMe).catch(() => {});
  }, []);

  const removeRule = async (id) => {
    await deleteRule(id);
    setRules((list) => list.filter((r) => r.id !== id));
  };

  const toggleAi = async (value) => {
    setMe(await updateMe({ aiConsent: value }));
    reload();
  };

  const download = async () => {
    const data = await exportMe();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flowtrack-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    setDelError("");
    try {
      await deleteMe(delPassword);
      logout();
    } catch (e) {
      setDelError(e.message);
    }
  };

  const removeAll = async () => {
    if (!window.confirm(t("deleteAllConfirm"))) return;
    const res = await deleteAllTransactions();
    setMessage(t("deleted", { count: res.deleted }));
    reload();
  };

  return (
    <div className="page narrow">
      <h1>⚙️ {t("settingsTitle")}</h1>

      <div className="box">
        <h3>{t("profile")}</h3>
        <p><b>{user.name}</b></p>
        <p className="muted">{user.email}</p>
        <button className="logout" onClick={logout}>{t("logout")}</button>
      </div>

      <div className="box grid2 tight">
        <label>
          {t("language")}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t("theme")}
          <button type="button" className="ghost wide" onClick={toggleTheme}>
            {theme === "dark" ? t("themeDark") : t("themeLight")}
          </button>
        </label>
      </div>

      <div className="box">
        <h3>🤖 {t("aiStatus")}</h3>
        {aiOn === null ? (
          <p className="muted">{t("loading")}</p>
        ) : !aiOn ? (
          <p className="muted">{t("aiOff")}</p>
        ) : (
          <>
            <label className="consent">
              <input type="checkbox" checked={Boolean(me && me.aiConsent)} onChange={(e) => toggleAi(e.target.checked)} />
              <span>
                Разрешить AI-обработку (Claude, Anthropic, США). В AI уходят только названия магазинов и сводные суммы —
                без ФИО, ИИН, номеров карт и имён получателей переводов. Отзыв действует сразу.
              </span>
            </label>
            <p className="muted small">{me && me.aiConsent ? "AI включён." : "AI выключен — работает встроенный словарь мерчантов."}</p>
          </>
        )}
      </div>

      <div className="box">
        <h3>🔒 Мои данные</h3>
        <p className="muted small">
          Файлы выписок не сохраняются. Описания операций хранятся зашифрованными.{" "}
          <Link to="/privacy">Политика конфиденциальности</Link>
          {me && me.consentAt && <> · согласие дано {String(me.consentAt).slice(0, 10)}</>}
        </p>
        <div className="btn-row">
          <button className="ghost" onClick={download}>⬇ Скачать мои данные</button>
        </div>
      </div>

      <div className="box">
        <h3>🏷️ {t("rules")}</h3>
        {rules.length === 0 && <p className="muted">{t("rulesEmpty")}</p>}
        {rules.map((r) => {
          const c = catInfo(r.category, lang);
          return (
            <div key={r.id} className="merchant">
              <span>«{r.pattern}»</span>
              <span>→ {c.icon} {c.label}</span>
              <button className="icon-btn" onClick={() => removeRule(r.id)}>✕</button>
            </div>
          );
        })}
      </div>

      <div className="box danger-box">
        <h3>{t("dangerZone")}</h3>
        <button className="danger-btn" onClick={removeAll}>{t("deleteAll")}</button>
        {message && <p className="muted">{message}</p>}

        {!delOpen ? (
          <button className="ghost danger" onClick={() => setDelOpen(true)}>Удалить аккаунт и все данные</button>
        ) : (
          <div className="box">
            <p>Аккаунт, все операции, цели и правила будут удалены без возможности восстановления. Введи пароль для подтверждения.</p>
            <input type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} placeholder="Пароль" />
            {delError && <p className="red small">{delError}</p>}
            <div className="btn-row">
              <button className="danger-btn" disabled={!delPassword} onClick={deleteAccount}>Удалить навсегда</button>
              <button className="ghost" onClick={() => setDelOpen(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
