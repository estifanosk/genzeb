import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { LineItemExplorerRow } from '@core/types'
import type { QueryLineItemsResponse } from '@core/types/ipc'

export function ItemExplorerPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [items, setItems] = useState<LineItemExplorerRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [merchant, setMerchant] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [linkedStatus, setLinkedStatus] = useState<'all' | 'linked' | 'unlinked'>('all')

  const [sortBy, setSortBy] = useState<'date' | 'merchant' | 'item' | 'total' | 'category'>(
    'date'
  )
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadItems = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = (await window.api.getLineItems({
        filters: {
          ...(search ? { search } : {}),
          ...(category !== 'all' ? { category } : {}),
          ...(merchant ? { merchant } : {}),
          ...(dateStart || dateEnd ? { dateRange: { start: dateStart, end: dateEnd } } : {}),
          ...(linkedStatus !== 'all' ? { linkedStatus } : {}),
          ...(amountMin || amountMax
            ? {
                amountRange: {
                  min: amountMin ? Number(amountMin) : undefined,
                  max: amountMax ? Number(amountMax) : undefined
                }
              }
            : {})
        },
        sortBy,
        sortOrder
      })) as QueryLineItemsResponse
      setItems(res.items)
      setTotal(res.total)
      setTotalAmount(res.totalAmount)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [search, category, merchant, dateStart, dateEnd, amountMin, amountMax, linkedStatus, sortBy, sortOrder])

  const quickCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      if (!item.item_category) continue
      counts.set(item.item_category, (counts.get(item.item_category) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name)
  }, [items])

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Item Explorer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total} item{total === 1 ? '' : 's'} • Total {totalAmount.toFixed(2)}
            {items.some(i => i.is_unlinked) && (
              <span className="ml-3 inline-flex items-center gap-1 text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" />
                {items.filter(i => i.is_unlinked).length} unlinked
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="outline" size="sm" onClick={loadItems} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Search item name</label>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="border rounded-md pl-8 pr-2 text-sm w-full h-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. beverage, coffee"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Merchant contains</label>
          <input
            type="text"
            className="border rounded-md px-2 text-sm w-full h-8"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date start</label>
          <input
            type="date"
            className="border rounded-md px-2 text-sm w-full h-8"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date end</label>
          <input
            type="date"
            className="border rounded-md px-2 text-sm w-full h-8"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <select
            className="border rounded-md px-2 text-sm w-full h-8"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All</option>
            {quickCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Item total min</label>
          <input
            type="number"
            step="0.01"
            className="border rounded-md px-2 text-sm w-full h-8"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Item total max</label>
          <input
            type="number"
            step="0.01"
            className="border rounded-md px-2 text-sm w-full h-8"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            className="border rounded-md px-2 text-sm w-full h-8"
            value={linkedStatus}
            onChange={(e) => setLinkedStatus(e.target.value as 'all' | 'linked' | 'unlinked')}
          >
            <option value="all">All</option>
            <option value="linked">Linked only</option>
            <option value="unlinked">Unlinked only</option>
          </select>
        </div>
      </div>

      {quickCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`px-3 py-1 text-xs rounded-full border ${
              category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {quickCategories.map((name) => (
            <button
              key={name}
              className={`px-3 py-1 text-xs rounded-full border ${
                category === name ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
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
            <p className="text-sm">Loading line items...</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">No line items yet</p>
            <p className="text-sm mt-1">Import receipts to see item-level data</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Sort by</span>
              <select
                className="border rounded-md px-2 py-1 text-xs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="date">Date</option>
                <option value="merchant">Merchant</option>
                <option value="item">Item</option>
                <option value="total">Item total</option>
                <option value="category">Category</option>
              </select>
              <select
                className="border rounded-md px-2 py-1 text-xs"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
          <div className="overflow-auto">
            <div className="min-w-[1400px]">
              <div className="grid grid-cols-[120px_2fr_2fr_2fr_140px_140px_90px_110px_120px_140px_160px_100px_2fr] gap-x-3 bg-muted px-3 py-2 text-xs font-medium sticky top-0">
                <div>Date</div>
                <div>Merchant</div>
                <div>Description</div>
                <div>Item</div>
                <div>Category</div>
                <div>Subcategory</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Unit</div>
                <div className="text-right">Item Total</div>
                <div className="text-right">Tx Amount</div>
                <div>Account</div>
                <div>Status</div>
                <div>Notes</div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                {items.map((row) => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-[120px_2fr_2fr_2fr_140px_140px_90px_110px_120px_140px_160px_100px_2fr] gap-x-3 px-3 py-2 text-sm border-t ${row.is_unlinked ? 'bg-amber-500/5' : ''}`}
                  >
                    <div className="whitespace-nowrap text-muted-foreground">{row.date}</div>
                    <div className="truncate" title={row.merchant}>
                      {row.merchant || <span className="text-muted-foreground italic">Unknown</span>}
                    </div>
                    <div className="truncate text-muted-foreground" title={row.description}>
                      {row.description || '—'}
                    </div>
                    <div className="truncate" title={row.item}>
                      {row.item}
                    </div>
                    <div className="truncate" title={row.category || ''}>
                      {row.category || <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="truncate" title={row.subcategory || ''}>
                      {row.subcategory || <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-right whitespace-nowrap">{row.quantity ?? '—'}</div>
                    <div className="text-right whitespace-nowrap">
                      {row.unit_price !== undefined ? row.unit_price.toFixed(2) : '—'}
                    </div>
                    <div className="text-right whitespace-nowrap font-medium">
                      {row.item_total.toFixed(2)}
                    </div>
                    <div className="text-right whitespace-nowrap text-muted-foreground">
                      {row.transaction_amount > 0 ? row.transaction_amount.toFixed(2) : '—'}
                    </div>
                    <div className="truncate text-muted-foreground">
                      {row.account || <span className="italic">—</span>}
                    </div>
                    <div>
                      {row.is_unlinked ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400"
                          title="No linked transaction — reconcile in the Receipts page"
                        >
                          <AlertCircle className="h-3 w-3" />
                          Unlinked
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </div>
                    <div className="truncate text-muted-foreground">{row.notes || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
