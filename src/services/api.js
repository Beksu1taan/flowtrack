const BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");

const getToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error("Нет связи с сервером");
  }

  const data = await res.json().catch(() => null);
  if (res.status === 401 && token) {
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!res.ok) throw new Error((data && data.error) || `Ошибка ${res.status}`);
  return data;
}

// AUTH
export const loginUser = (data) => request("/login", { method: "POST", body: data });
export const registerUser = (data) => request("/register", { method: "POST", body: data });
export const getMe = () => request("/me");
export const updateMe = (data) => request("/me", { method: "PATCH", body: data });
export const deleteMe = (password) => request("/me", { method: "DELETE", body: { password } });
export const exportMe = () => request("/me/export");

// TRANSACTIONS
export const getTransactions = () => request("/transactions");
export const addTransaction = (data) => request("/transactions", { method: "POST", body: data });
export const updateTransaction = (id, data) => request(`/transactions/${id}`, { method: "PATCH", body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: "DELETE" });
export const deleteAllTransactions = () => request("/transactions", { method: "DELETE" });

// IMPORT
export const previewImport = (file) => {
  const form = new FormData();
  form.append("file", file);
  return request("/import/preview", { method: "POST", form });
};
export const commitImport = (data) => request("/import/commit", { method: "POST", body: data });

// RULES
export const getRules = () => request("/rules");
export const deleteRule = (id) => request(`/rules/${id}`, { method: "DELETE" });

// GOAL
export const getGoal = () => request("/goal");
export const saveGoal = (data) => request("/goal", { method: "PUT", body: data });
export const deleteGoal = () => request("/goal", { method: "DELETE" });

// AI INSIGHTS
export const getInsights = (lang = "ru") => request(`/insights?lang=${lang}`);
export const getHealth = () => request("/health");
