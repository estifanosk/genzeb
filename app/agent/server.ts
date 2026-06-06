/**
 * Genzeb MCP Agent Server
 *
 * Exposes the Genzeb core library as MCP tools so Claude (or any MCP client)
 * can import statements, categorize transactions, link receipts, and more —
 * using the exact same functions the Electron UI uses.
 *
 * All changes made through this server are tagged agent:'claude' (or the value
 * of GENZEB_AGENT_NAME) in changes.csv, and the app renders an AI badge on
 * those transactions.
 *
 * Required env vars:
 *   GENZEB_DATA_FOLDER  — path to the Genzeb data folder (e.g. ~/Documents/Genzeb)
 *
 * Optional env vars:
 *   OPENAI_API_KEY      — for receipt OCR via LLM
 *   GENZEB_AGENT_NAME   — name recorded in changes.csv (default: 'claude')
 *
 * Run:
 *   cd app
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json agent/server.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { homedir } from 'os'
import { resolve } from 'path'

import { importStatementFiles } from '../../core/importer/statement-importer'
import { materializeTransactions, queryTransactions } from '../../core/materializer/index'
import { appendChangeRow, readChanges } from '../../core/ledger/changes'
import {
  readReceiptIndex,
  ingestReceipts,
  getCandidatesForReceipt,
  writeLink,
} from '../../core/receipts/importer'
import { runReceiptLlmExtract } from '../../core/receipts/llm'
import { ensureDataStructure } from '../../core/storage/paths'

// ── Config ──────────────────────────────────────────────────────────────────

function expandHome(p: string): string {
  return p.startsWith('~') ? p.replace('~', homedir()) : p
}

const DATA_FOLDER = process.env.GENZEB_DATA_FOLDER
  ? resolve(expandHome(process.env.GENZEB_DATA_FOLDER))
  : null

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? ''
const AGENT = process.env.GENZEB_AGENT_NAME ?? 'claude'

if (!DATA_FOLDER) {
  console.error('Error: GENZEB_DATA_FOLDER env var is required.')
  process.exit(1)
}

ensureDataStructure(DATA_FOLDER)

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}

function json(value: unknown) {
  return ok(JSON.stringify(value, null, 2))
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'genzeb',
  version: '1.0.0',
  instructions: `You have access to Genzeb, the user's personal expense tracker.
Use these tools whenever the user asks about their expenses, spending, transactions, receipts, categories, or anything financial — even if they don't say "Genzeb" explicitly.

Data folder: ${DATA_FOLDER}

Typical workflows:
- "What did I spend on X?" → query_transactions with a search or category filter
- "Import this CSV" → import_statements, then query_transactions to confirm
- "Categorize my transactions" → query_transactions with uncategorized:true, then set_category for each
- "Link this receipt" → get_match_candidates to find the best transaction, then link_receipt
- After bulk changes, call materialize to rebuild the view

All changes you make (set_category, set_merchant, etc.) are tagged as AI edits in the app and shown with an AI badge so the user can review and override them.`,
})

// ── Tools ────────────────────────────────────────────────────────────────────

server.tool(
  'import_statements',
  'Import one or more CSV bank/credit card statement files. Returns a summary of rows imported, skipped, and any errors.',
  {
    paths: z.array(z.string()).describe('Absolute paths to CSV statement files'),
    account: z.string().describe('Account name or identifier (e.g. "Chase Checking")'),
  },
  async ({ paths, account }) => {
    const results = await importStatementFiles(DATA_FOLDER!, { paths, account })
    materializeTransactions(DATA_FOLDER!)
    const summary = results.map((r) => ({
      file: r.source_file,
      imported: r.rows_imported,
      skipped: r.rows_skipped,
      duplicates: r.duplicates.length,
      errors: r.errors.length,
    }))
    return json(summary)
  }
)

server.tool(
  'materialize',
  'Rebuild transactions.csv from the ledger and changes. Call this after making a batch of changes to refresh the view.',
  {},
  async () => {
    materializeTransactions(DATA_FOLDER!)
    return ok('Materialized.')
  }
)

server.tool(
  'query_transactions',
  'Query transactions with optional filters. Returns paginated results including id, date, merchant, amount, category, and ai_edited flag.',
  {
    search: z.string().optional().describe('Full-text search across merchant, description, notes'),
    date_start: z.string().optional().describe('Filter from this date (YYYY-MM-DD)'),
    date_end: z.string().optional().describe('Filter to this date (YYYY-MM-DD)'),
    uncategorized: z.boolean().optional().describe('Only return transactions with no category'),
    limit: z.number().optional().default(50).describe('Max rows to return (default 50)'),
    offset: z.number().optional().default(0).describe('Pagination offset'),
  },
  async ({ search, date_start, date_end, uncategorized, limit, offset }) => {
    const res = queryTransactions(DATA_FOLDER!, {
      filters: {
        ...(search ? { search } : {}),
        ...(date_start || date_end ? { dateRange: { start: date_start, end: date_end } } : {}),
        ...(uncategorized ? { uncategorized: true } : {}),
      },
      limit: limit ?? 50,
      offset: offset ?? 0,
      sortBy: 'date',
      sortOrder: 'desc',
    })
    return json({ total: res.total, transactions: res.transactions })
  }
)

server.tool(
  'set_category',
  'Set the category (and optionally subcategory) on a transaction. Recorded as an AI change in changes.csv.',
  {
    transaction_id: z.string().describe('Transaction UUID'),
    category: z.string().describe('Category name (e.g. "Groceries")'),
    subcategory: z.string().optional().describe('Optional subcategory (e.g. "Supermarkets")'),
  },
  async ({ transaction_id, category, subcategory }) => {
    appendChangeRow(DATA_FOLDER!, { transaction_id, change_type: 'set_category', value: category, agent: AGENT })
    if (subcategory) {
      appendChangeRow(DATA_FOLDER!, { transaction_id, change_type: 'set_subcategory', value: subcategory, agent: AGENT })
    }
    return ok(`Category set to "${category}"${subcategory ? ` / "${subcategory}"` : ''}.`)
  }
)

server.tool(
  'set_merchant',
  'Normalize or correct the merchant name on a transaction. Recorded as an AI change.',
  {
    transaction_id: z.string().describe('Transaction UUID'),
    merchant: z.string().describe('Cleaned merchant name (e.g. "Whole Foods Market")'),
  },
  async ({ transaction_id, merchant }) => {
    appendChangeRow(DATA_FOLDER!, { transaction_id, change_type: 'set_merchant', value: merchant, agent: AGENT })
    return ok(`Merchant set to "${merchant}".`)
  }
)

server.tool(
  'set_notes',
  'Add a note to a transaction (e.g. flag it for review). Recorded as an AI change.',
  {
    transaction_id: z.string().describe('Transaction UUID'),
    notes: z.string().describe('Note text'),
  },
  async ({ transaction_id, notes }) => {
    appendChangeRow(DATA_FOLDER!, { transaction_id, change_type: 'set_notes', value: notes, agent: AGENT })
    return ok('Note saved.')
  }
)

server.tool(
  'get_receipts',
  'List all imported receipts with their OCR status and linked/unlinked state.',
  {},
  async () => {
    const receipts = readReceiptIndex(DATA_FOLDER!)
    return json(receipts)
  }
)

server.tool(
  'import_receipts',
  'Import receipt image files. Genzeb will attempt to auto-match each receipt to a transaction by date and amount.',
  {
    paths: z.array(z.string()).describe('Absolute paths to receipt image files (PNG, JPG, PDF)'),
  },
  async ({ paths }) => {
    const result = ingestReceipts(DATA_FOLDER!, { paths, mode: 'link' })
    materializeTransactions(DATA_FOLDER!)
    return json({ imported: result.receipts.length, linked: result.linked, unmatched: result.unmatched })
  }
)

server.tool(
  'run_ocr',
  'Run LLM-powered OCR on a receipt to extract merchant, date, total, and line items. Requires OPENAI_API_KEY.',
  {
    receipt_id: z.string().describe('Receipt UUID (from get_receipts)'),
    file_path: z.string().describe('Absolute path to the receipt image file'),
  },
  async ({ file_path }) => {
    if (!OPENAI_KEY) return ok('Error: OPENAI_API_KEY env var is not set.')
    const detail = await runReceiptLlmExtract(OPENAI_KEY, file_path)
    return json(detail)
  }
)

server.tool(
  'get_match_candidates',
  'Given a receipt ID, return the top matching transactions scored by date and amount proximity.',
  {
    receipt_id: z.string().describe('Receipt UUID (from get_receipts)'),
  },
  async ({ receipt_id }) => {
    const candidates = getCandidatesForReceipt(DATA_FOLDER!, receipt_id)
    return json(candidates)
  }
)

server.tool(
  'link_receipt',
  'Link a receipt to a transaction. Updates links.csv and records the association in changes.csv.',
  {
    transaction_id: z.string().describe('Transaction UUID'),
    receipt_id: z.string().describe('Receipt UUID'),
  },
  async ({ transaction_id, receipt_id }) => {
    const receipts = readReceiptIndex(DATA_FOLDER!)
    const receipt = receipts.find((r) => r.receipt_id === receipt_id)
    writeLink(DATA_FOLDER!, { transaction_id, receipt_id, amount: receipt?.total, confidence: 1, notes: `linked by ${AGENT}` })
    appendChangeRow(DATA_FOLDER!, { transaction_id, change_type: 'link_receipt', value: receipt_id, agent: AGENT })
    materializeTransactions(DATA_FOLDER!)
    return ok('Linked.')
  }
)

server.tool(
  'get_changes',
  'Return the full change history. Useful for reviewing what the AI (or user) has already modified.',
  {},
  async () => {
    const changes = readChanges(DATA_FOLDER!)
    return json(changes)
  }
)

// ── Connect ──────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => { console.error(e); process.exit(1) })
