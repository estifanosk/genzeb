import { readFileSync, existsSync, writeFileSync } from 'fs'
import { basename, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { ReceiptDetail } from '../../shared/types'
import { getDataDirPath, getDataFilePath } from '../utils/paths'
import Papa from 'papaparse'

function fileToDataUri(filePath: string): { dataUri: string; mime: string } {
  const ext = extname(filePath).toLowerCase()
  const imageTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.heic': 'image/heic'
  }
  const mime = imageTypes[ext] || (ext === '.pdf' ? 'application/pdf' : 'application/octet-stream')
  const data = readFileSync(filePath)
  return { dataUri: `data:${mime};base64,${data.toString('base64')}`, mime }
}

function buildReceiptSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'receipt_id',
      'merchant',
      'date',
      'total',
      'currency',
      'tax',
      'tip',
      'line_items',
      'confidence',
      'raw_text',
      'warnings'
    ],
    properties: {
      receipt_id: { type: 'string' },
      merchant: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      total: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      currency: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      tax: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      tip: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['description', 'quantity', 'unit_price', 'total', 'confidence'],
          properties: {
            description: { type: 'string' },
            quantity: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            unit_price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            total: { type: 'number' },
            confidence: { type: 'number' }
          }
        }
      },
      confidence: { type: 'number' },
      raw_text: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      warnings: { type: 'array', items: { type: 'string' } }
    }
  }
}

function extractJsonText(response: any): string {
  if (response.output_text) return response.output_text
  const content = response.output?.[0]?.content
  if (content && content.length > 0 && content[0].text) return content[0].text
  return ''
}

export async function runReceiptLlmExtract(
  apiKey: string,
  filePath: string,
  receiptId?: string
): Promise<ReceiptDetail> {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  const { dataUri, mime } = fileToDataUri(filePath)
  const isPdf = mime === 'application/pdf'
  const id = receiptId || uuidv4()

  const prompt = `You are a receipt data extractor. Extract fields from the receipt image or PDF.
Return JSON that strictly matches the provided schema.
If a field is missing, use null. If you are unsure, include a low confidence score.
Prefer totals found on the receipt (e.g., “Total”, “Amount Paid”).
Do not hallucinate line items; only include items clearly visible.`

  const inputContent = [
    { type: 'input_text', text: prompt },
    isPdf
      ? { type: 'input_file', filename: basename(filePath), file_data: dataUri }
      : { type: 'input_image', image_url: dataUri }
  ]

  const body = {
    model: 'gpt-4o-mini-2024-07-18',
    input: [{ role: 'user', content: inputContent }],
    text: {
      format: {
        type: 'json_schema',
        name: 'receipt_extraction',
        schema: buildReceiptSchema(),
        strict: true
      }
    }
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI request failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  const jsonText = extractJsonText(data)
  if (!jsonText) {
    throw new Error('OpenAI response did not include JSON output')
  }

  const parsed = JSON.parse(jsonText) as ReceiptDetail
  parsed.receipt_id = id
  return parsed
}

export function saveReceiptDetail(dataFolder: string, detail: ReceiptDetail): void {
  const receiptDir = getDataDirPath(dataFolder, 'RECEIPTS')
  if (!existsSync(receiptDir)) {
    throw new Error('Receipts directory not found')
  }
  const detailPath = `${receiptDir}/${detail.receipt_id}.json`
  writeFileSync(detailPath, JSON.stringify(detail, null, 2), 'utf-8')

  const indexPath = getDataFilePath(dataFolder, 'RECEIPTS_INDEX')
  if (!existsSync(indexPath)) return
  const content = readFileSync(indexPath, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  const rows = parsed.data.map((row) => {
    if (row.receipt_id !== detail.receipt_id) return row
    return {
      ...row,
      merchant: detail.merchant ?? row.merchant,
      date: detail.date ?? row.date,
      total: detail.total !== undefined && detail.total !== null ? String(detail.total) : row.total,
      currency: detail.currency ?? row.currency
    }
  })

  const headers = parsed.meta.fields || [
    'receipt_id',
    'file_path',
    'receipt_type',
    'merchant',
    'date',
    'total',
    'currency',
    'source_hash',
    'ocr_status',
    'created_at'
  ]

  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => {
      const raw = row[h]
      const value = raw ?? ''
      if (String(value).includes(',') || String(value).includes('"') || String(value).includes('\n')) {
        return `"${String(value).replace(/"/g, '""')}"`
      }
      return String(value)
    })
    lines.push(values.join(','))
  }
  writeFileSync(indexPath, `${lines.join('\n')}\n`, 'utf-8')
}

export function readReceiptDetail(dataFolder: string, receiptId: string): ReceiptDetail | null {
  const receiptDir = getDataDirPath(dataFolder, 'RECEIPTS')
  const detailPath = `${receiptDir}/${receiptId}.json`
  if (!existsSync(detailPath)) return null
  const raw = readFileSync(detailPath, 'utf-8')
  return JSON.parse(raw) as ReceiptDetail
}
