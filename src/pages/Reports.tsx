import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTransactions } from '@/hooks/useTransactions'
import { useCategories } from '@/hooks/useCategories'
import { useInvoices } from '@/hooks/useInvoices'
import { useBills } from '@/hooks/useBills'
import { useCompany } from '@/context/CompanyContext'
import { Card, EmptyState, Input, Label } from '@/components/ui'
import { formatCurrency } from '@/lib/format'

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Reports() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(today())

  const { data: transactions = [], isLoading } = useTransactions({ from, to })
  const { data: categories = [] } = useCategories()
  const { data: invoices = [] } = useInvoices()
  const { data: bills = [] } = useBills()
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const income = transactions.filter((t) => t.kind === 'income').reduce((s, t) => s + t.total, 0)
  const expense = transactions.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.total, 0)
  const net = income - expense

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.kind !== 'expense') continue
      const key = t.category_id ?? 'uncategorized'
      map.set(key, (map.get(key) ?? 0) + t.total)
    }
    return [...map.entries()]
      .map(([categoryId, amount]) => ({
        name: categoryId === 'uncategorized' ? 'Uncategorized' : categoryMap.get(categoryId)?.name ?? 'Unknown',
        color: categoryId === 'uncategorized' ? '#94a3b8' : categoryMap.get(categoryId)?.color ?? '#94a3b8',
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, categoryMap])

  const byClient = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; invoiced: number; paid: number; outstanding: number }
    >()
    for (const inv of invoices) {
      if (inv.issue_date < from || inv.issue_date > to) continue
      if (inv.status === 'draft' || inv.status === 'void') continue
      const key = inv.client_id ?? 'none'
      const name = inv.client_name ?? 'No client'
      const entry = map.get(key) ?? { name, count: 0, invoiced: 0, paid: 0, outstanding: 0 }
      entry.count += 1
      entry.invoiced += inv.total
      if (inv.status === 'paid') entry.paid += inv.total
      else entry.outstanding += inv.total
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || b.invoiced - a.invoiced)
  }, [invoices, from, to])

  const byVendor = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; billed: number; paid: number; outstanding: number }
    >()
    for (const bill of bills) {
      if (bill.bill_date < from || bill.bill_date > to) continue
      if (bill.status === 'void') continue
      const key = bill.vendor_id ?? 'none'
      const name = bill.vendor_name ?? 'No vendor'
      const entry = map.get(key) ?? { name, count: 0, billed: 0, paid: 0, outstanding: 0 }
      entry.count += 1
      entry.billed += bill.total
      if (bill.status === 'paid') entry.paid += bill.total
      else entry.outstanding += bill.total
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.outstanding - a.outstanding || b.billed - a.billed)
  }, [bills, from, to])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Profit &amp; loss for a custom date range</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total income</p>
              <p className="mt-1 text-xl font-semibold text-positive-600 dark:text-positive-500">
                {formatCurrency(income, currency)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total expenses</p>
              <p className="mt-1 text-xl font-semibold text-negative-600 dark:text-negative-500">
                {formatCurrency(expense, currency)}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-slate-500 dark:text-slate-400">Net profit</p>
              <p className={`mt-1 text-xl font-semibold ${net >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-negative-500'}`}>
                {formatCurrency(net, currency)}
              </p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Expenses by category</h2>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No expenses in this period.</p>
            ) : (
              <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="amount" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
                      {expenseByCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {expenseByCategory.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {formatCurrency(c.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">By client</h2>
              {byClient.length === 0 ? (
                <EmptyState title="No invoices in this period" description="Issued invoices will be broken down by client here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-2">Client</th>
                        <th className="py-2 pr-2 text-right">Invoiced</th>
                        <th className="py-2 pr-2 text-right">Paid</th>
                        <th className="py-2 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {byClient.map((c) => (
                        <tr key={c.name}>
                          <td className="py-2 pr-2 font-medium text-slate-800 dark:text-slate-200">
                            {c.name}
                            <span className="ml-1 text-xs font-normal text-slate-400">({c.count})</span>
                          </td>
                          <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-300">
                            {formatCurrency(c.invoiced, currency)}
                          </td>
                          <td className="py-2 pr-2 text-right text-positive-600 dark:text-positive-500">
                            {formatCurrency(c.paid, currency)}
                          </td>
                          <td className={`py-2 text-right font-medium ${c.outstanding > 0 ? 'text-negative-500' : 'text-slate-400'}`}>
                            {formatCurrency(c.outstanding, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">By vendor</h2>
              {byVendor.length === 0 ? (
                <EmptyState title="No bills in this period" description="Bills from vendors will be broken down here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2 pr-2">Vendor</th>
                        <th className="py-2 pr-2 text-right">Billed</th>
                        <th className="py-2 pr-2 text-right">Paid</th>
                        <th className="py-2 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {byVendor.map((v) => (
                        <tr key={v.name}>
                          <td className="py-2 pr-2 font-medium text-slate-800 dark:text-slate-200">
                            {v.name}
                            <span className="ml-1 text-xs font-normal text-slate-400">({v.count})</span>
                          </td>
                          <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-300">
                            {formatCurrency(v.billed, currency)}
                          </td>
                          <td className="py-2 pr-2 text-right text-positive-600 dark:text-positive-500">
                            {formatCurrency(v.paid, currency)}
                          </td>
                          <td className={`py-2 text-right font-medium ${v.outstanding > 0 ? 'text-negative-500' : 'text-slate-400'}`}>
                            {formatCurrency(v.outstanding, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
