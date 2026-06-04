import type { CategorizeTransactionsRequest, CategorizeTransactionsResponse } from '../../shared/types/ipc'
import { getCategories } from '../rules'

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['suggestions'],
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['transaction_id', 'category', 'subcategory', 'confidence', 'rationale'],
          properties: {
            transaction_id: { type: 'string' },
            category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            subcategory: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            confidence: { type: 'number' },
            rationale: { anyOf: [{ type: 'string' }, { type: 'null' }] }
          }
        }
      }
    }
  }
}

function extractJsonText(response: any): string {
  if (response.output_text) return response.output_text
  const content = response.output?.[0]?.content
  if (content && content.length > 0 && content[0].text) return content[0].text
  return ''
}

export async function categorizeTransactionsLlm(
  apiKey: string,
  dataFolder: string,
  req: CategorizeTransactionsRequest
): Promise<CategorizeTransactionsResponse> {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  const categories = getCategories(dataFolder)
  const categoryList = categories
    .map((c) => (c.subcategory ? `${c.category} > ${c.subcategory}` : c.category))
    .join(', ')

  const input = req.transactions.map((tx) => ({
    transaction_id: tx.id,
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    date: tx.date
  }))

  const prompt = `You are an expense categorization assistant.
Return suggestions for each transaction using ONLY the provided category list.
If unsure, set category and subcategory to null.
Category list: ${categoryList}
Return JSON strictly matching the schema.`

  const body = {
    model: 'gpt-4o-mini-2024-07-18',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_text', text: JSON.stringify(input) }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'categorization',
        schema: buildSchema(),
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

  return JSON.parse(jsonText) as CategorizeTransactionsResponse
}
