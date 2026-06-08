import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState, InlineAlert } from '../components/ui/state'
import { useSettingsStore } from '../stores/settings'
import type { ExportFilters } from '@core/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Turn {
  question: string
  answer: string
  rowsSent: number
  totalRows: number
  provider: 'openai' | 'anthropic'
}

const MAX_ROWS = 500

const markdownComponents = {
  table: ({ children }: React.ComponentProps<'table'>) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-md border">
      <table className="w-full min-w-max border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: React.ComponentProps<'thead'>) => (
    <thead className="bg-muted text-muted-foreground">{children}</thead>
  ),
  th: ({ children }: React.ComponentProps<'th'>) => (
    <th className="border-b border-r px-3 py-2 text-left font-semibold last:border-r-0">{children}</th>
  ),
  td: ({ children }: React.ComponentProps<'td'>) => (
    <td className="border-b border-r px-3 py-2 align-top last:border-r-0">{children}</td>
  ),
  tr: ({ children }: React.ComponentProps<'tr'>) => (
    <tr className="last:[&_td]:border-b-0">{children}</tr>
  ),
  p: ({ children }: React.ComponentProps<'p'>) => (
    <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: React.ComponentProps<'ul'>) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: React.ComponentProps<'ol'>) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  code: ({ children }: React.ComponentProps<'code'>) => (
    <code className="rounded border bg-muted px-1 py-0.5 text-[0.9em]">{children}</code>
  ),
  pre: ({ children }: React.ComponentProps<'pre'>) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-md border bg-muted p-3 text-xs">{children}</pre>
  )
}

export function AskPage() {
  const { settings } = useSettingsStore()
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [expandedData, setExpandedData] = useState<number | null>(null)
  const [exportedCsv, setExportedCsv] = useState<Record<number, string>>({})

  // Scope filters
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [scopeRowCount, setScopeRowCount] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)

  const hasOpenAI = !!settings?.openAiKey
  const hasAnthropic = !!settings?.anthropicKey
  const provider: 'openai' | 'anthropic' = hasAnthropic ? 'anthropic' : 'openai'
  const providerLabel = provider === 'anthropic' ? 'Claude (Anthropic)' : 'GPT-4o mini (OpenAI)'
  const hasKey = hasOpenAI || hasAnthropic

  const filters: ExportFilters = {
    ...(dateStart || dateEnd ? { dateRange: { start: dateStart, end: dateEnd } } : {}),
    limit: MAX_ROWS,
  }

  // Update row count preview when scope changes
  useEffect(() => {
    if (!settings?.dataFolder) return
    setScopeRowCount(null)
    const t = setTimeout(async () => {
      try {
        const res = await window.api.getTransactions({ filters, limit: 1, offset: 0 })
        setScopeRowCount(res.total)
      } catch {
        setScopeRowCount(null)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [dateStart, dateEnd, settings?.dataFolder])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, isLoading])

  const handleAsk = async () => {
    const q = question.trim()
    if (!q || isLoading) return
    setQuestion('')
    setError(null)
    setIsLoading(true)

    const history = turns.flatMap(t => [
      { role: 'user' as const, content: t.question },
      { role: 'assistant' as const, content: t.answer },
    ])

    try {
      const [answer, csv] = await Promise.all([
        window.api.askLlm({ prompt: q, filters, provider, history }),
        window.api.exportForLlm(filters, 'csv'),
      ])
      const rows = csv.split('\n').length - 1 // subtract header
      const turnIndex = turns.length
      setTurns(prev => [...prev, { question: q, answer, rowsSent: Math.min(rows, MAX_ROWS), totalRows: scopeRowCount ?? rows, provider }])
      setExportedCsv(prev => ({ ...prev, [turnIndex]: csv }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const noKey = !hasKey
  const noData = !settings?.dataFolder

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b px-6 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Ask AI</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={hasKey ? 'success' : 'warning'}>{hasKey ? providerLabel : 'No API key'}</Badge>
              <Badge variant="neutral">Up to {MAX_ROWS} rows</Badge>
            </div>
          </div>
          {turns.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setTurns([]); setExportedCsv({}) }}>
              Clear
            </Button>
          )}
        </div>

        {/* Scope bar */}
        <div className="mt-3">
          <button
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setScopeOpen(o => !o)}
          >
            {scopeOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="font-medium uppercase tracking-wide">Data scope</span>
            {scopeRowCount !== null && (
              <span className="ml-1">
                · {scopeRowCount > MAX_ROWS
                  ? <><span className="text-yellow-400">{MAX_ROWS} of {scopeRowCount}</span> rows (capped)</>
                  : <>{scopeRowCount} rows</>}
              </span>
            )}
          </button>

          {scopeOpen && (
            <div className="mt-2 flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                />
              </div>
              {(dateStart || dateEnd) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateStart(''); setDateEnd('') }}>
                  Clear dates
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {noData ? (
          <EmptyState icon={MessageSquare} title="No data folder selected" description="Set a data folder in Settings to get started." className="h-full border-0" />
        ) : noKey ? (
          <EmptyState icon={MessageSquare} title="Ask AI needs an API key" description="Add an OpenAI or Anthropic API key in Settings to use this page." className="h-full border-0" />
        ) : turns.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Ask anything about your transactions</p>
            <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2 text-xs">
              {['How much did I spend on food last month?',
                'What are my top 5 spending categories?',
                'Any unusual transactions over $200?'].map(s => (
                <button key={s} className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                   onClick={() => setQuestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {turns.map((turn, i) => (
              <div key={i} className="space-y-3">
                {/* User bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                    {turn.question}
                  </div>
                </div>

                {/* AI bubble */}
                <div className="flex justify-start">
                  <div className="max-w-[min(920px,85%)] space-y-2">
                    <div className="max-w-full rounded-2xl rounded-tl-sm bg-card px-4 py-3 text-sm shadow-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {turn.answer}
                      </ReactMarkdown>
                    </div>
                    {/* Data disclosure */}
                    <button
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1 transition-colors"
                      onClick={() => setExpandedData(expandedData === i ? null : i)}
                    >
                      {expandedData === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {turn.rowsSent} rows sent · {turn.provider === 'anthropic' ? 'Claude' : 'GPT-4o mini'}
                    </button>
                    {expandedData === i && exportedCsv[i] && (
                      <pre className="ml-1 max-h-48 overflow-x-auto rounded-lg border bg-card p-3 text-[10px] text-muted-foreground">
                        {exportedCsv[i]}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <InlineAlert>{error}</InlineAlert>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t px-6 pb-6 pt-3">
        <div className="flex gap-2">
          <textarea
            rows={1}
            className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            placeholder={noKey ? 'Add an API key in Settings to use Ask AI' : 'Ask a question about your transactions…'}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
            disabled={isLoading || noKey || noData}
          />
          <Button onClick={handleAsk} disabled={!question.trim() || isLoading || noKey || noData} size="sm" className="px-4">
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 ml-1">
          {hasKey
            ? `Using ${providerLabel} · up to ${MAX_ROWS} rows${scopeRowCount !== null ? ` · ${Math.min(scopeRowCount, MAX_ROWS)} in scope` : ''}`
            : 'No API key configured'}
        </p>
      </div>
    </div>
  )
}
