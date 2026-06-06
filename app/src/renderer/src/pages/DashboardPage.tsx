import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Tag } from 'lucide-react'
import type { DashboardStats } from '@core/types/ipc'

const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#7c3aed', '#5b21b6', '#4c1d95',
  '#7e22ce', '#9333ea'
]

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short' })
}

function KpiCard({
  label, value, sub, icon: Icon, color
}: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-md ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
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
    return <div className="p-6 text-muted-foreground text-sm">Loading…</div>
  }
  if (!stats) {
    return <div className="p-6 text-muted-foreground text-sm">No data yet. Import statements to see your dashboard.</div>
  }

  const net = stats.monthlyIncome - stats.monthlySpending
  const currentMonthLabel = fmtMonth(stats.currentMonth) + ' ' + stats.currentMonth.slice(0, 4)
  const top10Categories = stats.categoryBreakdown.slice(0, 10)

  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-1">Dashboard</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {stats.totalTransactions.toLocaleString()} transactions · current month: {currentMonthLabel}
      </p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
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
          color="bg-purple-500/15 text-purple-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Monthly trend */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Monthly income vs spending</h3>
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
        </div>

        {/* Category breakdown */}
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold mb-4">Spending by category</h3>
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
        </div>
      </div>
    </div>
  )
}
