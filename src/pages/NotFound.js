import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

function NotFound() {
  const { t } = useLang();
  return (
    <div className="page center">
      <h1>404</h1>
      <p>{t("notFound")}</p>
      <Link to="/">{t("dashboard")} →</Link>
    </div>
  );
}

export default NotFound;
