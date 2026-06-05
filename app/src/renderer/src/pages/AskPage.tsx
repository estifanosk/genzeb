import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useSettingsStore } from '../stores/settings'
import type { ExportFilters } from '@core/types'
import ReactMarkdown from 'react-markdown'

interface Turn {
  question: string
  answer: string
  rowsSent: number
  totalRows: number
  provider: 'openai' | 'anthropic'
}

const MAX_ROWS = 500

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

    try {
      const [answer, csv] = await Promise.all([
        window.api.askLlm({ prompt: q, filters, provider }),
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Ask AI</h2>
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
            <div className="mt-2 flex gap-4 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">From</label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">To</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="border rounded-md px-2 py-1 text-sm bg-background"
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
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Set a data folder in Settings to get started.</p>
          </div>
        ) : noKey ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Add an OpenAI or Anthropic API key in <strong>Settings → API Keys</strong> to use Ask AI.</p>
          </div>
        ) : turns.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Ask anything about your transactions</p>
            <div className="mt-4 space-y-1.5 text-xs text-center opacity-70">
              {['How much did I spend on food last month?',
                'What are my top 5 spending categories?',
                'Any unusual transactions over $200?'].map(s => (
                <p key={s} className="cursor-pointer hover:opacity-100 hover:text-foreground transition-colors"
                   onClick={() => setQuestion(s)}>
                  "{s}"
                </p>
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
                  <div className="max-w-[85%] space-y-2">
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{turn.answer}</ReactMarkdown>
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
                      <pre className="text-[10px] bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-48 text-muted-foreground ml-1">
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
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 pb-6 pt-3 border-t shrink-0">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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
