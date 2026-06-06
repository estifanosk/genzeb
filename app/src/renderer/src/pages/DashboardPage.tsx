import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Tag, Receipt, AlertCircle, Bot, CalendarDays, Building2, Store, ArrowDownCircle, Clock, Repeat2 } from 'lucide-react'
import type { DashboardStats } from '@core/types/ipc'
import { Badge } from '../components/ui/badge'
import { PageHeader, PageShell, Panel } from '../components/ui/page'
import { EmptyState, LoadingState } from '../components/ui/state'

const CATEGORY_COLORS = [
  '#2f81f7', '#3fb950', '#d29922', '#a371f7',
  '#f85149', '#56d4dd', '#db6d28', '#7ee787',
  '#ff7b72', '#79c0ff'
]

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtSignedCurrency(n: number) {
  const sign = n < 0 ? '-' : ''
  return sign + fmtCurrency(Math.abs(n))
}

function fmtPct(n: number | null) {
  if (n === null) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

function fmtMonth(m: string) {
  if (!m) return '—'
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short' })
}

function fmtFullMonth(m: string) {
  if (!m) return '—'
  return `${fmtMonth(m)} ${m.slice(0, 4)}`
}

function KpiCard({
  label, value, sub, icon: Icon, color
}: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <Panel className="flex items-start gap-4 p-5">
      <div className={`rounded-md p-2.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Panel>
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function ProgressBar({ value, tone = 'info' }: { value: number; tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  const colors = {
    info: 'bg-sky-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500'
  }
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function DataRow({
  label,
  value,
  sub,
  tone
}: {
  label: React.ReactNode
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className={`shrink-0 text-right text-sm font-medium tabular-nums ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmtCurrency(p.value)}</p>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getDashboardStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <PageShell><LoadingState label="Loading dashboard..." /></PageShell>
  }
  if (!stats || stats.totalTransactions === 0) {
    return (
      <PageShell>
        <EmptyState title="No dashboard data yet" description="Import statements to see income, spending, and category trends." />
      </PageShell>
    )
  }

  const net = stats.monthlyNet
  const currentMonthLabel = fmtFullMonth(stats.currentMonth)
  const top10Categories = stats.categoryBreakdown.slice(0, 10)
  const topCurrentMonthCategories = stats.currentMonthCategoryBreakdown.slice(0, 6)
  const uncategorizedPct = stats.totalTransactions > 0 ? (stats.uncategorizedCount / stats.totalTransactions) * 100 : 0

  return (
    <PageShell className="overflow-auto">
      <PageHeader
        title="Dashboard"
        description="Income, spending, and category activity at a glance."
        meta={
          <>
            <Badge variant="neutral">{stats.totalTransactions.toLocaleString()} transactions</Badge>
            <Badge variant="info">Current month: {currentMonthLabel}</Badge>
            {stats.dateMin && stats.dateMax && <Badge variant="neutral">{stats.dateMin} to {stats.dateMax}</Badge>}
          </>
        }
      />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Income this month"
          value={fmtCurrency(stats.monthlyIncome)}
          icon={TrendingUp}
          color="bg-green-500/15 text-green-400"
        />
        <KpiCard
          label="Spending this month"
          value={fmtCurrency(stats.monthlySpending)}
          icon={TrendingDown}
          color="bg-red-500/15 text-red-400"
        />
        <KpiCard
          label="Net this month"
          value={fmtCurrency(Math.abs(net))}
          sub={net >= 0 ? 'surplus' : 'deficit'}
          icon={Wallet}
          color={net >= 0 ? 'bg-blue-500/15 text-blue-400' : 'bg-orange-500/15 text-orange-400'}
        />
        <KpiCard
          label="Top category"
          value={stats.topCategory ?? '—'}
          sub={stats.topCategory ? fmtCurrency(stats.categoryBreakdown[0]?.total ?? 0) + ' total' : undefined}
          icon={Tag}
          color="bg-violet-500/15 text-violet-400"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="All-time net"
          value={fmtSignedCurrency(stats.allTimeNet)}
          sub={`${fmtCurrency(stats.allTimeIncome)} in · ${fmtCurrency(stats.allTimeSpending)} out`}
          icon={Wallet}
          color={stats.allTimeNet >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}
        />
        <KpiCard
          label="Avg monthly spending"
          value={fmtCurrency(stats.averageMonthlySpending)}
          sub={`${fmtCurrency(stats.averageDailySpendingThisMonth)} per day this month`}
          icon={CalendarDays}
          color="bg-sky-500/15 text-sky-400"
        />
        <KpiCard
          label="Receipt coverage"
          value={`${stats.receiptCoveragePct.toFixed(0)}%`}
          sub={`${stats.transactionsWithReceipts} linked transaction${stats.transactionsWithReceipts === 1 ? '' : 's'}`}
          icon={Receipt}
          color="bg-teal-500/15 text-teal-400"
        />
        <KpiCard
          label="Needs review"
          value={stats.uncategorizedCount.toLocaleString()}
          sub={`${fmtCurrency(stats.uncategorizedSpending)} uncategorized spending`}
          icon={AlertCircle}
          color={stats.uncategorizedCount > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="p-5">
          <SectionHeader title="Month-over-month" description={stats.previousMonth ? `${fmtFullMonth(stats.previousMonth)} compared with ${currentMonthLabel}.` : 'More months will unlock trend comparisons.'} />
          <div className="space-y-3">
            <DataRow label="Income change" value={fmtPct(stats.monthOverMonthIncomePct)} tone={(stats.monthOverMonthIncomePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <DataRow label="Spending change" value={fmtPct(stats.monthOverMonthSpendingPct)} tone={(stats.monthOverMonthSpendingPct ?? 0) <= 0 ? 'text-emerald-400' : 'text-amber-400'} />
            <DataRow label="Previous net" value={fmtSignedCurrency(stats.previousMonthNet)} tone={stats.previousMonthNet >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <DataRow label="This month transactions" value={stats.transactionCountThisMonth.toLocaleString()} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Data quality" description="Review gaps that affect reporting accuracy." />
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Receipt coverage</span>
                <span className="font-medium">{stats.receiptCoveragePct.toFixed(0)}%</span>
              </div>
              <ProgressBar value={stats.receiptCoveragePct} tone={stats.receiptCoveragePct >= 75 ? 'success' : stats.receiptCoveragePct >= 40 ? 'warning' : 'danger'} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Uncategorized transactions</span>
                <span className="font-medium">{uncategorizedPct.toFixed(0)}%</span>
              </div>
              <ProgressBar value={uncategorizedPct} tone={uncategorizedPct <= 10 ? 'success' : uncategorizedPct <= 30 ? 'warning' : 'danger'} />
            </div>
            <DataRow label="AI-edited transactions" value={stats.aiEditedCount.toLocaleString()} sub={<span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" /> Visible with AI badges in Transactions</span>} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Current month categories" description="Where spending is going this month." />
          {topCurrentMonthCategories.length > 0 ? (
            <div className="space-y-2">
              {topCurrentMonthCategories.map((row, index) => {
                const max = topCurrentMonthCategories[0]?.total || 1
                return (
                  <div key={row.category}>
                    <div className="mb-1 flex justify-between gap-3 text-xs">
                      <span className="truncate">{row.category}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtCurrency(row.total)}</span>
                    </div>
                    <ProgressBar value={(row.total / max) * 100} tone={index === 0 ? 'info' : 'success'} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No categorized spending this month.</p>
          )}
        </Panel>
      </div>

      {/* Charts row */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">

        {/* Monthly trend */}
        <Panel className="p-5">
          <h3 className="mb-1 font-semibold">Monthly income vs spending</h3>
          <p className="mb-4 text-xs text-muted-foreground">Trailing monthly movement from imported transactions.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthlyTrend} barGap={4} barCategoryGap="30%">
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="spending" name="Spending" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Category breakdown */}
        <Panel className="p-5">
          <h3 className="mb-1 font-semibold">Spending by category</h3>
          <p className="mb-4 text-xs text-muted-foreground">Top categories by total spending.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={top10Categories}
              layout="vertical"
              barCategoryGap="20%"
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11, fill: 'currentColor' }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="total" name="Spending" radius={[0, 3, 3, 0]}>
                {top10Categories.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="p-5">
          <SectionHeader title="Top merchants" description="Largest spending destinations across all imported data." />
          {stats.topMerchants.length > 0 ? stats.topMerchants.map((row) => (
            <DataRow key={row.merchant} label={<span className="inline-flex min-w-0 items-center gap-2"><Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{row.merchant}</span></span>} sub={`${row.count} transaction${row.count === 1 ? '' : 's'}`} value={fmtCurrency(row.total)} />
          )) : <p className="text-sm text-muted-foreground">No merchant spending yet.</p>}
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Accounts" description="Income, spending, and net by account." />
          {stats.accountBreakdown.length > 0 ? stats.accountBreakdown.map((row) => (
            <DataRow key={row.account} label={<span className="inline-flex min-w-0 items-center gap-2"><Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{row.account}</span></span>} sub={`${fmtCurrency(row.income)} in · ${fmtCurrency(row.spending)} out · ${row.count} tx`} value={fmtSignedCurrency(row.net)} tone={row.net >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          )) : <p className="text-sm text-muted-foreground">No account activity yet.</p>}
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Recurring-looking merchants" description="Merchants that appear in multiple months." />
          {stats.recurringMerchants.length > 0 ? stats.recurringMerchants.map((row) => (
            <DataRow key={row.merchant} label={<span className="inline-flex min-w-0 items-center gap-2"><Repeat2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{row.merchant}</span></span>} sub={`${row.count} transactions · ${row.months} months`} value={fmtCurrency(row.total)} />
          )) : <p className="text-sm text-muted-foreground">No recurring pattern yet.</p>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <SectionHeader title="Largest expenses" description="Highest single spending transactions." />
          {stats.largestExpenses.length > 0 ? stats.largestExpenses.map((row) => (
            <DataRow key={row.id} label={<span className="inline-flex min-w-0 items-center gap-2"><ArrowDownCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{row.merchant}</span></span>} sub={`${row.date}${row.category ? ` · ${row.category}` : ''}`} value={fmtCurrency(row.amount)} tone="text-rose-400" />
          )) : <p className="text-sm text-muted-foreground">No expenses yet.</p>}
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Recent transactions" description="Latest imported activity by transaction date." />
          {stats.recentTransactions.length > 0 ? stats.recentTransactions.map((row) => (
            <DataRow key={row.id} label={<span className="inline-flex min-w-0 items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{row.merchant}</span></span>} sub={`${row.date}${row.category ? ` · ${row.category}` : ''}`} value={fmtSignedCurrency(row.amount)} tone={row.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          )) : <p className="text-sm text-muted-foreground">No recent activity yet.</p>}
        </Panel>
      </div>
    </PageShell>
  )
}
