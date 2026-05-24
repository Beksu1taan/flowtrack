const BASE = "https://flowtrack-production-4951.up.railway.app/api";

// AUTH
export const loginUser = async (data) => {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const registerUser = async (data) => {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await res.text());
};

// TRANSACTIONS 
export const getTransactions = async (userId) => {
  const res = await fetch(`${BASE}/transactions/${userId}`);
  if (!res.ok) throw new Error("Error loading");
  return res.json();
};

export const addTransaction = async (data) => {
  const res = await fetch(`${BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Add error");
};

export const deleteTransaction = async (id) => {
  const res = await fetch(`${BASE}/transactions/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("Delete error");
};