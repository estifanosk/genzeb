import { dataPaths } from "../storage/paths";
import { fileExists, readText, writeText } from "../storage/fileops";
import { parseCsv, toCsvLine } from "../importer/csv";

const TX_HEADERS = [
  "id",
  "parent_id",
  "account",
  "date",
  "post_date",
  "description",
  "merchant",
  "amount",
  "currency",
  "category",
  "subcategory",
  "notes",
  "receipt_files",
  "line_items",
  "source_file",
  "source_hash",
  "import_time",
  "confidence"
];

export function materializeTransactions(baseDir: string) {
  const paths = dataPaths(baseDir);
  if (!fileExists(paths.ledgerCsv)) {
    writeText(paths.transactionsCsv, toCsvLine(TX_HEADERS));
    return;
  }
  const ledgerText = readText(paths.ledgerCsv);
  const ledgerRows = parseCsv(ledgerText);

  let out = toCsvLine(TX_HEADERS);
  for (const row of ledgerRows) {
    out += toCsvLine([
      row.id ?? "",
      "",
      row.account ?? "",
      row.date ?? "",
      row.post_date ?? "",
      row.description_raw ?? "",
      row.merchant_raw ?? "",
      row.amount ?? "",
      row.currency ?? "",
      "",
      "",
      "",
      "",
      "",
      row.source_file ?? "",
      row.source_hash ?? "",
      row.import_time ?? "",
      ""
    ]);
  }
  writeText(paths.transactionsCsv, out);
}
