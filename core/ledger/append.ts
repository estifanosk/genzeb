import { appendText, fileExists, writeText } from "../storage/fileops";
import { toCsvLine } from "../importer/csv";
import { dataPaths } from "../storage/paths";
import { LedgerRow, ChangeRow } from "./schema";

const LEDGER_HEADERS = [
  "id",
  "account",
  "date",
  "post_date",
  "description_raw",
  "merchant_raw",
  "amount",
  "currency",
  "source_file",
  "source_hash",
  "import_time"
];

const CHANGE_HEADERS = [
  "change_id",
  "transaction_id",
  "change_type",
  "field",
  "value",
  "time"
];

export function appendLedgerRows(baseDir: string, rows: LedgerRow[]) {
  const paths = dataPaths(baseDir);
  if (!fileExists(paths.ledgerCsv)) {
    writeText(paths.ledgerCsv, toCsvLine(LEDGER_HEADERS));
  }
  for (const row of rows) {
    appendText(
      paths.ledgerCsv,
      toCsvLine(LEDGER_HEADERS.map((h) => (row as Record<string, string>)[h] ?? ""))
    );
  }
}

export function appendChange(baseDir: string, change: ChangeRow) {
  const paths = dataPaths(baseDir);
  if (!fileExists(paths.changesCsv)) {
    writeText(paths.changesCsv, toCsvLine(CHANGE_HEADERS));
  }
  appendText(
    paths.changesCsv,
    toCsvLine(CHANGE_HEADERS.map((h) => (change as Record<string, string>)[h] ?? ""))
  );
}
