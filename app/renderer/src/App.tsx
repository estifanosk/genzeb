import React, { useState } from "react";
import Transactions from "./routes/Transactions";

const tabs = ["Transactions", "Receipts", "Reconcile", "Settings"] as const;

export default function App() {
  const [active, setActive] = useState<(typeof tabs)[number]>("Transactions");

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Kaldi Expense</h1>
        <nav style={{ display: "flex", gap: 8 }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                padding: "6px 10px",
                border: "1px solid #ccc",
                background: active === t ? "#fff" : "#f0ede7",
                cursor: "pointer"
              }}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {active === "Transactions" && <Transactions />}
      {active !== "Transactions" && (
        <div style={{ color: "#666" }}>Scaffold: {active} view coming next.</div>
      )}
    </div>
  );
}
