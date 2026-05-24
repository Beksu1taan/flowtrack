require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
});

db.connect((err) => {
  if (err) {
    console.log("DB ERROR:", err);
  } else {
    console.log("MySQL connected");
  }
});

app.get("/", (req, res) => {
  res.send("Server works");
});

app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send("Fill all fields");
  }

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    (err, result) => {
      if (err) return res.status(500).send("Server error");

      if (result.length > 0) {
        return res.status(400).send("User already exists");
      }

      db.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, password],
        (err) => {
          if (err) return res.status(500).send("Insert error");

          res.send("Registered successfully");
        }
      );
    }
  );
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, result) => {
      if (err) return res.status(500).send("Server error");

      if (result.length === 0) {
        return res.status(401).send("Wrong email or password");
      }

      res.json(result[0]);
    }
  );
});

app.get("/api/transactions/:userId", (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT * FROM transactions WHERE user_id = ?",
    [userId],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error loading");
      }

      res.json(result);
    }
  );
});

app.post("/api/transactions", (req, res) => {
  const { user_id, amount, category, type } = req.body;

  db.query(
    "INSERT INTO transactions (user_id, amount, category, type) VALUES (?, ?, ?, ?)",
    [user_id, amount, category, type],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error adding");
      }

      res.send("Added");
    }
  );
});

app.delete("/api/transactions/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    "DELETE FROM transactions WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error deleting");
      }

      res.send("Deleted");
    }
  );
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});