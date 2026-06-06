import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { appendChangeRow, readChanges } from '@core/ledger/changes'

let dir: string

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'genzeb-unit-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('appendChangeRow / readChanges', () => {
  it('round-trips a basic change', () => {
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_category', value: 'Food' })
    const changes = readChanges(dir)
    expect(changes).toHaveLength(1)
    expect(changes[0].transaction_id).toBe('tx1')
    expect(changes[0].change_type).toBe('set_category')
    expect(changes[0].value).toBe('Food')
  })

  it('persists the agent field', () => {
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_category', value: 'Income', agent: 'claude' })
    const [change] = readChanges(dir)
    expect(change.agent).toBe('claude')
  })

  it('returns empty array when no changes file exists', () => {
    expect(readChanges(dir)).toEqual([])
  })

  it('appends multiple changes in order', () => {
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_category', value: 'Food' })
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_merchant', value: 'Whole Foods' })
    appendChangeRow(dir, { transaction_id: 'tx2', change_type: 'set_notes', value: 'Review this' })
    const changes = readChanges(dir)
    expect(changes).toHaveLength(3)
    expect(changes[2].transaction_id).toBe('tx2')
  })

  it('assigns unique change_ids', () => {
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_category', value: 'A' })
    appendChangeRow(dir, { transaction_id: 'tx1', change_type: 'set_category', value: 'B' })
    const [a, b] = readChanges(dir)
    expect(a.change_id).not.toBe(b.change_id)
  })
})
