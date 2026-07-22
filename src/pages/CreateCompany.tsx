import { useState, type FormEvent } from 'react'
import { useCompany } from '@/context/CompanyContext'
import { useAuth } from '@/context/AuthContext'
import { Button, Input, Label, Select } from '@/components/ui'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'PKR', 'INR']

export default function CreateCompany() {
  const { createCompany } = useCompany()
  const { signOut } = useAuth()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await createCompany(name, currency)
    setLoading(false)
    if (error) setError(error)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Set up your company</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This creates your finance workspace. You can invite teammates later.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <Label htmlFor="name">Company name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
          </div>
          <div>
            <Label htmlFor="currency">Base currency</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-negative-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>
        <button onClick={() => signOut()} className="mt-4 w-full text-center text-sm text-slate-500 hover:underline dark:text-slate-400">
          Sign out
        </button>
      </div>
    </div>
  )
}
