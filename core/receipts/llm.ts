import { readFileSync, existsSync, writeFileSync } from 'fs'
import { basename, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { ReceiptDetail } from '../types'
import { getDataDirPath, getDataFilePath } from '../storage/paths'
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

async function runWithAnthropic(apiKey: string, filePath: string, id: string): Promise<ReceiptDetail> {
  const ext = extname(filePath).toLowerCase()
  const isSvg = ext === '.svg'
  const { dataUri, mime } = fileToDataUri(filePath)
  const isPdf = mime === 'application/pdf'
  const base64Data = dataUri.split(',')[1]

  const fileContent = isSvg
    ? { type: 'text', text: `Receipt SVG (parse the <text> elements to extract data):\n${readFileSync(filePath, 'utf-8')}` }
    : isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: base64Data } }

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    tools: [{ name: 'extract_receipt', description: 'Extract structured data from a receipt.', input_schema: buildReceiptSchema() }],
    tool_choice: { type: 'tool', name: 'extract_receipt' },
    messages: [{ role: 'user', content: [fileContent, { type: 'text', text: 'Extract all data from this receipt. Use null for any field you cannot clearly read.' }] }]
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic request failed: ${res.status} ${t}`) }
  const data = await res.json()
  const toolUse = data.content?.find((c: { type: string }) => c.type === 'tool_use')
  if (!toolUse) throw new Error('Anthropic response did not include structured output')
  const parsed = toolUse.input as ReceiptDetail
  parsed.receipt_id = id
  return parsed
}

async function runWithOpenAi(apiKey: string, filePath: string, id: string): Promise<ReceiptDetail> {
  const ext = extname(filePath).toLowerCase()
  const isSvg = ext === '.svg'
  const { dataUri, mime } = fileToDataUri(filePath)
  const isPdf = mime === 'application/pdf'

  const inputContent = [
    { type: 'input_text', text: 'Extract all data from this receipt. Use null for any field you cannot clearly read.' },
    isSvg
      ? { type: 'input_text', text: `Receipt SVG:\n${readFileSync(filePath, 'utf-8')}` }
      : isPdf
        ? { type: 'input_file', filename: basename(filePath), file_data: dataUri }
        : { type: 'input_image', image_url: dataUri }
  ]

  const body = {
    model: 'gpt-4o-mini-2024-07-18',
    input: [{ role: 'user', content: inputContent }],
    text: { format: { type: 'json_schema', name: 'receipt_extraction', schema: buildReceiptSchema(), strict: true } }
  }

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) { const t = await res.text(); throw new Error(`OpenAI request failed: ${res.status} ${t}`) }
  const data = await res.json()
  const jsonText = extractJsonText(data)
  if (!jsonText) throw new Error('OpenAI response did not include JSON output')
  const parsed = JSON.parse(jsonText) as ReceiptDetail
  parsed.receipt_id = id
  return parsed
}

export async function runReceiptLlmExtract(
  apiKey: string,
  filePath: string,
  receiptId?: string
): Promise<ReceiptDetail> {
  if (!apiKey) {
    throw new Error('No API key configured. Add an Anthropic or OpenAI key in Settings → API Keys.')
  }
  const id = receiptId || uuidv4()
  return apiKey.startsWith('sk-ant-')
    ? runWithAnthropic(apiKey, filePath, id)
    : runWithOpenAi(apiKey, filePath, id)
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
      currency: detail.currency ?? row.currency,
      ocr_status: 'ok'
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

export function updateOcrStatus(
  dataFolder: string,
  receiptId: string,
  status: 'ok' | 'failed' | 'pending'
): void {
  const indexPath = getDataFilePath(dataFolder, 'RECEIPTS_INDEX')
  if (!existsSync(indexPath)) return
  const content = readFileSync(indexPath, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  const rows = parsed.data.map((row) =>
    row.receipt_id === receiptId ? { ...row, ocr_status: status } : row
  )
  const headers = parsed.meta.fields || [
    'receipt_id', 'file_path', 'receipt_type', 'merchant', 'date', 'total',
    'currency', 'source_hash', 'ocr_status', 'created_at'
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => {
      const value = row[h] ?? ''
      return String(value).includes(',') || String(value).includes('"') || String(value).includes('\n')
        ? `"${String(value).replace(/"/g, '""')}"` : String(value)
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
