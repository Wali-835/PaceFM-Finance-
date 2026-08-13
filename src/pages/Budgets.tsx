import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBudgets, useUpsertBudget } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { useCompany } from '@/context/CompanyContext'
import { Button, Card, EmptyState, Input } from '@/components/ui'
import { formatCurrency, monthLabel } from '@/lib/format'

function monthToDate(month: string) {
  return new Date(`${month}T00:00:00`)
}

function shiftMonth(month: string, delta: number) {
  const d = monthToDate(month)
  d.setMonth(d.getMonth() + delta)
  return d.toISOString().slice(0, 10)
}

function lastDayOfMonth(month: string) {
  const d = monthToDate(month)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return d.toISOString().slice(0, 10)
}

export default function Budgets() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'
  const [month, setMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })

  const { data: categories = [] } = useCategories('expense')
  const { data: budgets = [] } = useBudgets(month)
  const { data: transactions = [] } = useTransactions({
    from: month,
    to: lastDayOfMonth(month),
    kind: 'expense',
  })
  const upsertBudget = useUpsertBudget()

  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.category_id, b])), [budgets])
  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (!t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.total)
    }
    return map
  }, [transactions])

  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function handleSave(categoryId: string) {
    const raw = drafts[categoryId]
    const amount = raw !== undefined ? Number(raw) : budgetMap.get(categoryId)?.amount ?? 0
    if (Number.isNaN(amount)) return
    upsertBudget.mutate({ category_id: categoryId, month, amount })
  }

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = [...spentByCategory.values()].reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Budgets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Set spending limits per category</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronLeft size={16} />
          </button>
          <span className="w-36 text-center text-sm font-medium text-slate-700 dark:text-slate-300">{monthLabel(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total budgeted</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalBudget, currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Total spent</span>
          <span className={`font-semibold ${totalSpent > totalBudget ? 'text-negative-500' : 'text-slate-900 dark:text-slate-100'}`}>
            {formatCurrency(totalSpent, currency)}
          </span>
        </div>
      </Card>

      {categories.length === 0 ? (
        <EmptyState
          title="No expense categories yet"
          description="Add expense categories in Settings before setting budgets."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categories.map((c) => {
            const budget = budgetMap.get(c.id)
            const spent = spentByCategory.get(c.id) ?? 0
            const amount = budget?.amount ?? 0
            const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0
            const over = spent > amount && amount > 0

            return (
              <Card key={c.id}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                  <span className={`text-xs ${over ? 'text-negative-500' : 'text-slate-500 dark:text-slate-400'}`}>
                    {formatCurrency(spent, currency)} of {formatCurrency(amount, currency)}
                  </span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${over ? 'bg-negative-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Budget amount"
                    defaultValue={amount || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <Button variant="secondary" onClick={() => handleSave(c.id)} disabled={upsertBudget.isPending}>
                    Save
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
