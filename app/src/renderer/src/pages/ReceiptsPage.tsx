import { useEffect, useState } from 'react'
import { RefreshCw, Receipt, ChevronDown, ChevronRight, ImageOff, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageHeader, PageShell } from '../components/ui/page'
import { EmptyState, InlineAlert } from '../components/ui/state'
import { fmtCurrency } from '../lib/utils'
import type { ReceiptIndexRow, ReceiptDetail } from '@core/types'

type ReceiptRow = ReceiptIndexRow & { linked: boolean }

function OcrBadge({ status }: { status: ReceiptIndexRow['ocr_status'] }) {
  if (status === 'ok') return <Badge variant="success">OCR OK</Badge>
  if (status === 'failed') return <Badge variant="danger">Failed</Badge>
  return <Badge variant="warning">Pending</Badge>
}

function LinkedBadge({ linked }: { linked: boolean }) {
  if (linked) return <Badge variant="info">Linked</Badge>
  return <Badge>Unlinked</Badge>
}

// Small thumbnail shown in the table row
function ReceiptThumbnail({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    window.api.getReceiptPreview(filePath).then(setSrc)
  }, [filePath])

  if (src === undefined) {
    // Loading skeleton
    return <div className="w-10 h-14 rounded bg-muted animate-pulse" />
  }
  if (!src) {
    return (
      <div className="w-10 h-14 rounded border border-border bg-muted/40 flex items-center justify-center text-muted-foreground">
        <ImageOff className="h-4 w-4" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt="Receipt thumbnail"
      className="w-10 h-14 object-cover rounded border border-border"
    />
  )
}

// Expanded detail panel: full-size image + line items
function ReceiptExpandedDetail({ receipt }: { receipt: ReceiptRow }) {
  const [detail, setDetail] = useState<ReceiptDetail | null>(null)
  const [imageData, setImageData] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      window.api.getReceiptDetail(receipt.receipt_id),
      window.api.getReceiptPreview(receipt.file_path)
    ]).then(([d, img]) => {
      setDetail(d)
      setImageData(img)
    }).finally(() => setLoading(false))
  }, [receipt.receipt_id])

  if (loading) {
    return (
      <div className="flex gap-6 p-4 bg-muted/30 border-t border-border">
        <div className="w-96 h-96 rounded bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-muted rounded w-24 animate-pulse" />
          <div className="h-3 bg-muted rounded w-full animate-pulse" />
          <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6 p-4 bg-muted/30 border-t border-border">
      {/* Full receipt image */}
      <div className="w-96 shrink-0">
        {imageData ? (
          <img
            src={imageData}
            alt="Receipt"
            className="w-full rounded border border-border"
          />
        ) : (
          <div className="w-full h-96 rounded border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/50">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">No image available</span>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="flex-1 min-w-0">
        {detail?.line_items?.length ? (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Line items ({detail.line_items.length})
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-1.5 pr-3 font-medium">Item</th>
                  <th className="text-right pb-1.5 pr-3 font-medium w-10">Qty</th>
                  <th className="text-right pb-1.5 pr-3 font-medium w-20">Unit</th>
                  <th className="text-right pb-1.5 font-medium w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.line_items.map((item, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-3">{item.description}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{item.quantity ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">
                      {item.unit_price !== undefined ? fmtCurrency(item.unit_price) : '—'}
                    </td>
                    <td className="py-1.5 text-right font-medium">{fmtCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(detail.tax !== undefined || detail.tip !== undefined) && (
              <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                {detail.tax !== undefined && (
                  <div className="flex justify-between"><span>Tax</span><span>{fmtCurrency(detail.tax)}</span></div>
                )}
                {detail.tip !== undefined && (
                  <div className="flex justify-between"><span>Tip</span><span>{fmtCurrency(detail.tip)}</span></div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No line items extracted.</p>
        )}
      </div>
    </div>
  )
}

export function ReceiptsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const load = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const rows = (await window.api.getReceipts()) as ReceiptRow[]
      setReceipts(rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')))
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = receipts.length
  const linked = receipts.filter((r) => r.linked).length
  const ocrOk = receipts.filter((r) => r.ocr_status === 'ok').length
  const ocrPct = total > 0 ? Math.round((ocrOk / total) * 100) : 0

  const toggleExpand = (id: string) => setExpanded((prev) => (prev === id ? null : id))

  const rerunOcr = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRowErrors((prev) => { const n = { ...prev }; delete n[receiptId]; return n })
    setRetrying((prev) => ({ ...prev, [receiptId]: true }))
    try {
      await window.api.runOcr(receiptId)
      await load()
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [receiptId]: (err as Error).message }))
      await load()
    } finally {
      setRetrying((prev) => ({ ...prev, [receiptId]: false }))
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Receipts"
        description="Review imported receipts, OCR status, and extracted line items."
        meta={total > 0 && (
          <>
            <Badge variant="neutral">{total} receipt{total !== 1 ? 's' : ''}</Badge>
            <Badge variant="info">{linked} linked</Badge>
            <Badge>{total - linked} unlinked</Badge>
            <Badge variant={ocrPct === 100 ? 'success' : ocrPct > 0 ? 'warning' : 'default'}>{ocrPct}% OCR success</Badge>
          </>
        )}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <InlineAlert className="mb-4">{loadError}</InlineAlert>
      )}

      {/* Empty state */}
      {!isLoading && total === 0 && (
        <EmptyState
          icon={Receipt}
          title="No receipts yet"
          description="Import receipt images to get started."
          action={onNavigate && (
            <Button size="sm" onClick={() => onNavigate('import')}>
              Import a receipt
            </Button>
          )}
        />
      )}

      {/* Table */}
      {total > 0 && (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-muted-foreground border-b border-border">
              <tr>
                <th className="w-6 p-3" />
                <th className="w-16 p-3" /> {/* thumbnail column */}
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Merchant</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">OCR</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <>
                  <tr
                    key={r.receipt_id}
                    className="border-b border-border hover:bg-accent/40 cursor-pointer"
                    onClick={() => toggleExpand(r.receipt_id)}
                  >
                    <td className="p-3 text-muted-foreground">
                      {expanded === r.receipt_id
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                    </td>
                    <td className="p-2">
                      <ReceiptThumbnail filePath={r.file_path} />
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">{r.date ?? '—'}</td>
                    <td className="p-3 font-medium">
                      {r.merchant ?? <span className="text-muted-foreground italic">Unknown</span>}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.total !== undefined ? fmtCurrency(r.total) : '—'}
                    </td>
                    <td className="p-3"><OcrBadge status={r.ocr_status} /></td>
                    <td className="p-3"><LinkedBadge linked={r.linked} /></td>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      {(r.ocr_status === 'failed' || r.ocr_status === 'pending') && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0"
                            disabled={retrying[r.receipt_id]}
                            onClick={(e) => rerunOcr(r.receipt_id, e)}
                            title="Re-run OCR"
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${retrying[r.receipt_id] ? 'animate-spin' : ''}`} />
                          </Button>
                          {rowErrors[r.receipt_id] && (
                            <span className="text-[11px] text-red-400 max-w-[160px] leading-tight">
                              {rowErrors[r.receipt_id]}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded === r.receipt_id && (
                    <tr key={`${r.receipt_id}-detail`} className="border-b border-border">
                      <td colSpan={8} className="p-0">
                        <ReceiptExpandedDetail receipt={r} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  )
}
