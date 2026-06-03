import fs from "fs";
import path from "path";
import { parseCsv, toCsvLine } from "./csv";
import { hashFileContent } from "./hash";
import { appendLedgerRows } from "../ledger/append";
import { dataPaths } from "../storage/paths";
import { fileExists, writeText, appendText } from "../storage/fileops";
import { LedgerRow } from "../ledger/schema";

export type ImportResult = {
  file: string;
  rowsImported: number;
  rowsSkipped: number;
  errors: string[];
};

const IMPORT_HEADERS = [
  "import_id",
  "source_file",
  "source_hash",
  "file_type",
  "imported_at",
  "rows_imported",
  "rows_skipped",
  "notes"
];

export function importStatements(baseDir: string, filePaths: string[]): ImportResult[] {
  const results: ImportResult[] = [];
  const paths = dataPaths(baseDir);
  if (!fileExists(paths.importLogCsv)) {
    writeText(paths.importLogCsv, toCsvLine(IMPORT_HEADERS));
  }

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".csv") {
      results.push({ file: filePath, rowsImported: 0, rowsSkipped: 0, errors: ["unsupported file type"] });
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const sourceHash = hashFileContent(content);
    const rows = parseCsv(content);
    const ledgerRows: LedgerRow[] = rows.map((r) => toLedgerRow(r, filePath, sourceHash));

    appendLedgerRows(baseDir, ledgerRows);
    appendImportLog(paths.importLogCsv, {
      import_id: cryptoId(),
      source_file: path.basename(filePath),
      source_hash: sourceHash,
      file_type: "csv",
      imported_at: new Date().toISOString(),
      rows_imported: String(ledgerRows.length),
      rows_skipped: "0",
      notes: ""
    });

    results.push({ file: filePath, rowsImported: ledgerRows.length, rowsSkipped: 0, errors: [] });
  }

  return results;
}

function toLedgerRow(row: Record<string, string>, filePath: string, sourceHash: string): LedgerRow {
  const get = (keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v && v.trim().length > 0) return v.trim();
    }
    return "";
  };

  return {
    id: cryptoId(),
    account: get(["Account", "account", "Account Name", "account_name"]),
    date: normalizeDate(get(["Date", "date", "Transaction Date", "transaction_date"])),
    post_date: normalizeDate(get(["Post Date", "post_date", "Posted Date", "posted_date"])),
    description_raw: get(["Description", "description", "Memo", "memo"]),
    merchant_raw: get(["Merchant", "merchant", "Payee", "payee"]) || get(["Description", "description", "Memo", "memo"]),
    amount: normalizeAmount(get(["Amount", "amount", "Debit", "debit", "Credit", "credit"])),
    currency: get(["Currency", "currency"]) || "USD",
    source_file: path.basename(filePath),
    source_hash: sourceHash,
    import_time: new Date().toISOString()
  };
}

function normalizeDate(value: string) {
  return value;
}

function normalizeAmount(value: string) {
  return value.replace(/[^0-9.\-]/g, "");
}

function appendImportLog(filePath: string, row: Record<string, string>) {
  appendText(filePath, toCsvLine(IMPORT_HEADERS.map((h) => row[h] ?? "")));
}

function cryptoId() {
  return "id_" + Math.random().toString(36).slice(2, 10);
}
