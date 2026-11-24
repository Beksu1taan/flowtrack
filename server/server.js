const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
// Запасной вариант для локального запуска: настройки в local-settings.txt (формат как в .env)
require("dotenv").config({ path: path.join(__dirname, "local-settings.txt") });

const app = require("./app");
const { initSchema, encryptLegacyRows } = require("./db");
const { initEncryption } = require("./lib/privacy");

const PORT = process.env.PORT || 5000;

initEncryption();

initSchema()
  .then(encryptLegacyRows)
  .then((n) => {
    console.log("✅ MySQL подключена, схема обновлена");
    if (n) console.log(`🔒 Зашифровано старых записей: ${n}`);
    app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Не удалось подключиться к БД:", err.message);
    process.exit(1);
  });
