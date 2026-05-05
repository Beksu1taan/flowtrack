const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2005Asdf",
  database: "flowtrack",
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB error:", err);
  } else {
    console.log("✅ MySQL connected");
  }
});

module.exports = db;