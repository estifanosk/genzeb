import fs from "fs";
import path from "path";
import { parseCsv, toCsvLine } from "./csv.js";
import { hashFileContent, makeId } from "./hash.js";
import { appendLedgerRows } from "../ledger/append.js";
import { dataPaths } from "../storage/paths.js";
import { fileExists, writeText, appendText } from "../storage/fileops.js";

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

export function importStatements(baseDir, filePaths) {
  const results = [];
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
    const ledgerRows = rows.map((r) => toLedgerRow(r, filePath, sourceHash));

    appendLedgerRows(baseDir, ledgerRows);
    appendImportLog(paths.importLogCsv, {
      import_id: makeId(),
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

function toLedgerRow(row, filePath, sourceHash) {
  const get = (keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v && v.trim().length > 0) return v.trim();
    }
    return "";
  };

  return {
    id: makeId(),
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

function normalizeDate(value) {
  return value;
}

function normalizeAmount(value) {
  return value.replace(/[^0-9.\-]/g, "");
}

function appendImportLog(filePath, row) {
  appendText(filePath, toCsvLine(IMPORT_HEADERS.map((h) => row[h] ?? "")));
}
