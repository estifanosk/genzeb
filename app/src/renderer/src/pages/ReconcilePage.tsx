import { useEffect, useState } from 'react'
import { ArrowLeftRight, RefreshCw, Link2, Unlink, CheckCircle2, ImageOff } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { PageHeader, PageShell } from '../components/ui/page'
import { EmptyState, InlineAlert, LoadingState } from '../components/ui/state'
import { fmtCurrency, amountClass, fmtDate } from '../lib/utils'
import type { ReceiptIndexRow } from '@core/types'
import type { TransactionCandidate } from '@core/types/ipc'

type ReceiptRow = ReceiptIndexRow & { linked: boolean }

function ReceiptThumb({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined)
  useEffect(() => { window.api.getReceiptPreview(filePath).then(setSrc) }, [filePath])
  if (src === undefined) return <div className="w-10 h-14 rounded bg-muted animate-pulse shrink-0" />
  if (!src) return (
    <div className="w-10 h-14 rounded border border-border bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0">
      <ImageOff className="h-3.5 w-3.5" />
    </div>
  )
  return <img src={src} alt="" className="w-10 h-14 object-cover rounded border border-border shrink-0" />
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const variant = pct >= 85 ? 'success' : pct >= 60 ? 'warning' : 'default'
  return <Badge variant={variant}>{pct}% match</Badge>
}

export function ReconcilePage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [selected, setSelected] = useState<ReceiptRow | null>(null)
  const [candidates, setCandidates] = useState<TransactionCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const selectReceipt = async (r: ReceiptRow) => {
    setSelected(r)
    setCandidates([])
    if (r.linked) return
    setIsCandidatesLoading(true)
    try {
      const c = await window.api.getCandidatesForReceipt(r.receipt_id)
      setCandidates(c)
    } finally {
      setIsCandidatesLoading(false)
    }
  }

  const handleLink = async (txId: string) => {
    if (!selected) return
    setLinking(txId)
    try {
      await window.api.linkReceipt({ transactionId: txId, receiptId: selected.receipt_id })
      await load()
      setSelected(null)
      setCandidates([])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLinking(null)
    }
  }

  const handleUnlink = async (receipt: ReceiptRow) => {
    setUnlinking(receipt.receipt_id)
    try {
      // Find the linked transaction via links
      const links = await window.api.getLinks()
      const link = links.find((l) => l.receipt_id === receipt.receipt_id)
      if (link) {
        await window.api.unlinkReceipt(link.transaction_id, receipt.receipt_id)
      }
      await load()
      if (selected?.receipt_id === receipt.receipt_id) {
        setSelected(null)
        setCandidates([])
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUnlinking(null)
    }
  }

  const unlinked = receipts.filter((r) => !r.linked)
  const linked = receipts.filter((r) => r.linked)

  return (
    <PageShell>
      <PageHeader
        title="Reconcile"
        description="Match unlinked receipts to likely transactions."
        meta={!isLoading && (
          <>
            <Badge variant="warning">{unlinked.length} unlinked</Badge>
            <Badge variant="success">{linked.length} linked</Badge>
          </>
        )}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}

      {isLoading ? (
        <LoadingState label="Loading receipts..." />
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="No receipts yet"
          description="Import receipts to start reconciling."
          action={onNavigate && <Button size="sm" onClick={() => onNavigate('import')}>Import a receipt</Button>}
        />
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: receipt list */}
          <div className="w-72 shrink-0 flex flex-col border rounded-lg overflow-hidden bg-card">
            <div className="overflow-y-auto flex-1">
              {unlinked.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted border-b border-border sticky top-0">
                    Unlinked ({unlinked.length})
                  </p>
                  {unlinked.map((r) => (
                    <button
                      key={r.receipt_id}
                      onClick={() => selectReceipt(r)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-border text-left transition-colors ${
                        selected?.receipt_id === r.receipt_id
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <ReceiptThumb filePath={r.file_path} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.merchant ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.total !== undefined ? fmtCurrency(r.total) : '—'}
                          {r.date ? ` · ${fmtDate(r.date)}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {linked.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted border-b border-border sticky top-0">
                    Linked ({linked.length})
                  </p>
                  {linked.map((r) => (
                    <button
                      key={r.receipt_id}
                      onClick={() => selectReceipt(r)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-border text-left transition-colors ${
                        selected?.receipt_id === r.receipt_id
                          ? 'bg-primary/10 border-l-2 border-l-primary'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      <ReceiptThumb filePath={r.file_path} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.merchant ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.total !== undefined ? fmtCurrency(r.total) : '—'}
                          {r.date ? ` · ${fmtDate(r.date)}` : ''}
                        </p>
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Right: detail + candidates */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Select a receipt to see match candidates</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5">
                {/* Receipt header */}
                <div className="flex items-start gap-4 mb-6 pb-5 border-b border-border">
                  <ReceiptThumb filePath={selected.file_path} />
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold">{selected.merchant ?? 'Unknown merchant'}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selected.total !== undefined ? fmtCurrency(selected.total) : 'No amount'}
                      {selected.date ? ` · ${fmtDate(selected.date)}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {selected.linked
                        ? <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Linked</Badge>
                        : <Badge variant="warning"><Link2 className="h-3 w-3" /> Unlinked</Badge>
                      }
                    </div>
                  </div>
                  {selected.linked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlink(selected)}
                      disabled={unlinking === selected.receipt_id}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1.5" />
                      {unlinking === selected.receipt_id ? 'Unlinking…' : 'Unlink'}
                    </Button>
                  )}
                </div>

                {/* Candidates */}
                {!selected.linked && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      {isCandidatesLoading ? 'Finding matches…' : candidates.length > 0 ? `Top matches` : 'No close matches found'}
                    </p>

                    {isCandidatesLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : candidates.length > 0 ? (
                      <div className="space-y-2">
                        {candidates.slice(0, 5).map((c) => (
                          <div
                            key={c.transaction.id}
                            className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {c.transaction.merchant || c.transaction.description || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {fmtDate(c.transaction.date)}
                                {' · '}
                                {c.transaction.account}
                                {' · '}
                                <span className={amountClass(c.transaction.amount)}>
                                  {fmtCurrency(c.transaction.amount)}
                                </span>
                              </p>
                            </div>
                            <ScoreBadge score={c.score} />
                            <Button
                              size="sm"
                              onClick={() => handleLink(c.transaction.id)}
                              disabled={!!linking}
                            >
                              {linking === c.transaction.id ? 'Linking…' : 'Link'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No transactions found within 7 days and $2 of this receipt.
                        The receipt may have a missing date or amount — check the Receipts page to run OCR first.
                      </p>
                    )}
                  </>
                )}

                {selected.linked && (
                  <p className="text-sm text-muted-foreground">
                    This receipt is already linked to a transaction. Use "Unlink" above to remove the association.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
