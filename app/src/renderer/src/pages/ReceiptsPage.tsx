import { useEffect, useState } from 'react'
import { RefreshCw, Receipt, ChevronDown, ChevronRight, ImageOff } from 'lucide-react'
import { Button } from '../components/ui/button'
import type { ReceiptIndexRow, ReceiptDetail } from '@core/types'

type ReceiptRow = ReceiptIndexRow & { linked: boolean }

function OcrBadge({ status }: { status: ReceiptIndexRow['ocr_status'] }) {
  if (status === 'ok') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-500/15 text-green-400">OCR OK</span>
  if (status === 'failed') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400">Failed</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-500/15 text-yellow-400">Pending</span>
}

function LinkedBadge({ linked }: { linked: boolean }) {
  if (linked) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400">Linked</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">Unlinked</span>
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
        <div className="w-64 h-80 rounded bg-muted animate-pulse shrink-0" />
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
      <div className="w-64 shrink-0">
        {imageData ? (
          <img
            src={imageData}
            alt="Receipt"
            className="w-full rounded border border-border"
          />
        ) : (
          <div className="w-full h-80 rounded border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/50">
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
                      {item.unit_price !== undefined ? `$${item.unit_price.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-1.5 text-right font-medium">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(detail.tax !== undefined || detail.tip !== undefined) && (
              <div className="mt-3 pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                {detail.tax !== undefined && (
                  <div className="flex justify-between"><span>Tax</span><span>${detail.tax.toFixed(2)}</span></div>
                )}
                {detail.tip !== undefined && (
                  <div className="flex justify-between"><span>Tip</span><span>${detail.tip.toFixed(2)}</span></div>
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

export function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const rows = (await window.api.getReceipts()) as ReceiptRow[]
      setReceipts(rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')))
    } catch (e) {
      setError((e as Error).message)
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

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Receipts</h2>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="flex gap-6 mb-4 text-sm">
          <span className="text-muted-foreground">{total} receipt{total !== 1 ? 's' : ''}</span>
          <span className="text-blue-400">{linked} linked</span>
          <span className="text-muted-foreground">{total - linked} unlinked</span>
          <span className={ocrPct === 100 ? 'text-green-400' : ocrPct > 0 ? 'text-yellow-400' : 'text-muted-foreground'}>
            {ocrPct}% OCR success
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-500/10 text-red-400 text-sm">{error}</div>
      )}

      {/* Empty state */}
      {!isLoading && total === 0 && (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
          <div className="text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No receipts yet</p>
            <p className="text-sm mt-1">Import receipts via the Import page to get started</p>
          </div>
        </div>
      )}

      {/* Table */}
      {total > 0 && (
        <div className="flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-secondary-foreground border-b border-border">
              <tr>
                <th className="w-6 p-3" />
                <th className="w-16 p-3" /> {/* thumbnail column */}
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Merchant</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">OCR</th>
                <th className="text-left p-3 font-medium">Status</th>
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
                      {r.total !== undefined ? `$${r.total.toFixed(2)}` : '—'}
                    </td>
                    <td className="p-3"><OcrBadge status={r.ocr_status} /></td>
                    <td className="p-3"><LinkedBadge linked={r.linked} /></td>
                  </tr>
                  {expanded === r.receipt_id && (
                    <tr key={`${r.receipt_id}-detail`} className="border-b border-border">
                      <td colSpan={7} className="p-0">
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
    </div>
  )
}
