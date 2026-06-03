import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { importStatements } from "../../core/importer/index.js";
import { materializeTransactions } from "../../core/ledger/materialize.js";
import { rebuildIndex } from "../../core/storage/sqlite.js";
import { dataPaths } from "../../core/storage/paths.js";
import { fileExists, readText, writeText } from "../../core/storage/fileops.js";
import { parseCsv } from "../../core/importer/csv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(app.getPath("userData"), "config.json");
let dataDir = loadConfig();

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed.dataDir || "";
  } catch {
    return "";
  }
}

function saveConfig(dir) {
  const payload = { dataDir: dir };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf8");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(app.getAppPath(), "renderer/dist/index.html"));
  }
}

ipcMain.handle("kaldi:selectDataDir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return dataDir;
  dataDir = result.filePaths[0];
  saveConfig(dataDir);
  return dataDir;
});

ipcMain.handle("kaldi:getDataDir", async () => dataDir);

ipcMain.handle("kaldi:importInbox", async () => {
  if (!dataDir) return { error: "No data directory set" };
  const paths = dataPaths(dataDir);
  fs.mkdirSync(paths.inbox, { recursive: true });
  const files = fs.readdirSync(paths.inbox).map((f) => path.join(paths.inbox, f));
  const csvFiles = files.filter((f) => f.toLowerCase().endsWith(".csv"));
  const results = importStatements(dataDir, csvFiles);
  return { results };
});

ipcMain.handle("kaldi:materialize", async () => {
  if (!dataDir) return { error: "No data directory set" };
  materializeTransactions(dataDir);
  rebuildIndex(dataDir);
  return { ok: true, index: "disabled" };
});

ipcMain.handle("kaldi:loadTransactions", async () => {
  if (!dataDir) return { error: "No data directory set" };
  const paths = dataPaths(dataDir);
  if (!fileExists(paths.transactionsCsv)) return { rows: [] };
  const rows = parseCsv(readText(paths.transactionsCsv));
  return { rows };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
