import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, AlertCircle, Filter } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { PageHeader, PageShell, Panel } from '../components/ui/page'
import { Select } from '../components/ui/select'
import { EmptyState, InlineAlert, LoadingState } from '../components/ui/state'
import { fmtCurrency, amountClass } from '../lib/utils'
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
  const [showFilters, setShowFilters] = useState(false)

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
  const unlinkedCount = items.filter(i => i.is_unlinked).length
  const activeFilterCount = [search, merchant, dateStart, dateEnd, amountMin, amountMax]
    .filter(Boolean).length +
    (category !== 'all' ? 1 : 0) +
    (linkedStatus !== 'all' ? 1 : 0)

  return (
    <PageShell>
      <PageHeader
        title="Item Explorer"
        description="Inspect receipt line items across merchants and transactions."
        meta={
          <>
            <Badge variant="neutral">{total} item{total === 1 ? '' : 's'}</Badge>
            <Badge variant={totalAmount >= 0 ? 'success' : 'danger'}>Total {fmtCurrency(totalAmount)}</Badge>
            {unlinkedCount > 0 && <Badge variant="warning"><AlertCircle className="h-3 w-3" /> {unlinkedCount} unlinked</Badge>}
          </>
        }
        actions={
          <>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(p => !p)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && <Badge variant={showFilters ? 'neutral' : 'info'} className="ml-1">{activeFilterCount}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={loadItems} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          </>
        }
      />

      {showFilters && <Panel className="mb-4 grid grid-cols-1 gap-3 p-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Search item name</label>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              className="h-8 pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. beverage, coffee"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Merchant contains</label>
          <Input
            type="text"
            className="h-8"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date start</label>
          <Input
            type="date"
            className="h-8"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date end</label>
          <Input
            type="date"
            className="h-8"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <Select
            className="h-8 w-full"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All</option>
            {quickCategories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Item total min</label>
          <Input
            type="number"
            step="0.01"
            className="h-8"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Item total max</label>
          <Input
            type="number"
            step="0.01"
            className="h-8"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            className="h-8 w-full"
            value={linkedStatus}
            onChange={(e) => setLinkedStatus(e.target.value as 'all' | 'linked' | 'unlinked')}
          >
            <option value="all">All</option>
            <option value="linked">Linked only</option>
            <option value="unlinked">Unlinked only</option>
          </Select>
        </div>
      </Panel>}

      {quickCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            className={`rounded-full border px-3 py-1 text-xs ${
              category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {quickCategories.map((name) => (
            <button
              key={name}
              className={`rounded-full border px-3 py-1 text-xs ${
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
        <InlineAlert className="mb-4">{error}</InlineAlert>
      )}

      {isLoading ? (
        <LoadingState label="Loading line items..." />
      ) : items.length === 0 ? (
        <EmptyState title="No line items yet" description="Import receipts to see item-level data." />
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
          <div className="shrink-0 border-b bg-muted px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Sort by</span>
              <Select
                className="h-7 px-2 py-1 text-xs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="date">Date</option>
                <option value="merchant">Merchant</option>
                <option value="item">Item</option>
                <option value="total">Item total</option>
                <option value="category">Category</option>
              </Select>
              <Select
                className="h-7 px-2 py-1 text-xs"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </Select>
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <div className="min-w-[1500px]">
              <div className="sticky top-0 z-10 grid grid-cols-[120px_2fr_2fr_2fr_140px_140px_90px_110px_120px_140px_160px_100px_2fr] gap-x-3 border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm">
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
              {items.map((row) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-[120px_2fr_2fr_2fr_140px_140px_90px_110px_120px_140px_160px_100px_2fr] gap-x-3 border-b px-3 py-2 text-sm last:border-b-0 ${row.is_unlinked ? 'bg-amber-500/5' : ''}`}
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
                  <div className="whitespace-nowrap text-right">{row.quantity ?? '—'}</div>
                  <div className="whitespace-nowrap text-right">
                    {row.unit_price !== undefined ? fmtCurrency(row.unit_price) : '—'}
                  </div>
                  <div className={`whitespace-nowrap text-right font-medium ${amountClass(row.item_total)}`}>
                    {fmtCurrency(row.item_total)}
                  </div>
                  <div className={`whitespace-nowrap text-right ${row.transaction_amount !== 0 ? amountClass(row.transaction_amount) : 'text-muted-foreground'}`}>
                    {row.transaction_amount !== 0 ? fmtCurrency(row.transaction_amount) : '—'}
                  </div>
                  <div className="truncate text-muted-foreground">
                    {row.account || <span className="italic">—</span>}
                  </div>
                  <div>
                    {row.is_unlinked ? (
                      <Badge variant="warning" title="No linked transaction — reconcile in the Receipts page">
                        <AlertCircle className="h-3 w-3" />
                        Unlinked
                      </Badge>
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
      )}
    </PageShell>
  )
}
