import { useEffect, useState, useCallback } from 'react'
import { FileText, Receipt, RefreshCw, ExternalLink, Eye, Sparkles, History } from 'lucide-react'
import type { ImportLogRow } from '@core/types'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { useSettingsStore } from '../stores/settings'
import type { InboxScanResult, InboxPaths, CsvPreview, CsvMappingInfo, CsvStats, ReceiptMatchPreview, IngestReceiptsResponse, ReceiptMatchMetadata } from '@core/types/ipc'
import type { ReceiptDetail, CategoryRule } from '@core/types'

function parseAccountFromFilename(filePath: string): {
  accountNumber?: string
  accountType?: string
  bankName?: string
  period?: string
} {
  const name = filePath.split('/').pop() || filePath
  const withoutExt = name.replace(/\.[^/.]+$/, '')
  const parts = withoutExt
    .split('_')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 3) return {}

  return {
    accountNumber: parts[0] || undefined,
    accountType: parts[1] || undefined,
    bankName: parts[2] || undefined,
    period: parts.slice(3).join('_') || undefined
  }
}

type Step = 'select' | 'preview' | 'summary'

type TabKey = 'statements' | 'receipts' | 'history'

export function ImportPage() {
  const { settings } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<TabKey>('statements')
  const [importLog, setImportLog] = useState<ImportLogRow[]>([])
  const [isLoadingLog, setIsLoadingLog] = useState(false)
  const [inboxScan, setInboxScan] = useState<InboxScanResult | null>(null)
  const [inboxPaths, setInboxPaths] = useState<InboxPaths | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  // Statements flow state
  const [isImporting, setIsImporting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [mapping, setMapping] = useState<CsvMappingInfo | null>(null)
  const [stats, setStats] = useState<CsvStats | null>(null)
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [summary, setSummary] = useState<{
    imported: number
    skipped: number
    duplicates: number
    dateMin?: string
    dateMax?: string
    accountNumber?: string
    accountType?: string
    bankName?: string
    period?: string
  } | null>(null)

  // Receipts flow state
  const [receiptStep, setReceiptStep] = useState<Step>('select')
  const [receiptSelectedFile, setReceiptSelectedFile] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<ReceiptMatchPreview | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [isReceiptLoading, setIsReceiptLoading] = useState(false)
  const [receiptSummary, setReceiptSummary] = useState<IngestReceiptsResponse | null>(null)
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null)
  const [receiptLlmResult, setReceiptLlmResult] = useState<ReceiptDetail | null>(null)
  const [isLlmLoading, setIsLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)

  const loadImportLog = useCallback(async () => {
    setIsLoadingLog(true)
    try {
      const log = await window.api.getImportLog()
      setImportLog(log)
    } finally {
      setIsLoadingLog(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'history') loadImportLog()
  }, [activeTab, loadImportLog])

  const scanInbox = useCallback(
    async (resetFlow = true) => {
      if (!settings?.dataFolder) return
      setIsScanning(true)
      try {
        const result = await window.api.scanInbox()
        setInboxScan(result)

        if (resetFlow) {
          // Reset statements
          setSelectedFile(null)
          setPreviewFile(null)
          setPreview(null)
          setMapping(null)
          setStats(null)
          setPreviewError(null)
          setStep('select')
          setSummary(null)

          // Reset receipts
          setReceiptSelectedFile(null)
          setReceiptPreview(null)
          setReceiptError(null)
          setReceiptStep('select')
          setReceiptSummary(null)
          setReceiptImageData(null)
          setReceiptLlmResult(null)
          setLlmError(null)
        }
      } finally {
        setIsScanning(false)
      }
    },
    [settings?.dataFolder]
  )

  // Load inbox paths and scan on mount
  useEffect(() => {
    if (settings?.dataFolder) {
      window.api.getInboxPaths().then(setInboxPaths)
      scanInbox()
      window.api.getRules().then(setRules)
    }
  }, [settings?.dataFolder, scanInbox])

  const getSuggestionForRow = (row: Record<string, string>) => {
    if (!mapping) return null
    const merchantKey = mapping.mapping.merchant || ''
    const descriptionKey = mapping.mapping.description || ''
    const merchant = (merchantKey ? row[merchantKey] : '') || ''
    const description = (descriptionKey ? row[descriptionKey] : '') || ''
    const merchantLower = merchant.toLowerCase()
    const descriptionLower = description.toLowerCase()
    const ordered = [...rules].filter((rule) => rule.enabled && rule.match_value).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    const matched = ordered.find((rule) => {
      const needle = rule.match_value.toLowerCase()
      if (rule.match_type === 'merchant_contains') {
        return merchantLower.includes(needle)
      }
      if (rule.match_type === 'description_contains') {
        return descriptionLower.includes(needle)
      }
      if (rule.match_type === 'merchant_or_description_contains') {
        return merchantLower.includes(needle) || descriptionLower.includes(needle)
      }
      if (rule.match_type === 'merchant_regex') {
        try {
          return new RegExp(rule.match_value, 'i').test(merchant)
        } catch {
          return false
        }
      }
      return false
    })
    if (!matched) return null
    return {
      category: matched.category,
      subcategory: matched.subcategory
    }
  }

  const openFolder = async (path: string) => {
    await window.api.openFolder(path)
  }

  const loadPreview = async (path: string) => {
    setIsPreviewLoading(true)
    setPreviewFile(path)
    setPreviewError(null)
    try {
      const [result, mappingInfo, statsInfo] = await Promise.all([window.api.getCsvPreview(path, 12), window.api.getCsvMapping(path), window.api.getCsvStats(path)])
      setPreview(result)
      setMapping(mappingInfo)
      setStats(statsInfo)
    } catch (err) {
      setPreview(null)
      setMapping(null)
      setStats(null)
      setPreviewError((err as Error).message || 'Failed to load preview')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const onNext = async () => {
    if (!selectedFile) return
    await loadPreview(selectedFile)
    setStep('preview')
  }

  const onBack = () => {
    setStep('select')
  }

  const onImport = async () => {
    if (!selectedFile || !settings?.dataFolder) return
    setIsImporting(true)
    try {
      const results = await window.api.importStatements({
        paths: [selectedFile],
        account: settings.defaultAccount || 'Default'
      })
      const imported = results.reduce((sum, r) => sum + r.rows_imported, 0)
      const skipped = results.reduce((sum, r) => sum + r.rows_skipped, 0)
      const duplicates = results.reduce((sum, r) => sum + r.duplicates.length, 0)
      const account = parseAccountFromFilename(selectedFile)
      setSummary({
        imported,
        skipped,
        duplicates,
        dateMin: stats?.dateMin,
        dateMax: stats?.dateMax,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        bankName: account.bankName,
        period: account.period
      })
      setStep('summary')
      await scanInbox(false)
    } catch (err) {
      setPreviewError((err as Error).message)
    } finally {
      setIsImporting(false)
    }
  }

  const loadReceiptPreview = async (path: string) => {
    setIsReceiptLoading(true)
    setReceiptError(null)
    setReceiptPreview(null)
    setReceiptLlmResult(null)
    setLlmError(null)
    try {
      const imageData = await window.api.getReceiptPreview(path)
      setReceiptImageData(imageData)
    } catch (err) {
      setReceiptImageData(null)
    } finally {
      setIsReceiptLoading(false)
    }
  }

  const onReceiptNext = async () => {
    if (!receiptSelectedFile) return
    await loadReceiptPreview(receiptSelectedFile)
    setReceiptStep('preview')
  }

  const onReceiptBack = () => {
    setReceiptStep('select')
  }

  const onReceiptImport = async (mode: 'link' | 'unmatched') => {
    if (!receiptSelectedFile || !settings?.dataFolder) return
    setIsReceiptLoading(true)
    setReceiptError(null)
    try {
      const result = await window.api.ingestReceipts({
        paths: [receiptSelectedFile],
        mode,
        dayWindow: 3,
        tolerance: 1,
        matchTransactionId: mode === 'link' && receiptPreview?.matches.length ? receiptPreview.matches[0].transactionId : undefined,
        matchMetadata: receiptLlmResult
          ? {
              date: receiptLlmResult.date ?? undefined,
              amount: receiptLlmResult.total ?? undefined,
              merchant: receiptLlmResult.merchant ?? undefined
            }
          : undefined
      })
      if (receiptLlmResult && result.receipts.length > 0) {
        await window.api.saveReceiptDetail(result.receipts[0].receipt_id, receiptLlmResult)
      }
      await window.api.materialize()
      setReceiptSummary(result)
      setReceiptStep('summary')
      await scanInbox(false)
    } catch (err) {
      setReceiptError((err as Error).message || 'Failed to import receipt')
    } finally {
      setIsReceiptLoading(false)
    }
  }

  const runReceiptLlm = async () => {
    if (!receiptSelectedFile) return
    setIsLlmLoading(true)
    setReceiptError(null)
    setLlmError(null)
    try {
      const result = await window.api.runReceiptLlm(receiptSelectedFile)
      setReceiptLlmResult(result)
      const metadata: ReceiptMatchMetadata = {
        date: result.date ?? undefined,
        amount: result.total ?? undefined,
        merchant: result.merchant ?? undefined
      }
      const matchPreview = await window.api.getReceiptMatchPreviewData(metadata, 3, 1)
      setReceiptPreview(matchPreview)
    } catch (err) {
      setLlmError((err as Error).message || 'Failed to run LLM extraction')
    } finally {
      setIsLlmLoading(false)
    }
  }

  if (!settings?.dataFolder) {
    return (
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Import</h2>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Please select a data folder in Settings first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Import</h2>
        <Button onClick={() => scanInbox()} variant="outline" size="sm" disabled={isScanning}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="statements">Statements</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statements">
          {step === 'select' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Statements
                </CardTitle>
                <CardDescription>Bank and credit card statements (CSV, PDF)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Pending files</span>
                  <span className="text-2xl font-bold">{inboxScan?.statements.length ?? 0}</span>
                </div>

                {inboxScan && inboxScan.statements.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {inboxScan.statements.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-xs">
                        <input type="radio" checked={selectedFile === file} onChange={() => setSelectedFile(file)} />
                        <button className="truncate text-left flex-1 hover:underline" onClick={() => setSelectedFile(file)} title="Select">
                          {file.split('/').pop()}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSelectedFile(file)
                            loadPreview(file)
                          }}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={onNext} disabled={!selectedFile}>
                    Next
                  </Button>
                  {inboxPaths && (
                    <Button variant="outline" size="icon" onClick={() => openFolder(inboxPaths.statements)} title="Open folder">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-center">Select one file to continue</div>
              </CardContent>
            </Card>
          )}

          {step === 'preview' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview: {previewFile?.split('/').pop()}
                </CardTitle>
                <CardDescription>Review mapping and data before import</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mapping && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium mb-2">Mapped columns</div>
                      <ul className="space-y-1 text-xs">
                        <li>Date → {mapping.mapping.date || '—'}</li>
                        <li>Post date → {mapping.mapping.post_date || '—'}</li>
                        <li>Amount → {mapping.mapping.amount || '—'}</li>
                        <li>Debit → {mapping.mapping.debit || '—'}</li>
                        <li>Credit → {mapping.mapping.credit || '—'}</li>
                        <li>Description → {mapping.mapping.description || '—'}</li>
                        <li>Merchant → {mapping.mapping.merchant || '—'}</li>
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-2">Ignored columns</div>
                      {mapping.ignoredHeaders.length > 0 ? <div className="text-xs text-muted-foreground">{mapping.ignoredHeaders.join(', ')}</div> : <div className="text-xs text-muted-foreground">None</div>}
                    </div>
                  </div>
                )}

                {stats && (
                  <div className="text-xs text-muted-foreground">
                    Rows detected: {stats.rowCount}
                    {stats.dateMin && stats.dateMax && (
                      <span>
                        {' '}
                        • Date range: {stats.dateMin} to {stats.dateMax}
                      </span>
                    )}
                  </div>
                )}

                {isPreviewLoading ? (
                  <div className="text-sm text-muted-foreground">Loading preview...</div>
                ) : preview && preview.headers.length > 0 ? (
                  <div className="overflow-auto max-h-96">
                    <table className="w-full text-xs border">
                      <thead className="bg-muted">
                        <tr>
                          {preview.headers.map((h) => (
                            <th key={h} className="text-left p-2 border-b">
                              {h}
                            </th>
                          ))}
                          <th className="text-left p-2 border-b">Suggested category</th>
                          <th className="text-left p-2 border-b">Suggested subcategory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            {preview.headers.map((h) => (
                              <td key={h} className="p-2 whitespace-nowrap">
                                {row[h] ?? ''}
                              </td>
                            ))}
                            {(() => {
                              const suggestion = getSuggestionForRow(row)
                              return (
                                <>
                                  <td className="p-2 whitespace-nowrap">{suggestion?.category || '—'}</td>
                                  <td className="p-2 whitespace-nowrap">{suggestion?.subcategory || '—'}</td>
                                </>
                              )
                            })()}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : previewError ? (
                  <div className="text-sm text-muted-foreground">{previewError}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">No preview available.</div>
                )}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={onBack}>
                    Back
                  </Button>
                  <Button onClick={onImport} disabled={isImporting || !selectedFile}>
                    {isImporting ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'summary' && summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Summary</CardTitle>
                <CardDescription>Import completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Imported rows: {summary.imported}</div>
                <div>Skipped rows: {summary.skipped}</div>
                <div>Duplicate files: {summary.duplicates}</div>
                {summary.dateMin && summary.dateMax && (
                  <div>
                    Date range: {summary.dateMin} to {summary.dateMax}
                  </div>
                )}
                {summary.bankName && <div>Bank: {summary.bankName}</div>}
                {summary.accountType && <div>Account type: {summary.accountType}</div>}
                {summary.accountNumber && <div>Account number: {summary.accountNumber}</div>}
                {summary.period && <div>Period: {summary.period}</div>}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep('select')}>
                    Import Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receipts">
          {receiptStep === 'select' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Receipts
                </CardTitle>
                <CardDescription>Receipt images and documents (PNG, JPG, PDF, HTML)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Pending files</span>
                  <span className="text-2xl font-bold">{inboxScan?.receipts.length ?? 0}</span>
                </div>

                {inboxScan && inboxScan.receipts.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {inboxScan.receipts.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={receiptSelectedFile === file}
                          onChange={() => {
                            setReceiptSelectedFile(file)
                            setReceiptPreview(null)
                            setReceiptLlmResult(null)
                            setLlmError(null)
                          }}
                        />
                        <button
                          className="truncate text-left flex-1 hover:underline"
                          onClick={() => {
                            setReceiptSelectedFile(file)
                            setReceiptPreview(null)
                            setReceiptLlmResult(null)
                            setLlmError(null)
                          }}
                          title="Select"
                        >
                          {file.split('/').pop()}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setReceiptSelectedFile(file)
                            setReceiptPreview(null)
                            setReceiptLlmResult(null)
                            setLlmError(null)
                            loadReceiptPreview(file)
                          }}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={onReceiptNext} disabled={!receiptSelectedFile}>
                    Next
                  </Button>
                  {inboxPaths && (
                    <Button variant="outline" size="icon" onClick={() => openFolder(inboxPaths.receipts)} title="Open folder">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-center">Select one receipt to continue</div>
              </CardContent>
            </Card>
          )}

          {receiptStep === 'preview' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Receipt Preview
                </CardTitle>
                <CardDescription>Run extraction to check matches before import</CardDescription>
              </CardHeader>
              <CardContent>
                {receiptError && <div className="mb-4 text-sm text-destructive border border-destructive/40 rounded-md p-3">{receiptError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Image preview</div>
                    {receiptImageData ? <div className="border rounded max-h-[70vh] overflow-auto">{receiptImageData.startsWith('data:application/pdf') ? <embed src={receiptImageData} type="application/pdf" className="w-full h-[70vh]" /> : <img src={receiptImageData} alt="Receipt" className="w-full" />}</div> : <div className="text-xs text-muted-foreground border rounded p-3">No preview available for this file</div>}
                  </div>
                  <div className="space-y-4">
                    {receiptPreview ? (
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Detected date:</span> {receiptPreview.metadata.date || '—'}
                        </div>
                        <div>
                          <span className="font-medium">Detected amount:</span> {receiptPreview.metadata.amount ?? '—'}
                        </div>
                        <div>
                          <span className="font-medium">Detected merchant:</span> {receiptPreview.metadata.merchant || '—'}
                        </div>
                        {!receiptPreview.hasTransactions && <div className="text-destructive">No statements found. Importing will add receipts as unmatched.</div>}
                        {receiptPreview.hasTransactions && receiptPreview.matches.length === 0 && <div className="text-destructive">No matching transactions found within ±3 days and $1 tolerance.</div>}
                        {receiptPreview.matches.length > 0 && (
                          <div>
                            <div className="font-medium">Potential matches:</div>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {receiptPreview.matches.slice(0, 3).map((m) => (
                                <li key={m.transactionId}>
                                  {m.date} • {m.amount.toFixed(2)} • {m.merchant}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Run extraction to check matches.</div>
                    )}

                    <div className="border rounded-md p-3 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">LLM Extraction</span>
                        <Button variant="outline" size="sm" onClick={runReceiptLlm} disabled={isLlmLoading || !settings?.openAiKey}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          {isLlmLoading ? 'Running...' : 'Run Extract'}
                        </Button>
                      </div>
                      {!settings?.openAiKey && <div className="text-muted-foreground">Add your OpenAI API key in Settings to enable extraction.</div>}
                      {receiptLlmResult && (
                        <div className="space-y-1">
                          <div>Merchant: {receiptLlmResult.merchant ?? '—'}</div>
                          <div>Date: {receiptLlmResult.date ?? '—'}</div>
                          <div>Total: {receiptLlmResult.total ?? '—'}</div>
                          <div>Currency: {receiptLlmResult.currency ?? '—'}</div>
                          <div>Tax: {receiptLlmResult.tax ?? '—'}</div>
                          <div>Tip: {receiptLlmResult.tip ?? '—'}</div>
                          <div>Line items: {receiptLlmResult.line_items?.length ?? 0}</div>
                          <div>Confidence: {receiptLlmResult.confidence ?? '—'}</div>
                          {receiptLlmResult.line_items?.length ? (
                            <div className="mt-2">
                              <div className="font-medium mb-1">Line Items</div>
                              <div className="max-h-48 overflow-auto border rounded">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted">
                                    <tr>
                                      <th className="text-left p-2">Description</th>
                                      <th className="text-right p-2">Qty</th>
                                      <th className="text-right p-2">Unit</th>
                                      <th className="text-right p-2">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {receiptLlmResult.line_items.map((item, idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="p-2">{item.description}</td>
                                        <td className="p-2 text-right">{item.quantity ?? '—'}</td>
                                        <td className="p-2 text-right">{item.unit_price ?? '—'}</td>
                                        <td className="p-2 text-right">{item.total}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {llmError && <div className="text-destructive">{llmError}</div>}
                    </div>

                    <div className="flex justify-between gap-2">
                      <Button variant="outline" onClick={onReceiptBack}>
                        Back
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onReceiptImport('unmatched')} disabled={isReceiptLoading || !receiptSelectedFile}>
                          Import Unmatched
                        </Button>
                        <Button onClick={() => onReceiptImport('link')} disabled={isReceiptLoading || !receiptSelectedFile || !receiptPreview?.hasTransactions || (receiptPreview?.matches.length ?? 0) === 0}>
                          Import & Link
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {receiptStep === 'summary' && receiptSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Import Summary</CardTitle>
                <CardDescription>Import completed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>Imported receipts: {receiptSummary.receipts.length}</div>
                <div>Linked receipts: {receiptSummary.linked}</div>
                <div>Unmatched receipts: {receiptSummary.unmatched}</div>
                <div>Linked to transaction: {receiptSummary.linked > 0 ? 'Yes' : 'No'}</div>
                {receiptSummary.receipts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="font-medium">Receipt details</div>
                    {receiptSummary.receipts.map((receipt) => (
                      <div key={receipt.receipt_id} className="border rounded-md p-3 space-y-1">
                        <div>Receipt ID: {receipt.receipt_id}</div>
                        {receipt.merchant && <div>Merchant: {receipt.merchant}</div>}
                        {receipt.date && <div>Date: {receipt.date}</div>}
                        {receipt.total !== undefined && <div>Total: {receipt.total}</div>}
                        {receiptLlmResult?.line_items?.length ? (
                          <div>
                            <div className="font-medium mt-2">Line items ({receiptLlmResult.line_items.length})</div>
                            <div className="max-h-48 overflow-auto border rounded">
                              <table className="w-full text-xs">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="text-left p-2">Description</th>
                                    <th className="text-right p-2">Qty</th>
                                    <th className="text-right p-2">Unit</th>
                                    <th className="text-right p-2">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {receiptLlmResult.line_items.map((item, idx) => (
                                    <tr key={idx} className="border-t">
                                      <td className="p-2">{item.description}</td>
                                      <td className="p-2 text-right">{item.quantity ?? '—'}</td>
                                      <td className="p-2 text-right">{item.unit_price ?? '—'}</td>
                                      <td className="p-2 text-right">{item.total}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No line items extracted.</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setReceiptStep('select')}>
                    Import Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Import History
                  </CardTitle>
                  <CardDescription>Every statement file that has been imported into this data folder.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadImportLog} disabled={isLoadingLog}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLog ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLog && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {!isLoadingLog && importLog.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No imports yet. Import a CSV statement to get started.</p>}
              {!isLoadingLog && importLog.length > 0 && (
                <div className="overflow-auto rounded border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground border-b border-border">
                      <tr>
                        <th className="text-left p-3 font-medium">File</th>
                        <th className="text-left p-3 font-medium">Imported</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-right p-3 font-medium">Rows imported</th>
                        <th className="text-right p-3 font-medium">Skipped</th>
                        <th className="text-left p-3 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importLog.map((row) => (
                        <tr key={row.import_id} className="border-t border-border hover:bg-accent/40">
                          <td className="p-3 font-medium truncate max-w-xs" title={row.source_file}>
                            {row.source_file}
                          </td>
                          <td className="p-3 whitespace-nowrap text-muted-foreground">
                            {new Date(row.imported_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-3 uppercase text-xs text-muted-foreground">{row.file_type}</td>
                          <td className="p-3 text-right">{row.rows_imported}</td>
                          <td className="p-3 text-right">{row.rows_skipped > 0 ? <span className="text-amber-400">{row.rows_skipped}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3 text-muted-foreground">{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
