import React, { useEffect, useState } from "react";

type TxRow = Record<string, string>;

type ImportResult = {
  file: string;
  rowsImported: number;
  rowsSkipped: number;
  errors: string[];
};

declare global {
  interface Window {
    kaldi?: {
      selectDataDir: () => Promise<string>;
      getDataDir: () => Promise<string>;
      importInbox: () => Promise<{ results?: ImportResult[]; error?: string }>;
      materialize: () => Promise<{ ok?: boolean; error?: string }>;
      loadTransactions: () => Promise<{ rows: TxRow[]; error?: string }>;
    };
  }
}

export default function Transactions() {
  const [dataDir, setDataDir] = useState("");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!window.kaldi) {
      setStatus("Electron API unavailable. Run this screen with npm run dev so the preload bridge is available.");
      return;
    }
    window.kaldi.getDataDir().then(setDataDir).catch(() => setStatus("Failed to load data dir"));
  }, []);

  async function onSelectDir() {
    if (!window.kaldi) return setStatus("Electron API unavailable");
    const dir = await window.kaldi.selectDataDir();
    setDataDir(dir);
  }

  async function onImport() {
    if (!window.kaldi) return setStatus("Electron API unavailable");
    setStatus("Importing...");
    const res = await window.kaldi.importInbox();
    if (res.error) {
      setStatus(res.error);
      return;
    }
    const total = res.results?.reduce((sum, r) => sum + r.rowsImported, 0) ?? 0;
    setStatus(`Imported ${total} rows`);
  }

  async function onMaterialize() {
    if (!window.kaldi) return setStatus("Electron API unavailable");
    setStatus("Materializing...");
    const res = await window.kaldi.materialize();
    if (res.error) {
      setStatus(res.error);
      return;
    }
    setStatus("Materialized transactions + index");
  }

  async function onLoad() {
    if (!window.kaldi) return setStatus("Electron API unavailable");
    const res = await window.kaldi.loadTransactions();
    if (res.error) {
      setStatus(res.error);
      return;
    }
    setRows(res.rows ?? []);
    setStatus(`Loaded ${res.rows.length} rows`);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <button onClick={onSelectDir}>Select Data Folder</button>
        <button onClick={onImport}>Import Inbox</button>
        <button onClick={onMaterialize}>Materialize</button>
        <button onClick={onLoad}>Load Transactions</button>
        <div style={{ color: "#666" }}>{dataDir || "No data folder set"}</div>
      </div>

      {status && <div style={{ marginBottom: 12, color: "#444" }}>{status}</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search merchant, description, notes"
          style={{ flex: 1, padding: 8 }}
        />
        <button>Filters</button>
        <button>Export</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select>
          <option>Date: Last 90 days</option>
        </select>
        <select>
          <option>Category: All</option>
        </select>
        <select>
          <option>Account: All</option>
        </select>
        <select>
          <option>Receipt: Any</option>
        </select>
      </div>

      <div style={{ border: "1px solid #ddd", background: "#fff" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 600 }}>
          Transactions (table placeholder)
        </div>
        <div style={{ padding: 12, color: "#666" }}>
          Showing {rows.length} rows
        </div>
      </div>
    </div>
  );
}
