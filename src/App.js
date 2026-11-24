import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Header from "./components/Header";
import Footer from "./components/Footer";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";
import Analytics from "./pages/Analytics";
import ForecastPage from "./pages/ForecastPage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import ConsentGate from "./components/ConsentGate";

function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/privacy" element={<div className="content"><Privacy /></div>} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <Header />
      <ConsentGate />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<Import />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transaction/:id" element={<TransactionDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/login" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </main>
    </div>
  );
}

export default App;
