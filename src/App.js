import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Header from "./components/Header";
import Footer from "./components/Footer";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Analytics from "./pages/Analytics";
import ForecastPage from "./pages/ForecastPage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

function App() {
  const { user } = useAuth();

  // НЕ ЗАЛОГИНЕН
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // ЗАЛОГИНЕН
  return (
    <div className="app">
      <Header />

      <div className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transaction/:id" element={<TransactionDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/settings" element={<Settings />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}

export default App;