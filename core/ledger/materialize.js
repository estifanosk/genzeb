import { dataPaths } from "../storage/paths.js";
import { fileExists, readText, writeText } from "../storage/fileops.js";
import { parseCsv, toCsvLine } from "../importer/csv.js";

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

export function materializeTransactions(baseDir) {
  const paths = dataPaths(baseDir);
  if (!fileExists(paths.ledgerCsv)) {
    writeText(paths.transactionsCsv, toCsvLine(TX_HEADERS));
    return;
  }

  const ledgerRows = parseCsv(readText(paths.ledgerCsv));
  const changeRows = fileExists(paths.changesCsv) ? parseCsv(readText(paths.changesCsv)) : [];
  const receiptIndex = fileExists(paths.receipts + "/index.csv")
    ? parseCsv(readText(paths.receipts + "/index.csv"))
    : [];

  const receiptMap = new Map();
  for (const r of receiptIndex) {
    receiptMap.set(r.receipt_id, r.file_path);
  }

  const changeMap = new Map();
  for (const c of changeRows) {
    const list = changeMap.get(c.transaction_id) ?? [];
    list.push(c);
    changeMap.set(c.transaction_id, list);
  }

  const outRows = [];

  for (const row of ledgerRows) {
    const base = {
      id: row.id ?? "",
      parent_id: "",
      account: row.account ?? "",
      date: row.date ?? "",
      post_date: row.post_date ?? "",
      description: row.description_raw ?? "",
      merchant: row.merchant_raw ?? "",
      amount: row.amount ?? "",
      currency: row.currency ?? "",
      category: "",
      subcategory: "",
      notes: "",
      receipt_files: "",
      line_items: "",
      source_file: row.source_file ?? "",
      source_hash: row.source_hash ?? "",
      import_time: row.import_time ?? "",
      confidence: ""
    };

    const changes = (changeMap.get(base.id) ?? []).sort((a, b) => a.time.localeCompare(b.time));
    const receiptIds = [];
    let splitPayload = null;

    for (const c of changes) {
      switch (c.change_type) {
        case "set_category":
          base.category = c.value ?? "";
          break;
        case "set_merchant":
          base.merchant = c.value ?? "";
          break;
        case "set_notes":
          base.notes = c.value ?? "";
          break;
        case "link_receipt":
          if (c.value) receiptIds.push(c.value);
          break;
        case "unlink_receipt":
          if (c.value) {
            const idx = receiptIds.indexOf(c.value);
            if (idx >= 0) receiptIds.splice(idx, 1);
          }
          break;
        case "split":
          splitPayload = c.value;
          break;
      }
    }

    if (receiptIds.length > 0) {
      const files = receiptIds.map((id) => receiptMap.get(id)).filter(Boolean);
      base.receipt_files = files.join(";");
    }

    if (splitPayload) {
      try {
        const parsed = JSON.parse(splitPayload);
        const children = parsed.children ?? [];
        for (const child of children) {
          outRows.push({
            ...base,
            id: child.child_id ?? base.id,
            parent_id: base.id,
            amount: child.amount ?? base.amount,
            category: child.category ?? base.category,
            subcategory: child.subcategory ?? base.subcategory,
            notes: child.notes ?? base.notes,
            merchant: child.merchant ?? base.merchant
          });
        }
        continue;
      } catch {
        // fall through to base row if split payload invalid
      }
    }

    outRows.push(base);
  }

  let out = toCsvLine(TX_HEADERS);
  for (const r of outRows) {
    out += toCsvLine(TX_HEADERS.map((h) => r[h] ?? ""));
  }
  writeText(paths.transactionsCsv, out);
}
