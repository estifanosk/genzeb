import { useEffect, useMemo, useState } from 'react'
import { FileText, RefreshCw, Filter, Columns, Edit2, Check, X, Trash2, History } from 'lucide-react'
import { Button } from '../components/ui/button'
import { fmtCurrency, amountClass, fmtDate } from '../lib/utils'
import type { AccountInfo, ReceiptDetail, TransactionRow, ChangeRow } from '@core/types'

interface EditValues {
  category?: string
  subcategory?: string
  merchant?: string
  notes?: string
}

export function TransactionsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const storageKey = 'ledgerbox.transactions.ui'
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

  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues>({})
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditValues, setBulkEditValues] = useState<EditValues>({})

  const [showColumnManager, setShowColumnManager] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(defaultVisibleColumns)
  const [receiptDetails, setReceiptDetails] = useState<Record<string, ReceiptDetail | null>>({})
  const [expandedReceiptTx, setExpandedReceiptTx] = useState<string | null>(null)
  const [changesByTx, setChangesByTx] = useState<Map<string, ChangeRow[]>>(new Map())

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

  const tagStyles = [
    'bg-amber-100 text-amber-900',
    'bg-emerald-100 text-emerald-900',
    'bg-sky-100 text-sky-900',
    'bg-rose-100 text-rose-900',
    'bg-lime-100 text-lime-900',
    'bg-indigo-100 text-indigo-900'
  ]

  const getTagStyle = (label?: string) => {
    if (!label) return 'bg-slate-100 text-slate-700'
    let hash = 0
    for (let i = 0; i < label.length; i += 1) {
      hash = (hash * 31 + label.charCodeAt(i)) % tagStyles.length
    }
    return tagStyles[hash]
  }

  const selectedAccountMeta =
    selectedAccount === 'all'
      ? null
      : accounts.find((acct) => acct.accountNumber === selectedAccount)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const offset = (page - 1) * pageSize

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
        limit: pageSize,
        offset
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

  useEffect(() => { loadChanges() }, [])

  useEffect(() => {
    loadTransactions()
  }, [
    search,
    selectedAccount,
    dateStart,
    dateEnd,
    amountMin,
    amountMax,
    merchantContains,
    hasReceipt,
    uncategorized,
    sortBy,
    sortOrder,
    page
  ])

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
  }, [
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
  ])

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

  const clearAll = async () => {
    const confirmed = window.confirm('Clear all transactions and import logs?')
    if (!confirmed) return
    setIsLoading(true)
    try {
      await window.api.clearAllData()
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

  const saveEdit = async (tx: TransactionRow) => {
    if (!editingId) return
    const changes = [] as Array<{ type: 'set_category' | 'set_subcategory' | 'set_merchant' | 'set_notes'; value: string }>

    if ((editValues.category ?? '') !== (tx.category ?? '')) {
      changes.push({ type: 'set_category', value: editValues.category ?? '' })
    }
    if ((editValues.subcategory ?? '') !== (tx.subcategory ?? '')) {
      changes.push({ type: 'set_subcategory', value: editValues.subcategory ?? '' })
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
    setPage(1)
  }

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length

  const showingStart = total === 0 ? 0 : offset + 1
  const showingEnd = Math.min(offset + transactions.length, total)

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Transactions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total} record{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2 items-start flex-wrap">
          <div className="relative">
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              className="border rounded-md px-2 text-sm h-8"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {(() => {
              const count = [dateStart, dateEnd, amountMin, amountMax, merchantContains]
                .filter(Boolean).length +
                (selectedAccount !== 'all' ? 1 : 0) +
                (hasReceipt !== 'all' ? 1 : 0) +
                (uncategorized ? 1 : 0)
              return count > 0
                ? <span className="ml-1.5 bg-primary-foreground text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{count}</span>
                : null
            })()}
          </Button>
          <Button
            variant={showColumnManager ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowColumnManager((prev) => !prev)}
          >
            <Columns className="h-4 w-4 mr-1" />
            Columns
          </Button>
          <select
            className="border rounded-md px-2 text-sm h-8"
            value={selectedAccount}
            onChange={(e) => {
              setPage(1)
              setSelectedAccount(e.target.value)
            }}
          >
            <option value="all">All Accounts</option>
            {accounts.map((acct) => (
              <option key={acct.accountNumber} value={acct.accountNumber}>
                {acct.accountNumber}
              </option>
            ))}
          </select>
          {selectedAccountMeta && (
            <div className="text-xs text-muted-foreground px-2 py-1 border rounded-md">
              <div>
                <span className="font-medium text-foreground">Bank:</span>{' '}
                {selectedAccountMeta.bankName || 'Unknown'}
              </div>
              <div>
                <span className="font-medium text-foreground">Type:</span>{' '}
                {selectedAccountMeta.accountType || 'Unknown'}
              </div>
              {selectedAccountMeta.period && (
                <div>
                  <span className="font-medium text-foreground">Period:</span>{' '}
                  {selectedAccountMeta.period}
                </div>
              )}
              {selectedAccountMeta.lastImportedAt && (
                <div>
                  <span className="font-medium text-foreground">Last import:</span>{' '}
                  {new Date(selectedAccountMeta.lastImportedAt).toLocaleString()}
                </div>
              )}
              {selectedAccountMeta.sourceFiles?.length > 0 && (
                <div>
                  <span className="font-medium text-foreground">Files:</span>{' '}
                  {selectedAccountMeta.sourceFiles.length}
                </div>
              )}
            </div>
          )}
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
              <Button
                onClick={() => setShowBulkEdit(true)}
                variant="outline"
                size="sm"
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Bulk Edit
              </Button>
              <Button
                onClick={removeSelected}
                variant="outline"
                size="sm"
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove Selected
              </Button>
            </>
          )}
          <Button onClick={clearAll} variant="outline" size="sm" disabled={isLoading}>
            Clear All
          </Button>
          <Button onClick={loadTransactions} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Date from</label>
            <input
              type="date"
              className="border rounded-md px-2 text-sm w-full h-8"
              value={dateStart}
              onChange={(e) => {
                setPage(1)
                setDateStart(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Date to</label>
            <input
              type="date"
              className="border rounded-md px-2 text-sm w-full h-8"
              value={dateEnd}
              onChange={(e) => {
                setPage(1)
                setDateEnd(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Merchant contains</label>
            <input
              type="text"
              className="border rounded-md px-2 text-sm w-full h-8"
              value={merchantContains}
              onChange={(e) => {
                setPage(1)
                setMerchantContains(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount min</label>
            <input
              type="number"
              step="0.01"
              className="border rounded-md px-2 text-sm w-full h-8"
              value={amountMin}
              onChange={(e) => {
                setPage(1)
                setAmountMin(e.target.value)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Amount max</label>
            <input
              type="number"
              step="0.01"
              className="border rounded-md px-2 text-sm w-full h-8"
              value={amountMax}
              onChange={(e) => {
                setPage(1)
                setAmountMax(e.target.value)
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Has receipt</label>
            <select
              className="border rounded-md px-2 text-sm h-8"
              value={hasReceipt}
              onChange={(e) => {
                setPage(1)
                setHasReceipt(e.target.value as 'all' | 'yes' | 'no')
              }}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <input
                type="checkbox"
                checked={uncategorized}
                onChange={(e) => {
                  setPage(1)
                  setUncategorized(e.target.checked)
                }}
              />
              Uncategorized
            </label>
          </div>
        </div>
      )}

      {showColumnManager && (
        <div className="border rounded-lg p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
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
        </div>
      )}

      {showBulkEdit && (
        <div className="border rounded-lg p-4 mb-4">
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
              <input
                type="text"
                className="border rounded-md px-2 text-sm w-full h-8"
                value={bulkEditValues.category || ''}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, category: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subcategory</label>
              <input
                type="text"
                className="border rounded-md px-2 text-sm w-full h-8"
                value={bulkEditValues.subcategory || ''}
                onChange={(e) =>
                  setBulkEditValues({ ...bulkEditValues, subcategory: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Merchant</label>
              <input
                type="text"
                className="border rounded-md px-2 text-sm w-full h-8"
                value={bulkEditValues.merchant || ''}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, merchant: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <input
                type="text"
                className="border rounded-md px-2 text-sm w-full h-8"
                value={bulkEditValues.notes || ''}
                onChange={(e) => setBulkEditValues({ ...bulkEditValues, notes: e.target.value })}
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
              Update {selectedIds.size} Transaction{selectedIds.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 text-sm text-destructive border border-destructive/40 rounded-md p-3">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin opacity-60" />
            <p className="text-sm">Loading transactions...</p>
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No transactions yet</p>
            <p className="text-sm mt-1 mb-4">Import a CSV statement to get started</p>
            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate('import')}>
                Import a statement
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-auto">
            <div className="min-w-[1400px]">
              <div className="grid grid-cols-[32px_28px_120px_6fr_6fr_140px_200px_140px_140px_2fr_80px] gap-x-3 bg-muted px-3 py-2 text-xs font-medium">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </div>
                <div></div>
                {effectiveVisibleColumns.date && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('date')}>
                    Date
                  </button>
                )}
                {effectiveVisibleColumns.merchant && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('merchant')}>
                    Merchant
                  </button>
                )}
                {effectiveVisibleColumns.description && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('description')}>
                    Description
                  </button>
                )}
                {effectiveVisibleColumns.amount && (
                  <button className="whitespace-nowrap text-right" onClick={() => toggleSort('amount')}>
                    Amount
                  </button>
                )}
                {effectiveVisibleColumns.account && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('account')}>
                    Account
                  </button>
                )}
                {effectiveVisibleColumns.category && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('category')}>
                    Category
                  </button>
                )}
                {effectiveVisibleColumns.subcategory && (
                  <button className="whitespace-nowrap text-left" onClick={() => toggleSort('subcategory')}>
                    Subcategory
                  </button>
                )}
                {effectiveVisibleColumns.notes && <div className="whitespace-nowrap">Notes</div>}
                <div></div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                {transactions.map((tx) => {
                  const accountMeta = accounts.find((acct) => acct.accountNumber === tx.account)
                  const isEditing = editingId === tx.id
                  const receiptIds = tx.receipt_files
                    ? tx.receipt_files
                        .split(';')
                        .map((value) => value.trim())
                        .filter(Boolean)
                    : []
                  const hasReceipt = receiptIds.length > 0
                  const isExpanded = expandedReceiptTx === tx.id

                  return (
                    <div
                      key={tx.id}
                      className="grid grid-cols-[32px_28px_120px_6fr_6fr_140px_200px_140px_140px_2fr_80px] gap-x-3 px-3 py-2 text-sm border-t"
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={(e) => toggleSelection(tx.id, e.target.checked)}
                        />
                      </div>
                      <div className="flex items-center justify-center">
                        {hasReceipt ? (
                          <button
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border text-xs text-primary hover:bg-accent"
                            onClick={() =>
                              setExpandedReceiptTx((prev) => (prev === tx.id ? null : tx.id))
                            }
                            title="Toggle receipt items"
                          >
                            {isExpanded ? '▾' : '▸'}
                          </button>
                        ) : null}
                      </div>
                      {effectiveVisibleColumns.date && (
                        <div className="whitespace-nowrap">{fmtDate(tx.date)}</div>
                      )}
                      {effectiveVisibleColumns.merchant && (
                        <div className="truncate" title={tx.merchant || ''}>
                          {isEditing ? (
                            <input
                              type="text"
                              className="border rounded-md px-2 text-sm w-full"
                              value={editValues.merchant || ''}
                              onChange={(e) =>
                                setEditValues({ ...editValues, merchant: e.target.value })
                              }
                            />
                          ) : (
                            tx.merchant || '—'
                          )}
                        </div>
                      )}
                      {effectiveVisibleColumns.description && (
                        <div className="truncate text-muted-foreground" title={tx.description || ''}>
                          {tx.description || '—'}
                        </div>
                      )}
                      {effectiveVisibleColumns.amount && (
                        <div className={`text-right whitespace-nowrap font-medium ${amountClass(tx.amount)}`}>
                          {fmtCurrency(tx.amount)}
                        </div>
                      )}
                      {effectiveVisibleColumns.account && (
                        <div className="truncate whitespace-nowrap">
                          {tx.account}
                          {accountMeta && (accountMeta.bankName || accountMeta.accountType) && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {accountMeta.bankName ? accountMeta.bankName : 'Unknown Bank'}
                              {accountMeta.accountType ? ` • ${accountMeta.accountType}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {effectiveVisibleColumns.category && (
                        <div className="truncate">
                          {isEditing ? (
                            <input
                              type="text"
                              className="border rounded-md px-2 text-sm w-full"
                              value={editValues.category || ''}
                              onChange={(e) =>
                                setEditValues({ ...editValues, category: e.target.value })
                              }
                            />
                          ) : (
                            tx.category || '—'
                          )}
                        </div>
                      )}
                      {effectiveVisibleColumns.subcategory && (
                        <div className="truncate">
                          {isEditing ? (
                            <input
                              type="text"
                              className="border rounded-md px-2 text-sm w-full"
                              value={editValues.subcategory || ''}
                              onChange={(e) =>
                                setEditValues({ ...editValues, subcategory: e.target.value })
                              }
                            />
                          ) : (
                            tx.subcategory || '—'
                          )}
                        </div>
                      )}
                      {effectiveVisibleColumns.notes && (
                        <div className="truncate">
                          {isEditing ? (
                            <input
                              type="text"
                              className="border rounded-md px-2 text-sm w-full"
                              value={editValues.notes || ''}
                              onChange={(e) => setEditValues({ ...editValues, notes: e.target.value })}
                            />
                          ) : (
                            tx.notes || '—'
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(tx)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(tx)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this transaction?')) {
                                  await window.api.deleteTransactions([tx.id])
                                  await loadTransactions()
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                      {isExpanded && (hasReceipt || (changesByTx.get(tx.id)?.length ?? 0) > 0) && (
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
                                          const tagLabel =
                                            item.category_hint || tx.subcategory || tx.category
                                          return (
                                            <tr
                                              key={`${receiptId}-${idx}`}
                                              className="border-t border-border hover:bg-accent/60"
                                            >
                                              <td className="p-2">{item.description}</td>
                                              <td className="p-2">
                                                <span
                                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${getTagStyle(
                                                    tagLabel
                                                  )}`}
                                                >
                                                  {tagLabel || 'Uncategorized'}
                                                </span>
                                              </td>
                                              <td className="p-2 text-right">
                                                {item.quantity ?? '—'}
                                              </td>
                                              <td className="p-2 text-right">
                                                {item.unit_price ?? '—'}
                                              </td>
                                              <td className="p-2 text-right">{item.total}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : detail ? (
                                  <div className="text-muted-foreground">
                                    No line items extracted for this receipt.
                                  </div>
                                ) : (
                                  <div className="text-muted-foreground">
                                    Receipt details not available.
                                  </div>
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
                                case 'set_category':    return `Category → ${c.value || '(cleared)'}`
                                case 'set_subcategory': return `Subcategory → ${c.value || '(cleared)'}`
                                case 'set_merchant':    return `Merchant → ${c.value || '(cleared)'}`
                                case 'set_notes':       return c.value ? `Note: ${c.value}` : 'Note cleared'
                                case 'link_receipt':    return 'Receipt linked'
                                case 'unlink_receipt':  return 'Receipt unlinked'
                                case 'split':           return 'Transaction split'
                                default:                return c.change_type
                              }
                            }
                            const fmt = (iso: string) => {
                              const d = new Date(iso)
                              return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                            }
                            return (
                              <div className={hasReceipt ? 'mt-3 pt-3 border-t border-border' : ''}>
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

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>
          <span>
            {total > 0
              ? `Showing ${showingStart}–${showingEnd} of ${total}`
              : 'No transactions'}
          </span>
          {total > 0 && (
            <span className={`ml-4 font-medium ${amountClass(totalAmount)}`}>
              {fmtCurrency(totalAmount)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
