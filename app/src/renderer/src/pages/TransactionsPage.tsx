import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FileText, RefreshCw, Filter, Columns, Edit2, Check, X, Trash2, History, Scissors, Plus, MinusCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { PageHeader, PageShell, Panel } from '../components/ui/page'
import { Select } from '../components/ui/select'
import { EmptyState, InlineAlert, LoadingState } from '../components/ui/state'
import { fmtCurrency, amountClass, fmtDate } from '../lib/utils'
import type { AccountInfo, ReceiptDetail, TransactionRow, ChangeRow, SplitPayload } from '@core/types'

interface EditValues {
  category?: string
  subcategory?: string
  merchant?: string
  notes?: string
}

interface SplitDraftRow {
  id: string
  amount: string
  category: string
  subcategory: string
  notes: string
}

export function TransactionsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const storageKey = 'genzeb.transactions.ui'
  const defaultVisibleColumns: Record<string, boolean> = {
    date: true,
    merchant: true,
    description: true,
    amount: true,
    account: true,
    category: true,
    subcategory: false,
    notes: false
  }
  const [isLoading, setIsLoading] = useState(true)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [accounts, setAccounts] = useState<AccountInfo[]>([])

  const [search, setSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [dateStart, setDateStart] = useState<string>('')
  const [dateEnd, setDateEnd] = useState<string>('')
  const [amountMin, setAmountMin] = useState<string>('')
  const [amountMax, setAmountMax] = useState<string>('')
  const [merchantContains, setMerchantContains] = useState('')
  const [hasReceipt, setHasReceipt] = useState<'all' | 'yes' | 'no'>('all')
  const [uncategorized, setUncategorized] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [sortBy, setSortBy] = useState<keyof TransactionRow>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues>({})
  const [splitTarget, setSplitTarget] = useState<TransactionRow | null>(null)
  const [splitRows, setSplitRows] = useState<SplitDraftRow[]>([])
  const [splitError, setSplitError] = useState<string | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditValues, setBulkEditValues] = useState<EditValues>({})

  const [showColumnManager, setShowColumnManager] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(defaultVisibleColumns)
  const [receiptDetails, setReceiptDetails] = useState<Record<string, ReceiptDetail | null>>({})
  const [expandedReceiptTx, setExpandedReceiptTx] = useState<string | null>(null)
  const [changesByTx, setChangesByTx] = useState<Map<string, ChangeRow[]>>(new Map())

  const parentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        visibleColumns: Record<string, boolean>
        search: string
        selectedAccount: string
        dateStart: string
        dateEnd: string
        amountMin: string
        amountMax: string
        merchantContains: string
        hasReceipt: 'all' | 'yes' | 'no'
        uncategorized: boolean
      }>
      if (parsed.visibleColumns) {
        setVisibleColumns((prev) => ({ ...prev, ...parsed.visibleColumns }))
      }
      if (parsed.search !== undefined) setSearch(parsed.search)
      if (parsed.selectedAccount !== undefined) setSelectedAccount(parsed.selectedAccount)
      if (parsed.dateStart !== undefined) setDateStart(parsed.dateStart)
      if (parsed.dateEnd !== undefined) setDateEnd(parsed.dateEnd)
      if (parsed.amountMin !== undefined) setAmountMin(parsed.amountMin)
      if (parsed.amountMax !== undefined) setAmountMax(parsed.amountMax)
      if (parsed.merchantContains !== undefined) setMerchantContains(parsed.merchantContains)
      if (parsed.hasReceipt !== undefined) setHasReceipt(parsed.hasReceipt)
      if (parsed.uncategorized !== undefined) setUncategorized(parsed.uncategorized)
    } catch {
      // Ignore malformed storage
    }
  }, [])

  const effectiveVisibleColumns: Record<string, boolean> = {
    ...visibleColumns,
    merchant: true,
    description: true
  }

  const tagStyles = ['bg-amber-100 text-amber-900', 'bg-emerald-100 text-emerald-900', 'bg-sky-100 text-sky-900', 'bg-rose-100 text-rose-900', 'bg-lime-100 text-lime-900', 'bg-indigo-100 text-indigo-900']

  const getTagStyle = (label?: string) => {
    if (!label) return 'bg-slate-100 text-slate-700'
    let hash = 0
    for (let i = 0; i < label.length; i += 1) {
      hash = (hash * 31 + label.charCodeAt(i)) % tagStyles.length
    }
    return tagStyles[hash]
  }

  const selectedAccountMeta = selectedAccount === 'all' ? null : accounts.find((acct) => acct.accountNumber === selectedAccount)

  const makeSplitId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

  const roundCents = (value: number) => Math.round(value * 100)

  const splitRowsTotal = splitRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const splitDifference = splitTarget ? roundCents(splitTarget.amount) - roundCents(splitRowsTotal) : 0

  const columnList = useMemo(
    () => [
      { key: 'date', label: 'Date' },
      { key: 'merchant', label: 'Merchant' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount' },
      { key: 'account', label: 'Account' },
      { key: 'category', label: 'Category' },
      { key: 'subcategory', label: 'Subcategory' },
      { key: 'notes', label: 'Notes' }
    ],
    []
  )

  const loadTransactions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const filters = {
        ...(search ? { search } : {}),
        ...(selectedAccount === 'all' ? {} : { accounts: [selectedAccount] }),
        ...(dateStart || dateEnd ? { dateRange: { start: dateStart, end: dateEnd } } : {}),
        ...(amountMin || amountMax
          ? {
              amountRange: {
                min: amountMin ? Number(amountMin) : Number.NEGATIVE_INFINITY,
                max: amountMax ? Number(amountMax) : Number.POSITIVE_INFINITY
              }
            }
          : {}),
        ...(merchantContains ? { merchantContains } : {}),
        ...(hasReceipt === 'all' ? {} : { hasReceipt: hasReceipt === 'yes' }),
        ...(uncategorized ? { uncategorized: true } : {})
      }

      const res = await window.api.getTransactions({
        filters,
        sortBy,
        sortOrder,
        limit: 99999,
        offset: 0
      })
      setTransactions(res.transactions)
      setTotal(res.total)
      setTotalAmount(res.totalAmount ?? 0)
      setSelectedIds(new Set())
      const accountList = await window.api.getAccounts()
      setAccounts(accountList)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadChanges = async () => {
    try {
      const all = await window.api.getChanges()
      const map = new Map<string, ChangeRow[]>()
      for (const c of all) {
        if (!map.has(c.transaction_id)) map.set(c.transaction_id, [])
        map.get(c.transaction_id)!.push(c)
      }
      setChangesByTx(map)
    } catch {
      // non-critical — history just won't show
    }
  }

  useEffect(() => {
    loadChanges()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [search, selectedAccount, dateStart, dateEnd, amountMin, amountMax, merchantContains, hasReceipt, uncategorized, sortBy, sortOrder])

  useEffect(() => {
    const ids = new Set<string>()
    for (const tx of transactions) {
      if (!tx.receipt_files) continue
      tx.receipt_files
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((id) => ids.add(id))
    }
    const missing = Array.from(ids).filter((id) => receiptDetails[id] === undefined)
    if (missing.length === 0) return

    let cancelled = false
    Promise.all(
      missing.map(async (id) => {
        try {
          const detail = await window.api.getReceiptDetail(id)
          return [id, detail] as const
        } catch {
          return [id, null] as const
        }
      })
    ).then((pairs) => {
      if (cancelled) return
      setReceiptDetails((prev) => {
        const next = { ...prev }
        for (const [id, detail] of pairs) {
          next[id] = detail
        }
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [transactions, receiptDetails])

  useEffect(() => {
    const payload = {
      visibleColumns,
      search,
      selectedAccount,
      dateStart,
      dateEnd,
      amountMin,
      amountMax,
      merchantContains,
      hasReceipt,
      uncategorized
    }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [visibleColumns, search, selectedAccount, dateStart, dateEnd, amountMin, amountMax, merchantContains, hasReceipt, uncategorized])

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 10
  })

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const removeSelected = async () => {
    if (selectedIds.size === 0) return
    const confirmed = window.confirm(`Remove ${selectedIds.size} selected transaction(s)?`)
    if (!confirmed) return
    setIsLoading(true)
    try {
      await window.api.deleteTransactions(Array.from(selectedIds))
      await loadTransactions()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  const startEdit = (tx: TransactionRow) => {
    setEditingId(tx.id)
    setEditValues({
      category: tx.category,
      subcategory: tx.subcategory,
      merchant: tx.merchant,
      notes: tx.notes
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const startSplit = (tx: TransactionRow) => {
    const halfCents = Math.trunc(roundCents(tx.amount) / 2)
    const first = halfCents / 100
    const second = (roundCents(tx.amount) - halfCents) / 100
    setSplitTarget(tx)
    setSplitRows([
      {
        id: makeSplitId(),
        amount: first.toFixed(2),
        category: tx.category ?? '',
        subcategory: tx.subcategory ?? '',
        notes: tx.notes ?? ''
      },
      {
        id: makeSplitId(),
        amount: second.toFixed(2),
        category: tx.category ?? '',
        subcategory: tx.subcategory ?? '',
        notes: tx.notes ?? ''
      }
    ])
    setSplitError(null)
  }

  const updateSplitRow = (id: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addSplitRow = () => {
    setSplitRows((rows) => [
      ...rows,
      {
        id: makeSplitId(),
        amount: '0.00',
        category: splitTarget?.category ?? '',
        subcategory: splitTarget?.subcategory ?? '',
        notes: ''
      }
    ])
  }

  const removeSplitRow = (id: string) => {
    setSplitRows((rows) => rows.filter((row) => row.id !== id))
  }

  const closeSplit = () => {
    setSplitTarget(null)
    setSplitRows([])
    setSplitError(null)
  }

  const saveSplit = async () => {
    if (!splitTarget) return
    if (splitRows.length < 2) {
      setSplitError('A split needs at least two rows.')
      return
    }

    const payloadRows: SplitPayload[] = []
    for (const row of splitRows) {
      const amount = Number(row.amount)
      if (!Number.isFinite(amount) || amount === 0) {
        setSplitError('Each split row needs a non-zero amount.')
        return
      }
      payloadRows.push({
        id: row.id,
        amount,
        category: row.category.trim() || undefined,
        subcategory: row.subcategory.trim() || undefined,
        notes: row.notes.trim() || undefined
      })
    }

    const totalCents = payloadRows.reduce((sum, row) => sum + roundCents(row.amount), 0)
    if (totalCents !== roundCents(splitTarget.amount)) {
      setSplitError(`Split total must equal ${fmtCurrency(splitTarget.amount)}.`)
      return
    }

    setIsLoading(true)
    try {
      await window.api.appendChange({
        transaction_id: splitTarget.id,
        change_type: 'split',
        value: JSON.stringify({ splits: payloadRows })
      })
      closeSplit()
      await loadTransactions()
    } catch (err) {
      setSplitError((err as Error).message)
      setIsLoading(false)
    }
  }

  const saveEdit = async (tx: TransactionRow) => {
    if (!editingId) return
    const changes = [] as Array<{
      type: 'set_category' | 'set_subcategory' | 'set_merchant' | 'set_notes'
      value: string
    }>

    if ((editValues.category ?? '') !== (tx.category ?? '')) {
      changes.push({ type: 'set_category', value: editValues.category ?? '' })
    }
    if ((editValues.subcategory ?? '') !== (tx.subcategory ?? '')) {
      changes.push({
        type: 'set_subcategory',
        value: editValues.subcategory ?? ''
      })
    }
    if ((editValues.merchant ?? '') !== (tx.merchant ?? '')) {
      changes.push({ type: 'set_merchant', value: editValues.merchant ?? '' })
    }
    if ((editValues.notes ?? '') !== (tx.notes ?? '')) {
      changes.push({ type: 'set_notes', value: editValues.notes ?? '' })
    }

    if (changes.length === 0) {
      cancelEdit()
      return
    }

    setIsLoading(true)
    try {
      for (const change of changes) {
        await window.api.appendChange({
          transaction_id: tx.id,
          change_type: change.type,
          value: change.value
        })
      }
      cancelEdit()
      await loadTransactions()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  const handleBulkEdit = async () => {
    if (selectedIds.size === 0) return
    const updates: EditValues = {}
    if (bulkEditValues.category) updates.category = bulkEditValues.category
    if (bulkEditValues.subcategory) updates.subcategory = bulkEditValues.subcategory
    if (bulkEditValues.merchant) updates.merchant = bulkEditValues.merchant
    if (bulkEditValues.notes) updates.notes = bulkEditValues.notes

    if (Object.keys(updates).length === 0) {
      alert('Please fill in at least one field to update')
      return
    }

    setIsLoading(true)
    try {
      for (const id of selectedIds) {
        if (updates.category !== undefined) {
          await window.api.appendChange({
            transaction_id: id,
            change_type: 'set_category',
            value: updates.category
          })
        }
        if (updates.subcategory !== undefined) {
          await window.api.appendChange({
            transaction_id: id,
            change_type: 'set_subcategory',
            value: updates.subcategory
          })
        }
        if (updates.merchant !== undefined) {
          await window.api.appendChange({
            transaction_id: id,
            change_type: 'set_merchant',
            value: updates.merchant
          })
        }
        if (updates.notes !== undefined) {
          await window.api.appendChange({
            transaction_id: id,
            change_type: 'set_notes',
            value: updates.notes
          })
        }
      }
      setShowBulkEdit(false)
      setBulkEditValues({})
      setSelectedIds(new Set())
      await loadTransactions()
    } catch (err) {
      setError((err as Error).message)
      setIsLoading(false)
    }
  }

  const toggleSort = (key: keyof TransactionRow) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length
  const tableColumns = [
    { key: 'date', label: 'Date', sortKey: 'date' as keyof TransactionRow, track: '120px', minWidth: 120 },
    { key: 'merchant', label: 'Merchant', sortKey: 'merchant' as keyof TransactionRow, track: 'minmax(220px, 6fr)', minWidth: 220 },
    { key: 'description', label: 'Description', sortKey: 'description' as keyof TransactionRow, track: 'minmax(260px, 6fr)', minWidth: 260 },
    { key: 'amount', label: 'Amount', sortKey: 'amount' as keyof TransactionRow, track: '140px', minWidth: 140, align: 'right' },
    { key: 'account', label: 'Account', sortKey: 'account' as keyof TransactionRow, track: '200px', minWidth: 200 },
    { key: 'category', label: 'Category', sortKey: 'category' as keyof TransactionRow, track: '140px', minWidth: 140 },
    { key: 'subcategory', label: 'Subcategory', sortKey: 'subcategory' as keyof TransactionRow, track: '140px', minWidth: 140 },
    { key: 'notes', label: 'Notes', track: 'minmax(180px, 2fr)', minWidth: 180 }
  ].filter((column) => effectiveVisibleColumns[column.key])
  const tableGridTemplate = ['32px', '28px', ...tableColumns.map((column) => column.track), '80px'].join(' ')
  const tableMinWidth = Math.max(
    760,
    32 + 28 + 80 + tableColumns.reduce((sum, column) => sum + column.minWidth, 0) + (tableColumns.length + 2) * 12 + 24
  )
  const activeFilterCount = [dateStart, dateEnd, amountMin, amountMax, merchantContains].filter(Boolean).length + (selectedAccount !== 'all' ? 1 : 0) + (hasReceipt !== 'all' ? 1 : 0) + (uncategorized ? 1 : 0)

  return (
    <PageShell>
      <PageHeader
        title="Transactions"
        description="Search, filter, edit, split, and review imported activity."
        meta={
          <>
            <Badge variant="neutral">{total} record{total === 1 ? '' : 's'}</Badge>
            <Badge variant={totalAmount >= 0 ? 'success' : 'danger'}>{fmtCurrency(totalAmount)} filtered total</Badge>
            {selectedIds.size > 0 && <Badge variant="info">{selectedIds.size} selected</Badge>}
          </>
        }
        actions={
          <>
            <Input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
              }}
              className="h-8 w-56"
            />
            <Button variant={showFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters((prev) => !prev)}>
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && <Badge variant={showFilters ? 'neutral' : 'info'} className="ml-1">{activeFilterCount}</Badge>}
            </Button>
            <Button variant={showColumnManager ? 'default' : 'outline'} size="sm" onClick={() => setShowColumnManager((prev) => !prev)}>
              <Columns className="h-4 w-4" />
              Columns
            </Button>
            <Select
              className="h-8"
              value={selectedAccount}
              onChange={(e) => {
                setSelectedAccount(e.target.value)
              }}
            >
              <option value="all">All accounts</option>
              {accounts.map((acct) => (
                <option key={acct.accountNumber} value={acct.accountNumber}>
                  {acct.accountNumber}
                </option>
              ))}
            </Select>
            <Button onClick={loadTransactions} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      {selectedAccountMeta && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Badge variant="neutral">Bank: {selectedAccountMeta.bankName || 'Unknown'}</Badge>
          <Badge variant="neutral">Type: {selectedAccountMeta.accountType || 'Unknown'}</Badge>
          {selectedAccountMeta.period && <Badge variant="neutral">Period: {selectedAccountMeta.period}</Badge>}
          {selectedAccountMeta.lastImportedAt && <Badge variant="neutral">Last import: {new Date(selectedAccountMeta.lastImportedAt).toLocaleString()}</Badge>}
          {selectedAccountMeta.sourceFiles?.length > 0 && <Badge variant="neutral">Files: {selectedAccountMeta.sourceFiles.length}</Badge>}
        </div>
      )}

      {selectedIds.size > 0 && (
        <Panel className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowBulkEdit(true)} variant="outline" size="sm">
              <Edit2 className="h-4 w-4" />
              Bulk edit
            </Button>
            <Button onClick={removeSelected} variant="outline" size="sm" disabled={isLoading}>
              <Trash2 className="h-4 w-4" />
              Remove selected
            </Button>
          </div>
        </Panel>
      )}

      {showFilters && (
        <Panel className="mb-4 grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
          <div>
            <label className="text-xs text-muted-foreground">Date from</label>
            <Input
              type="date"
              className="h-8"
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date to</label>
            <Input
              type="date"
              className="h-8"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Merchant contains</label>
            <Input
              type="text"
              className="h-8"
              value={merchantContains}
              onChange={(e) => {
                setMerchantContains(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount min</label>
            <Input
              type="number"
              step="0.01"
              className="h-8"
              value={amountMin}
              onChange={(e) => {
                setAmountMin(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount max</label>
            <Input
              type="number"
              step="0.01"
              className="h-8"
              value={amountMax}
              onChange={(e) => {
                setAmountMax(e.target.value)
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Has receipt</label>
            <Select
              className="h-8"
              value={hasReceipt}
              onChange={(e) => {
                setHasReceipt(e.target.value as 'all' | 'yes' | 'no')
              }}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <input
                type="checkbox"
                checked={uncategorized}
                onChange={(e) => {
                  setUncategorized(e.target.checked)
                }}
              />
              Uncategorized
            </label>
          </div>
        </Panel>
      )}

      {showColumnManager && (
        <Panel className="mb-4 grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
          {columnList.map((col) => (
            <label key={col.key} className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={effectiveVisibleColumns[col.key]}
                disabled={['merchant', 'description'].includes(col.key)}
                onChange={(e) => {
                  const next = e.target.checked
                  setVisibleColumns((prev) => ({ ...prev, [col.key]: next }))
                }}
              />
              {col.label}
            </label>
          ))}
        </Panel>
      )}

      {showBulkEdit && (
        <Panel className="mb-4 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Bulk Edit</h3>
            <button
              onClick={() => {
                setShowBulkEdit(false)
                setBulkEditValues({})
              }}
              className="text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Input
                type="text"
                className="h-8"
                value={bulkEditValues.category || ''}
                onChange={(e) =>
                  setBulkEditValues({
                    ...bulkEditValues,
                    category: e.target.value
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subcategory</label>
              <Input
                type="text"
                className="h-8"
                value={bulkEditValues.subcategory || ''}
                onChange={(e) =>
                  setBulkEditValues({
                    ...bulkEditValues,
                    subcategory: e.target.value
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Merchant</label>
              <Input
                type="text"
                className="h-8"
                value={bulkEditValues.merchant || ''}
                onChange={(e) =>
                  setBulkEditValues({
                    ...bulkEditValues,
                    merchant: e.target.value
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input
                type="text"
                className="h-8"
                value={bulkEditValues.notes || ''}
                onChange={(e) =>
                  setBulkEditValues({
                    ...bulkEditValues,
                    notes: e.target.value
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkEdit(false)
                setBulkEditValues({})
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkEdit}>
              Update {selectedIds.size} Transaction
              {selectedIds.size === 1 ? '' : 's'}
            </Button>
          </div>
        </Panel>
      )}

      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}

      {isLoading ? (
        <LoadingState label="Loading transactions..." />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No transactions yet"
          description="Import a CSV statement to get started."
          action={onNavigate && <Button size="sm" onClick={() => onNavigate('import')}>Import a statement</Button>}
        />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
          <div ref={parentRef} className="min-h-0 min-w-0 flex-1 overflow-auto">
            <div
              className="min-h-full"
              style={{
                minWidth: `${tableMinWidth}px`,
                width: `max(100%, ${tableMinWidth}px)`
              }}
            >
              {/* Header */}
              <div
                className="sticky top-0 z-10 grid shrink-0 gap-x-3 bg-muted px-3 py-2 text-xs font-medium shadow-sm"
                style={{ gridTemplateColumns: tableGridTemplate }}
              >
                <div className="flex items-center justify-center">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
                </div>
                <div></div>
                {tableColumns.map((column) => (
                  column.sortKey ? (
                    <button
                      key={column.key}
                      className={`whitespace-nowrap ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                      onClick={() => toggleSort(column.sortKey)}
                    >
                      {column.label}
                    </button>
                  ) : (
                    <div key={column.key} className="whitespace-nowrap">
                      {column.label}
                    </div>
                  )
                ))}
                <div></div>
              </div>

              {/* Virtualised body */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative'
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const tx = transactions[virtualRow.index]
                    const accountMeta = accounts.find((acct) => acct.accountNumber === tx.account)
                    const isEditing = editingId === tx.id
                    const receiptIds = tx.receipt_files
                      ? tx.receipt_files
                          .split(';')
                          .map((value) => value.trim())
                          .filter(Boolean)
                      : []
                    const txHasReceipt = receiptIds.length > 0
                    const isExpanded = expandedReceiptTx === tx.id
                    const isSplitChild = !!tx.parent_id

                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          gridTemplateColumns: tableGridTemplate,
                          transform: `translateY(${virtualRow.start}px)`
                        }}
                        className="grid gap-x-3 border-t px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-center">
                          <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={(e) => toggleSelection(tx.id, e.target.checked)} />
                        </div>
                        <div className="flex items-center justify-center">
                          {txHasReceipt ? (
                            <button className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-xs text-primary hover:bg-accent" onClick={() => setExpandedReceiptTx((prev) => (prev === tx.id ? null : tx.id))} title="Toggle receipt items">
                              {isExpanded ? '▾' : '▸'}
                            </button>
                          ) : null}
                        </div>
                        {tableColumns.map((column) => {
                          switch (column.key) {
                            case 'date':
                              return (
                                <div key={column.key} className="whitespace-nowrap">
                                  {fmtDate(tx.date)}
                                  {isSplitChild && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">Split</span>}
                                </div>
                              )
                            case 'merchant':
                              return (
                                <div key={column.key} className="flex min-w-0 items-center gap-1.5 truncate" title={tx.merchant || ''}>
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      className="w-full rounded-md border px-2 text-sm"
                                      value={editValues.merchant || ''}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          merchant: e.target.value
                                        })
                                      }
                                    />
                                  ) : (
                                    <>
                                      {isSplitChild && <span className="shrink-0 text-muted-foreground">↳</span>}
                                      <span className="truncate">{tx.merchant || '—'}</span>
                                      {tx.ai_edited && <span className="inline-flex shrink-0 items-center rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-primary">AI</span>}
                                    </>
                                  )}
                                </div>
                              )
                            case 'description':
                              return (
                                <div key={column.key} className="truncate text-muted-foreground" title={tx.description || ''}>
                                  {tx.description || '—'}
                                </div>
                              )
                            case 'amount':
                              return <div key={column.key} className={`whitespace-nowrap text-right font-medium ${amountClass(tx.amount)}`}>{fmtCurrency(tx.amount)}</div>
                            case 'account':
                              return (
                                <div key={column.key} className="truncate whitespace-nowrap">
                                  {tx.account}
                                  {accountMeta && (accountMeta.bankName || accountMeta.accountType) && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {accountMeta.bankName ? accountMeta.bankName : 'Unknown Bank'}
                                      {accountMeta.accountType ? ` • ${accountMeta.accountType}` : ''}
                                    </span>
                                  )}
                                </div>
                              )
                            case 'category':
                              return (
                                <div key={column.key} className="truncate">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      className="w-full rounded-md border px-2 text-sm"
                                      value={editValues.category || ''}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          category: e.target.value
                                        })
                                      }
                                    />
                                  ) : (
                                    tx.category || '—'
                                  )}
                                </div>
                              )
                            case 'subcategory':
                              return (
                                <div key={column.key} className="truncate">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      className="w-full rounded-md border px-2 text-sm"
                                      value={editValues.subcategory || ''}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          subcategory: e.target.value
                                        })
                                      }
                                    />
                                  ) : (
                                    tx.subcategory || '—'
                                  )}
                                </div>
                              )
                            case 'notes':
                              return (
                                <div key={column.key} className="truncate">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      className="w-full rounded-md border px-2 text-sm"
                                      value={editValues.notes || ''}
                                      onChange={(e) =>
                                        setEditValues({
                                          ...editValues,
                                          notes: e.target.value
                                        })
                                      }
                                    />
                                  ) : (
                                    tx.notes || '—'
                                  )}
                                </div>
                              )
                            default:
                              return null
                          }
                        })}
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(tx)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(tx)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Edit transaction">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {!isSplitChild && (
                                <button onClick={() => startSplit(tx)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Split transaction">
                                  <Scissors className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (confirm('Delete this transaction?')) {
                                    await window.api.deleteTransactions([tx.id])
                                    await loadTransactions()
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete transaction"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                        {isExpanded && (txHasReceipt || (changesByTx.get(tx.id)?.length ?? 0) > 0) && (
                          <div className="col-span-full mt-2 rounded-md border bg-muted/40 p-3 text-xs">
                            {receiptIds.map((receiptId) => {
                              const detail = receiptDetails[receiptId]
                              return (
                                <div key={receiptId} className="space-y-2">
                                  <div className="font-medium">
                                    Receipt {receiptId}
                                    {detail?.merchant ? ` • ${detail.merchant}` : ''}
                                    {detail?.date ? ` • ${detail.date}` : ''}
                                    {detail?.total !== undefined ? ` • ${detail.total}` : ''}
                                  </div>
                                  {detail?.line_items?.length ? (
                                    <div className="max-h-48 overflow-auto border border-border rounded bg-card text-card-foreground">
                                      <table className="w-full text-xs">
                                        <thead className="bg-secondary text-secondary-foreground">
                                          <tr>
                                            <th className="text-left p-2">Item</th>
                                            <th className="text-left p-2">Subcategory</th>
                                            <th className="text-right p-2">Qty</th>
                                            <th className="text-right p-2">Unit</th>
                                            <th className="text-right p-2">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {detail.line_items.map((item, idx) => {
                                            const tagLabel = item.category_hint || tx.subcategory || tx.category
                                            return (
                                              <tr key={`${receiptId}-${idx}`} className="border-t border-border hover:bg-accent/60">
                                                <td className="p-2">{item.description}</td>
                                                <td className="p-2">
                                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getTagStyle(tagLabel)}`}>{tagLabel || 'Uncategorized'}</span>
                                                </td>
                                                <td className="p-2 text-right">{item.quantity ?? '—'}</td>
                                                <td className="p-2 text-right">{item.unit_price ?? '—'}</td>
                                                <td className="p-2 text-right">{item.total}</td>
                                              </tr>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : detail ? (
                                    <div className="text-muted-foreground">No line items extracted for this receipt.</div>
                                  ) : (
                                    <div className="text-muted-foreground">Receipt details not available.</div>
                                  )}
                                </div>
                              )
                            })}
                            {/* Change history */}
                            {(() => {
                              const txChanges = changesByTx.get(tx.id) ?? []
                              if (!txChanges.length) return null
                              const label = (c: ChangeRow) => {
                                switch (c.change_type) {
                                  case 'set_category':
                                    return `Category → ${c.value || '(cleared)'}`
                                  case 'set_subcategory':
                                    return `Subcategory → ${c.value || '(cleared)'}`
                                  case 'set_merchant':
                                    return `Merchant → ${c.value || '(cleared)'}`
                                  case 'set_notes':
                                    return c.value ? `Note: ${c.value}` : 'Note cleared'
                                  case 'link_receipt':
                                    return 'Receipt linked'
                                  case 'unlink_receipt':
                                    return 'Receipt unlinked'
                                  case 'split':
                                    return 'Transaction split'
                                  default:
                                    return c.change_type
                                }
                              }
                              const fmt = (iso: string) => {
                                const d = new Date(iso)
                                return (
                                  d.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) +
                                  ' ' +
                                  d.toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                )
                              }
                              return (
                                <div className={txHasReceipt ? 'mt-3 pt-3 border-t border-border' : ''}>
                                  <div className="flex items-center gap-1.5 mb-2 text-muted-foreground font-medium">
                                    <History className="h-3 w-3" />
                                    <span>History ({txChanges.length})</span>
                                  </div>
                                  <ol className="space-y-1.5">
                                    {txChanges.map((c) => (
                                      <li key={c.change_id} className="flex items-start gap-2">
                                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0 mt-1.5" />
                                        <span className="flex-1">{label(c)}</span>
                                        <span className="text-muted-foreground/60 whitespace-nowrap">{fmt(c.time)}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {splitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-4xl rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">Split transaction</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {splitTarget.merchant || splitTarget.description || 'Transaction'} · {fmtCurrency(splitTarget.amount)}
                </p>
              </div>
              <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={closeSplit} title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-[120px_1fr_1fr_2fr_32px] gap-2 text-xs font-medium text-muted-foreground">
                <div>Amount</div>
                <div>Category</div>
                <div>Subcategory</div>
                <div>Notes</div>
                <div />
              </div>

              <div className="mt-2 space-y-2">
                {splitRows.map((row, index) => (
                  <div key={row.id} className="grid grid-cols-[120px_1fr_1fr_2fr_32px] gap-2">
                    <input type="number" step="0.01" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.amount} onChange={(e) => updateSplitRow(row.id, { amount: e.target.value })} aria-label={`Split ${index + 1} amount`} />
                    <input type="text" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.category} onChange={(e) => updateSplitRow(row.id, { category: e.target.value })} aria-label={`Split ${index + 1} category`} />
                    <input type="text" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.subcategory} onChange={(e) => updateSplitRow(row.id, { subcategory: e.target.value })} aria-label={`Split ${index + 1} subcategory`} />
                    <input type="text" className="h-9 rounded-md border bg-background px-2 text-sm" value={row.notes} onChange={(e) => updateSplitRow(row.id, { notes: e.target.value })} aria-label={`Split ${index + 1} notes`} />
                    <button className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-red-500 disabled:opacity-40" onClick={() => removeSplitRow(row.id)} disabled={splitRows.length <= 2} title="Remove split row">
                      <MinusCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={addSplitRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add row
                </Button>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Split total: <span className={amountClass(splitRowsTotal)}>{fmtCurrency(splitRowsTotal)}</span>
                  </span>
                  <span className={splitDifference === 0 ? 'text-green-500' : 'text-yellow-500'}>Difference: {fmtCurrency(splitDifference / 100)}</span>
                </div>
              </div>

              {splitError && <div className="mt-3 rounded-md bg-red-500/10 p-3 text-sm text-red-400">{splitError}</div>}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="outline" onClick={closeSplit}>
                Cancel
              </Button>
              <Button onClick={saveSplit} disabled={isLoading || splitDifference !== 0}>
                Save split
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <span>{total > 0 ? `${total} transaction${total === 1 ? '' : 's'}` : 'No transactions'}</span>
          {total > 0 && <span className={`ml-4 font-medium ${amountClass(totalAmount)}`}>{fmtCurrency(totalAmount)}</span>}
        </div>
      </div>
    </PageShell>
  )
}
