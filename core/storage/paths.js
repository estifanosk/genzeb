import path from "path";

export function dataPaths(baseDir) {
  return {
    base: baseDir,
    inbox: path.join(baseDir, "Inbox"),
    data: path.join(baseDir, "Data"),
    transactions: path.join(baseDir, "Data", "transactions"),
    receipts: path.join(baseDir, "Data", "receipts"),
    matches: path.join(baseDir, "Data", "matches"),
    rules: path.join(baseDir, "Data", "rules"),
    index: path.join(baseDir, "Data", "index"),
    exports: path.join(baseDir, "Exports"),
    llmExports: path.join(baseDir, "Exports", "llm"),
    ledgerCsv: path.join(baseDir, "Data", "transactions", "ledger.csv"),
    changesCsv: path.join(baseDir, "Data", "transactions", "changes.csv"),
    transactionsCsv: path.join(baseDir, "Data", "transactions", "transactions.csv"),
    importLogCsv: path.join(baseDir, "Data", "transactions", "import-log.csv")
  };
}
