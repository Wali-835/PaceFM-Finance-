import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useBills } from '@/hooks/useBills'
import { useCompany } from '@/context/CompanyContext'
import { Badge, Button, EmptyState, Select } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/format'
import type { BillStatus } from '@/types/database'

const STATUS_TONES: Record<BillStatus, 'neutral' | 'positive' | 'negative' | 'warning' | 'brand'> = {
  unpaid: 'brand',
  paid: 'positive',
  overdue: 'negative',
  void: 'neutral',
}

export default function Bills() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'
  const navigate = useNavigate()
  const { data: bills = [], isLoading } = useBills()
  const [filter, setFilter] = useState<BillStatus | ''>('')

  const filtered = filter ? bills.filter((b) => b.status === filter) : bills

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Bills</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bills your vendors have sent you, and their payment status</p>
        </div>
        <Button onClick={() => navigate('/bills/new')}>
          <Plus size={16} /> New bill
        </Button>
      </div>

      <div className="w-48">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as BillStatus | '')}>
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Add a bill when a vendor sends you one to pay."
          action={<Button onClick={() => navigate('/bills/new')}>New bill</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {filtered.map((bill) => (
                <tr key={bill.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    <Link to={`/bills/${bill.id}`}>{bill.bill_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <Link to={`/bills/${bill.id}`}>{bill.vendor_name ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(bill.bill_date)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(bill.due_date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[bill.status]}>{bill.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    {formatCurrency(bill.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
