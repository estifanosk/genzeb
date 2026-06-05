import { useEffect, useMemo, useState } from 'react'
import { Folder, RefreshCw, FolderOpen, FileText, Receipt, Trash2, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { useSettingsStore } from '../stores/settings'
import type { InboxPaths, CategorizeTransactionsResponse } from '@core/types/ipc'
import type { CategoryItem, CategoryRule, TransactionRow } from '@core/types'

export function SettingsPage() {
  const { settings, isLoading, error, loadSettings, selectDataFolder, updateSettings } =
    useSettingsStore()
  const [openAiKey, setOpenAiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [inboxPaths, setInboxPaths] = useState<InboxPaths | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [rules, setRules] = useState<CategoryRule[]>([])
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [isSavingCategories, setIsSavingCategories] = useState(false)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [llmSuggestions, setLlmSuggestions] = useState<CategorizeTransactionsResponse['suggestions']>([])
  const [llmError, setLlmError] = useState<string | null>(null)
  const [isLlmRunning, setIsLlmRunning] = useState(false)
  const [autoCreateRules, setAutoCreateRules] = useState(true)
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set())
  const [llmTransactionMap, setLlmTransactionMap] = useState<Map<string, TransactionRow>>(new Map())

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Load inbox paths when settings change
  useEffect(() => {
    if (settings?.dataFolder) {
      window.api.getInboxPaths().then(setInboxPaths)
      window.api.getCategories().then((res) => setCategories(res.categories))
      window.api.getRules().then(setRules)
    }
    if (settings?.openAiKey !== undefined) setOpenAiKey(settings.openAiKey || '')
    if (settings?.anthropicKey !== undefined) setAnthropicKey(settings.anthropicKey || '')
  }, [settings?.dataFolder, settings?.openAiKey, settings?.anthropicKey])

  const openFolder = async (path: string) => {
    await window.api.openFolder(path)
  }

  const categoriesByParent = useMemo(() => {
    const map = new Map<string, string[]>()
    categories.forEach((item) => {
      const list = map.get(item.category) || []
      if (item.subcategory) list.push(item.subcategory)
      map.set(item.category, list)
    })
    return map
  }, [categories])

  const saveCategories = async () => {
    setIsSavingCategories(true)
    setCategoryError(null)
    try {
      await window.api.saveCategories(categories.filter((c) => c.category.trim()))
    } catch (err) {
      setCategoryError((err as Error).message || 'Failed to save categories')
    } finally {
      setIsSavingCategories(false)
    }
  }

  const saveRules = async () => {
    setIsSavingRules(true)
    setRulesError(null)
    try {
      for (const rule of rules) {
        if (!rule.match_value || !rule.category) continue
        await window.api.saveRule(rule)
      }
    } catch (err) {
      setRulesError((err as Error).message || 'Failed to save rules')
    } finally {
      setIsSavingRules(false)
    }
  }

  const applyRules = async () => {
    await window.api.materialize()
  }

  const runLlmCategorization = async () => {
    setIsLlmRunning(true)
    setLlmError(null)
    try {
      const res = await window.api.getTransactions({
        filters: { uncategorized: true },
        limit: 500,
        offset: 0,
        sortBy: 'date',
        sortOrder: 'desc'
      })
      setLlmTransactionMap(new Map(res.transactions.map((tx) => [tx.id, tx])))
      const txs = res.transactions.map((tx) => ({
        id: tx.id,
        merchant: tx.merchant,
        description: tx.description,
        amount: tx.amount,
        date: tx.date
      }))
      const suggestions = await window.api.categorizeTransactions({ transactions: txs })
      setLlmSuggestions(suggestions.suggestions)
      setSelectedSuggestionIds(
        new Set(suggestions.suggestions.filter((s) => s.category).map((s) => s.transaction_id))
      )
    } catch (err) {
      setLlmError((err as Error).message || 'Failed to categorize transactions')
    } finally {
      setIsLlmRunning(false)
    }
  }

  const applyLlmSuggestions = async () => {
    if (llmSuggestions.length === 0) return
    for (const suggestion of llmSuggestions) {
      if (!selectedSuggestionIds.has(suggestion.transaction_id)) continue
      if (!suggestion.category) continue
      await window.api.appendChange({
        transaction_id: suggestion.transaction_id,
        change_type: 'set_category',
        value: suggestion.category
      })
      if (suggestion.subcategory) {
        await window.api.appendChange({
          transaction_id: suggestion.transaction_id,
          change_type: 'set_subcategory',
          value: suggestion.subcategory
        })
      }
      if (autoCreateRules) {
        const tx = llmTransactionMap.get(suggestion.transaction_id)
        if (tx?.merchant) {
          await window.api.saveRule({
            rule_id: '',
            match_type: 'merchant_or_description_contains',
            match_value: tx.merchant,
            category: suggestion.category,
            subcategory: suggestion.subcategory || undefined,
            priority: 100,
            enabled: true
          })
        }
      }
    }
    await window.api.materialize()
    setLlmSuggestions([])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Data Folder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Data Folder
            </CardTitle>
            <CardDescription>
              Choose where your expense data is stored. This folder can be synced with cloud
              services like Dropbox or iCloud for backup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={settings?.dataFolder || ''}
                readOnly
                className="flex-1 bg-muted"
                placeholder="No folder selected"
              />
              <Button onClick={selectDataFolder} variant="outline">
                Browse
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inbox Folders */}
        {settings?.dataFolder && inboxPaths && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Inbox Folders
              </CardTitle>
              <CardDescription>
                Drop files into these folders to import them. Click "Open" to open in Finder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Statements Folder */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Statements (CSV, PDF)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={inboxPaths.statements}
                    readOnly
                    className="flex-1 bg-muted text-xs"
                  />
                  <Button
                    onClick={() => openFolder(inboxPaths.statements)}
                    variant="outline"
                    size="sm"
                  >
                    Open
                  </Button>
                </div>
              </div>

              {/* Receipts Folder */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Receipts (Images, PDF, HTML)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={inboxPaths.receipts}
                    readOnly
                    className="flex-1 bg-muted text-xs"
                  />
                  <Button
                    onClick={() => openFolder(inboxPaths.receipts)}
                    variant="outline"
                    size="sm"
                  >
                    Open
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Categories & Rules</CardTitle>
            <CardDescription>
              Manage category lists and auto-categorization rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories">
              <TabsList>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="llm">LLM Categorize</TabsTrigger>
              </TabsList>

              <TabsContent value="categories">
                <div className="space-y-3 pt-4">
                  {categoryError && (
                    <div className="text-sm text-destructive border border-destructive/40 rounded-md p-3">
                      {categoryError}
                    </div>
                  )}
                  <div className="grid grid-cols-[2fr_2fr_40px] gap-2 text-xs font-medium text-muted-foreground">
                    <div>Category</div>
                    <div>Subcategory</div>
                    <div></div>
                  </div>
                  {categories.map((item, idx) => (
                    <div key={`${item.category}-${item.subcategory}-${idx}`} className="grid grid-cols-[2fr_2fr_40px] gap-2">
                      <Input
                        value={item.category}
                        onChange={(e) => {
                          const next = [...categories]
                          next[idx] = { ...next[idx], category: e.target.value }
                          setCategories(next)
                        }}
                      />
                      <Input
                        value={item.subcategory || ''}
                        onChange={(e) => {
                          const next = [...categories]
                          next[idx] = { ...next[idx], subcategory: e.target.value || undefined }
                          setCategories(next)
                        }}
                      />
                      <button
                        className="text-muted-foreground hover:text-red-600"
                        onClick={() => setCategories(categories.filter((_, i) => i !== idx))}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCategories([...categories, { category: '', subcategory: '' }])}
                    >
                      Add Category
                    </Button>
                    <Button onClick={saveCategories} disabled={isSavingCategories}>
                      {isSavingCategories ? 'Saving...' : 'Save Categories'}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rules">
                <div className="space-y-3 pt-4">
                  {rulesError && (
                    <div className="text-sm text-destructive border border-destructive/40 rounded-md p-3">
                      {rulesError}
                    </div>
                  )}
                  <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_80px_40px] gap-2 text-xs font-medium text-muted-foreground">
                    <div>Match</div>
                    <div>Category</div>
                    <div>Subcategory</div>
                    <div>Type</div>
                    <div>Priority</div>
                    <div></div>
                  </div>
                  {rules.map((rule, idx) => {
                    const subcats = categoriesByParent.get(rule.category) || []
                    return (
                      <div
                        key={rule.rule_id || `rule-${idx}`}
                        className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_80px_40px] gap-2"
                      >
                        <Input
                          value={rule.match_value}
                          onChange={(e) => {
                            const next = [...rules]
                            next[idx] = { ...next[idx], match_value: e.target.value }
                            setRules(next)
                          }}
                          placeholder="e.g. Costco"
                        />
                        <select
                          className="border rounded-md px-2 text-sm h-8"
                          value={rule.category}
                          onChange={(e) => {
                            const next = [...rules]
                            next[idx] = { ...next[idx], category: e.target.value, subcategory: '' }
                            setRules(next)
                          }}
                        >
                          <option value="">Select</option>
                          {Array.from(categoriesByParent.keys()).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <select
                          className="border rounded-md px-2 text-sm h-8"
                          value={rule.subcategory || ''}
                          onChange={(e) => {
                            const next = [...rules]
                            next[idx] = { ...next[idx], subcategory: e.target.value }
                            setRules(next)
                          }}
                        >
                          <option value="">Any</option>
                          {subcats.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        <select
                          className="border rounded-md px-2 text-sm h-8"
                          value={rule.match_type}
                          onChange={(e) => {
                            const next = [...rules]
                            next[idx] = { ...next[idx], match_type: e.target.value as CategoryRule['match_type'] }
                            setRules(next)
                          }}
                        >
                          <option value="merchant_or_description_contains">Merchant or Description</option>
                          <option value="merchant_contains">Merchant only</option>
                          <option value="description_contains">Description only</option>
                        </select>
                        <Input
                          type="number"
                          value={rule.priority}
                          onChange={(e) => {
                            const next = [...rules]
                            next[idx] = { ...next[idx], priority: Number(e.target.value) }
                            setRules(next)
                          }}
                        />
                        <button
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            const id = rules[idx]?.rule_id
                            if (id) window.api.deleteRule(id)
                            setRules(rules.filter((_, i) => i !== idx))
                          }}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRules([
                          ...rules,
                          {
                            rule_id: '',
                            match_type: 'merchant_or_description_contains',
                            match_value: '',
                            category: '',
                            subcategory: '',
                            priority: 100,
                            enabled: true
                          }
                        ])
                      }
                    >
                      Add Rule
                    </Button>
                    <Button onClick={saveRules} disabled={isSavingRules}>
                      {isSavingRules ? 'Saving...' : 'Save Rules'}
                    </Button>
                    <Button variant="outline" onClick={applyRules}>
                      Apply Rules Now
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="llm">
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Sends all uncategorized transactions to OpenAI and suggests categories. Review the suggestions, then apply the ones you want.
                  </p>

                  {!settings?.openAiKey && (
                    <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
                      Add your OpenAI API key below to enable LLM categorization.
                    </div>
                  )}

                  {llmError && (
                    <div className="text-sm text-destructive border border-destructive/40 rounded-md p-3">
                      {llmError}
                    </div>
                  )}

                  <Button
                    onClick={runLlmCategorization}
                    disabled={isLlmRunning || !settings?.openAiKey}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isLlmRunning ? 'Running…' : 'Run LLM Categorization'}
                  </Button>

                  {llmSuggestions.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm text-muted-foreground flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoCreateRules}
                          onChange={(e) => setAutoCreateRules(e.target.checked)}
                        />
                        Create rule for merchant when accepted
                      </label>
                      <div className="overflow-auto max-h-80 border rounded">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              <th className="text-left p-2 w-8"></th>
                              <th className="text-left p-2">Transaction</th>
                              <th className="text-left p-2">Category</th>
                              <th className="text-left p-2">Subcategory</th>
                              <th className="text-right p-2">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {llmSuggestions.map((s) => {
                              const tx = llmTransactionMap.get(s.transaction_id)
                              return (
                                <tr key={s.transaction_id} className="border-t hover:bg-muted/40">
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedSuggestionIds.has(s.transaction_id)}
                                      onChange={(e) => {
                                        setSelectedSuggestionIds((prev) => {
                                          const next = new Set(prev)
                                          if (e.target.checked) next.add(s.transaction_id)
                                          else next.delete(s.transaction_id)
                                          return next
                                        })
                                      }}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium">{tx?.merchant || 'Unknown'}</div>
                                    <div className="text-muted-foreground">{tx?.description || ''}</div>
                                  </td>
                                  <td className="p-2">{s.category || '—'}</td>
                                  <td className="p-2">{s.subcategory || '—'}</td>
                                  <td className="p-2 text-right">{s.confidence.toFixed(2)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={applyLlmSuggestions}>
                          Apply Selected ({selectedSuggestionIds.size})
                        </Button>
                        <Button variant="outline" onClick={() => setLlmSuggestions([])}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Optional API keys for AI-powered features like receipt parsing and Q&A.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">OpenAI API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={openAiKey}
                onChange={(e) => {
                  const value = e.target.value
                  setOpenAiKey(value)
                  updateSettings({ openAiKey: value })
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Anthropic API Key</label>
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => {
                  const value = e.target.value
                  setAnthropicKey(value)
                  updateSettings({ anthropicKey: value })
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Genzeb v1.0.0
              <br />
              A local-first, privacy-preserving expense tracking application.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
