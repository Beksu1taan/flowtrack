const mysql = require("mysql2/promise");

// Все доступы к БД берутся только из переменных окружения (.env / Railway).
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "flowtrack",
  port: Number(process.env.MYSQLPORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // DECIMAL приходит числом, а не строкой
  dateStrings: true, // DATE приходит как "2026-10-27"
});

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(table, index) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
}

// Создаёт таблицы и мягко дополняет старую схему (старые данные не теряются).
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      category VARCHAR(50) NOT NULL,
      type VARCHAR(10) NOT NULL
    )`);

  // Старый пароль хранился как VARCHAR маленькой длины — bcrypt-хешу нужно 60 символов.
  await pool.query(`ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL`);
  const userColumns = {
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    consent_at: "TIMESTAMP NULL", // когда дал согласие на обработку персональных данных
    privacy_version: "VARCHAR(20) NULL", // какую версию политики принял
    ai_consent: "TINYINT(1) NOT NULL DEFAULT 0", // отдельное согласие на обработку через AI
  };
  for (const [col, def] of Object.entries(userColumns)) {
    if (!(await columnExists("users", col))) {
      await pool.query(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
    }
  }

  const txColumns = {
    date: "DATE NULL",
    description: "VARCHAR(255) NULL",
    source: "VARCHAR(20) NOT NULL DEFAULT 'manual'",
    hash: "VARCHAR(64) NULL",
    created_at: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  };
  for (const [col, def] of Object.entries(txColumns)) {
    if (!(await columnExists("transactions", col))) {
      await pool.query(`ALTER TABLE transactions ADD COLUMN ${col} ${def}`);
    }
  }
  // У старых записей не было даты — ставим дату создания.
  await pool.query(`UPDATE transactions SET date = DATE(created_at) WHERE date IS NULL`);
  await pool.query(`ALTER TABLE transactions MODIFY amount DECIMAL(14,2) NOT NULL`);
  // Зашифрованное описание длиннее исходного
  await pool.query(`ALTER TABLE transactions MODIFY description TEXT NULL`);

  if (!(await indexExists("transactions", "uniq_user_hash"))) {
    await pool.query(`ALTER TABLE transactions ADD UNIQUE INDEX uniq_user_hash (user_id, hash)`);
  }
  if (!(await indexExists("transactions", "idx_user_date"))) {
    await pool.query(`ALTER TABLE transactions ADD INDEX idx_user_date (user_id, date)`);
  }

  // Одна активная цель на пользователя.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      title VARCHAR(120) NOT NULL,
      target_amount DECIMAL(14,2) NOT NULL,
      start_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      start_date DATE NOT NULL,
      deadline DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // «Всегда считай X как Y» — правила пользователя.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS category_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      pattern VARCHAR(120) NOT NULL,
      category VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_pattern (user_id, pattern)
    )`);

  // Общий кэш ответов AI по мерчантам: один раз спросили — дальше бесплатно.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchant_cache (
      merchant_key VARCHAR(120) PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}

// Шифрует описания, которые были сохранены до включения шифрования
async function encryptLegacyRows() {
  const { encrypt, encryptionEnabled, isEncrypted } = require("./lib/privacy");
  if (!encryptionEnabled()) return 0;
  const [rows] = await pool.query(
    "SELECT id, description FROM transactions WHERE description IS NOT NULL AND description <> '' AND description NOT LIKE 'enc:v1:%' LIMIT 5000"
  );
  for (const r of rows) {
    if (!isEncrypted(r.description)) {
      await pool.query("UPDATE transactions SET description = ? WHERE id = ?", [encrypt(r.description), r.id]);
    }
  }
  return rows.length;
}

module.exports = { pool, initSchema, encryptLegacyRows };
