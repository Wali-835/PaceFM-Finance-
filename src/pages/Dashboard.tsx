import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useCompany } from '@/context/CompanyContext'
import { Card, Badge } from '@/components/ui'
import { formatCurrency, formatDate, monthKey, monthLabel } from '@/lib/format'

function monthsAgo(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  d.setDate(1)
  return d
}

export default function Dashboard() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'
  const currentMonth = monthKey()
  const sixMonthsAgo = monthsAgo(5)

  const { data: transactions = [], isLoading } = useTransactions({
    from: sixMonthsAgo.toISOString().slice(0, 10),
  })
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: budgets = [] } = useBudgets(currentMonth)

  const thisMonthTx = useMemo(
    () => transactions.filter((t) => t.occurred_on.startsWith(currentMonth.slice(0, 7))),
    [transactions, currentMonth],
  )

  const income = thisMonthTx.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = thisMonthTx.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
  const net = income - expense

  const cashBalance = useMemo(() => {
    const openingTotal = accounts.reduce((s, a) => s + a.opening_balance, 0)
    const txTotal = transactions.reduce(
      (s, t) => s + (t.kind === 'income' ? t.amount : -t.amount),
      0,
    )
    return openingTotal + txTotal
  }, [accounts, transactions])

  const chartData = useMemo(() => {
    const buckets: Record<string, { month: string; income: number; expense: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = monthsAgo(i)
      const key = d.toISOString().slice(0, 7)
      buckets[key] = { month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d), income: 0, expense: 0 }
    }
    for (const t of transactions) {
      const key = t.occurred_on.slice(0, 7)
      if (!buckets[key]) continue
      buckets[key][t.kind === 'income' ? 'income' : 'expense'] += t.amount
    }
    return Object.values(buckets)
  }, [transactions])

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const budgetProgress = budgets
    .map((b) => {
      const spent = thisMonthTx
        .filter((t) => t.category_id === b.category_id && t.kind === 'expense')
        .reduce((s, t) => s + t.amount, 0)
      return { ...b, spent, category: categoryMap.get(b.category_id) }
    })
    .filter((b) => b.category)
    .sort((a, b) => b.spent / (b.amount || 1) - a.spent / (a.amount || 1))
    .slice(0, 4)

  const recentTransactions = transactions.slice(0, 6)

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading dashboard…</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{monthLabel(currentMonth)} overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Cash balance</span>
            <Wallet size={18} className="text-brand-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(cashBalance, currency)}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Income (month)</span>
            <ArrowUpRight size={18} className="text-positive-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-positive-600 dark:text-positive-500">
            {formatCurrency(income, currency)}
          </p>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Expenses (month)</span>
            <ArrowDownRight size={18} className="text-negative-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-negative-600 dark:text-negative-500">
            {formatCurrency(expense, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Net: {formatCurrency(net, currency)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Income vs expenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={40} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), currency)}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Bar dataKey="income" fill="var(--color-positive-500)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="var(--color-negative-500)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Budget progress</h2>
            <Link to="/budgets" className="text-xs font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {budgetProgress.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No budgets set for this month.</p>
          ) : (
            <div className="space-y-4">
              {budgetProgress.map((b) => {
                const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0
                const over = b.spent > b.amount
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{b.category?.name}</span>
                      <span className={over ? 'text-negative-500' : 'text-slate-500 dark:text-slate-400'}>
                        {formatCurrency(b.spent, currency)} / {formatCurrency(b.amount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${over ? 'bg-negative-500' : 'bg-brand-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent transactions</h2>
          <Link to="/transactions" className="text-xs font-medium text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {t.description || categoryMap.get(t.category_id ?? '')?.name || 'Transaction'}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(t.occurred_on)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={t.kind === 'income' ? 'positive' : 'negative'}>
                    {t.kind === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount, currency)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
