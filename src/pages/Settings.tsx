import { useState, type FormEvent } from 'react'
import { CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react'
import { useCompany } from '@/context/CompanyContext'
import { useCategories, useCreateCategory, useDeleteCategory } from '@/hooks/useCategories'
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts'
import { Button, Card, Input, Label, Select } from '@/components/ui'
import { CURRENCIES } from '@/lib/currencies'
import { api, ApiError } from '@/lib/api'
import type { AccountType, CategoryKind } from '@/types/database'

type EtaTestResult =
  | { ok: true; environment: string }
  | { ok: false; error: string; environment?: string; status?: number | null; details?: string }

const CATEGORY_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444']

const STARTER_CATEGORIES: { name: string; kind: CategoryKind }[] = [
  { name: 'Services', kind: 'expense' },
  { name: 'Supplies', kind: 'expense' },
  { name: 'Software', kind: 'expense' },
  { name: 'Rent', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Salaries', kind: 'expense' },
  { name: 'Marketing', kind: 'expense' },
  { name: 'Travel', kind: 'expense' },
  { name: 'Professional Fees', kind: 'expense' },
  { name: 'Other Expenses', kind: 'expense' },
  { name: 'Sales', kind: 'income' },
  { name: 'Services Revenue', kind: 'income' },
  { name: 'Other Income', kind: 'income' },
]

export default function SettingsPage() {
  const { activeCompany, updateCompany } = useCompany()
  const [name, setName] = useState(activeCompany?.name ?? '')
  const [currency, setCurrency] = useState(activeCompany?.currency ?? 'USD')
  const [savingProfile, setSavingProfile] = useState(false)

  const { data: categories = [] } = useCategories()
  const createCategory = useCreateCategory()
  const deleteCategory = useDeleteCategory()
  const [categoryName, setCategoryName] = useState('')
  const [categoryKind, setCategoryKind] = useState<CategoryKind>('expense')
  const [addingStarters, setAddingStarters] = useState(false)

  const { data: accounts = [] } = useAccounts()
  const createAccount = useCreateAccount()
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('bank')
  const [openingBalance, setOpeningBalance] = useState('0')

  const [testingEta, setTestingEta] = useState(false)
  const [etaResult, setEtaResult] = useState<EtaTestResult | null>(null)

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault()
    if (!activeCompany) return
    setSavingProfile(true)
    await updateCompany(activeCompany.id, { name, currency })
    setSavingProfile(false)
  }

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault()
    if (!categoryName.trim()) return
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
    await createCategory.mutateAsync({ name: categoryName.trim(), kind: categoryKind, color })
    setCategoryName('')
  }

  async function handleAddStarterCategories() {
    setAddingStarters(true)
    try {
      for (const [i, c] of STARTER_CATEGORIES.entries()) {
        await createCategory.mutateAsync({
          name: c.name,
          kind: c.kind,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        })
      }
    } finally {
      setAddingStarters(false)
    }
  }

  async function handleAddAccount(e: FormEvent) {
    e.preventDefault()
    if (!accountName.trim()) return
    await createAccount.mutateAsync({
      name: accountName.trim(),
      type: accountType,
      opening_balance: Number(openingBalance) || 0,
    })
    setAccountName('')
    setOpeningBalance('0')
  }

  async function handleTestEtaConnection() {
    if (!activeCompany) return
    setTestingEta(true)
    setEtaResult(null)
    try {
      const result = await api.get<{ ok: true; environment: string }>(
        `/api/companies/${activeCompany.id}/eta/test-connection`,
      )
      setEtaResult(result)
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as
          | { environment?: string; status?: number | null; details?: unknown }
          | null
          | undefined
        setEtaResult({
          ok: false,
          error: err.message,
          environment: body?.environment,
          status: body?.status ?? err.status,
          details: body?.details !== undefined ? JSON.stringify(body.details, null, 2) : undefined,
        })
      } else {
        setEtaResult({ ok: false, error: 'Something went wrong' })
      }
    } finally {
      setTestingEta(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your company, categories, and accounts</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Company profile</h2>
        <form onSubmit={handleProfileSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company_currency">Base currency</Label>
            <Select id="company_currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Categories</h2>
          {categories.length === 0 && (
            <Button variant="secondary" onClick={handleAddStarterCategories} disabled={addingStarters}>
              {addingStarters ? 'Adding…' : 'Add starter categories'}
            </Button>
          )}
        </div>
        <form onSubmit={handleAddCategory} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="category_name">New category</Label>
            <Input id="category_name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Software" />
          </div>
          <div>
            <Label htmlFor="category_kind">Type</Label>
            <Select id="category_kind" value={categoryKind} onChange={(e) => setCategoryKind(e.target.value as CategoryKind)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </div>
          <Button type="submit" disabled={createCategory.isPending}>
            <Plus size={16} /> Add
          </Button>
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['expense', 'income'] as const).map((kind) => (
            <div key={kind}>
              <p className="mb-2 text-xs font-medium uppercase text-slate-400">{kind}</p>
              <div className="space-y-1">
                {categories.filter((c) => c.kind === kind).length === 0 ? (
                  <p className="text-sm text-slate-400">No categories yet.</p>
                ) : (
                  categories
                    .filter((c) => c.kind === kind)
                    .map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                        <button
                          onClick={() => deleteCategory.mutate(c.id)}
                          className="text-slate-400 hover:text-negative-500"
                          aria-label={`Delete ${c.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Accounts</h2>
        <form onSubmit={handleAddAccount} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="account_name">New account</Label>
            <Input id="account_name" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Business checking" />
          </div>
          <div>
            <Label htmlFor="account_type">Type</Label>
            <Select id="account_type" value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit card</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="opening_balance">Opening balance</Label>
            <Input id="opening_balance" type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
          </div>
          <Button type="submit" disabled={createAccount.isPending}>
            <Plus size={16} /> Add
          </Button>
        </form>

        <div className="space-y-1">
          {accounts.length === 0 ? (
            <p className="text-sm text-slate-400">No accounts yet.</p>
          ) : (
            accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                <span className="text-slate-700 dark:text-slate-300">{a.name}</span>
                <span className="text-xs uppercase text-slate-400">{a.type.replace('_', ' ')}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Egyptian Tax Authority (e-invoicing)
        </h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Checks that the ETA client credentials configured on the server can obtain an access token. Set
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">ETA_CLIENT_ID</code>
          and
          <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">ETA_CLIENT_SECRET</code>
          as environment variables on the API server before testing.
        </p>
        <Button variant="secondary" onClick={handleTestEtaConnection} disabled={testingEta || !activeCompany}>
          {testingEta ? 'Testing…' : 'Test connection'}
        </Button>

        {etaResult && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${
              etaResult.ok
                ? 'bg-positive-500/10 text-positive-600 dark:text-positive-500'
                : 'bg-negative-500/10 text-negative-600 dark:text-negative-500'
            }`}
          >
            {etaResult.ok ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {etaResult.ok ? (
                <p>
                  Connected successfully to the <strong>{etaResult.environment}</strong> environment. Credentials
                  are valid.
                </p>
              ) : (
                <div className="space-y-2">
                  <p>
                    {etaResult.error}
                    {etaResult.environment && (
                      <>
                        {' '}
                        (<strong>{etaResult.environment}</strong> environment
                        {etaResult.status ? `, HTTP ${etaResult.status}` : ''})
                      </>
                    )}
                  </p>
                  {etaResult.details && (
                    <pre className="overflow-x-auto rounded bg-slate-900/90 p-2 text-xs text-slate-100">
                      {etaResult.details}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
