import type { TransactionRow } from '@core/types'

const TX_CSV_HEADERS = ['date', 'merchant', 'description', 'amount', 'category', 'subcategory', 'account', 'notes'] as const

function escapeCsv(value: string): string {
  return value.includes(',') || value.includes('"') || value.includes('\n')
    ? `"${value.replace(/"/g, '""')}"`
    : value
}

/**
 * Serializes a list of transactions to a minimal CSV string suitable for LLM context.
 * Only the columns meaningful to a Q&A prompt are included.
 */
export function buildTransactionCsv(rows: TransactionRow[]): string {
  const lines = [TX_CSV_HEADERS.join(',')]
  for (const tx of rows) {
    lines.push(
      TX_CSV_HEADERS.map((h) =>
        escapeCsv(String((tx as unknown as Record<string, unknown>)[h] ?? ''))
      ).join(',')
    )
  }
  return lines.join('\n')
}
