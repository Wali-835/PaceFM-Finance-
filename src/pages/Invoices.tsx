import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useInvoices } from '@/hooks/useInvoices'
import { useCompany } from '@/context/CompanyContext'
import { Badge, Button, EmptyState, Select } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/format'
import type { InvoiceStatus } from '@/types/database'

const STATUS_TONES: Record<InvoiceStatus, 'neutral' | 'positive' | 'negative' | 'warning' | 'brand'> = {
  draft: 'neutral',
  sent: 'brand',
  paid: 'positive',
  overdue: 'negative',
  void: 'neutral',
}

export default function Invoices() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'
  const navigate = useNavigate()
  const { data: invoices = [], isLoading } = useInvoices()
  const [filter, setFilter] = useState<InvoiceStatus | ''>('')

  const filtered = filter ? invoices.filter((i) => i.status === filter) : invoices

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Invoices</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bill your clients and track payment status</p>
        </div>
        <Button onClick={() => navigate('/invoices/new')}>
          <Plus size={16} /> New invoice
        </Button>
      </div>

      <div className="w-48">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as InvoiceStatus | '')}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="void">Void</option>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create your first invoice to start billing clients."
          action={<Button onClick={() => navigate('/invoices/new')}>New invoice</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {filtered.map((inv) => (
                <tr key={inv.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    <Link to={`/invoices/${inv.id}`}>{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    <Link to={`/invoices/${inv.id}`}>{inv.client_name ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(inv.due_date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    {formatCurrency(inv.total, currency)}
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
