import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionInput,
} from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useCompany } from '@/context/CompanyContext'
import { Badge, Button, EmptyState, Input, Label, Modal, Select } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/format'
import type { CategoryKind, Transaction } from '@/types/database'

const emptyForm: TransactionInput = {
  account_id: null,
  category_id: null,
  kind: 'expense',
  amount: 0,
  occurred_on: new Date().toISOString().slice(0, 10),
  description: '',
}

export default function Transactions() {
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'

  const [kindFilter, setKindFilter] = useState<CategoryKind | ''>('')
  const { data: transactions = [], isLoading } = useTransactions({
    kind: kindFilter || undefined,
  })
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState<TransactionInput>(emptyForm)

  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const filteredCategories = categories.filter((c) => c.kind === form.kind)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
    setForm({
      account_id: t.account_id,
      category_id: t.category_id,
      kind: t.kind,
      amount: t.amount,
      occurred_on: t.occurred_on,
      description: t.description,
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (editing) {
      await updateTx.mutateAsync({ id: editing.id, ...form })
    } else {
      await createTx.mutateAsync(form)
    }
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    await deleteTx.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Transactions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track income and expenses</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add transaction
        </Button>
      </div>

      <div className="flex gap-2">
        {(['', 'income', 'expense'] as const).map((k) => (
          <button
            key={k || 'all'}
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              kindFilter === k
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {k === '' ? 'All' : k === 'income' ? 'Income' : 'Expense'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Add your first income or expense to start tracking your finances."
          action={<Button onClick={openCreate}>Add transaction</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(t.occurred_on)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {t.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {t.category_id ? (
                      <Badge>{categoryMap.get(t.category_id)?.name ?? '—'}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {t.account_id ? accountMap.get(t.account_id)?.name ?? '—' : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      t.kind === 'income' ? 'text-positive-600 dark:text-positive-500' : 'text-negative-600 dark:text-negative-500'
                    }`}
                  >
                    {t.kind === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(t)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-negative-500 dark:hover:bg-slate-800">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit transaction' : 'Add transaction'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setForm((f) => ({ ...f, kind: k, category_id: null }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  form.kind === k
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {k === 'income' ? 'Income' : 'Expense'}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.amount || ''}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            />
          </div>

          <div>
            <Label htmlFor="occurred_on">Date</Label>
            <Input
              id="occurred_on"
              type="date"
              required
              value={form.occurred_on}
              onChange={(e) => setForm((f) => ({ ...f, occurred_on: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Office rent"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={form.category_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
            >
              <option value="">No category</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="account">Account</Label>
            <Select
              id="account"
              value={form.account_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value || null }))}
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTx.isPending || updateTx.isPending}>
              {editing ? 'Save changes' : 'Add transaction'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
