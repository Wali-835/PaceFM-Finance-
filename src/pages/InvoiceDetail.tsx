import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Printer, Trash2 } from 'lucide-react'
import {
  useCreateInvoice,
  useDeleteInvoice,
  useInvoice,
  useInvoices,
  useUpdateInvoice,
  type InvoiceInput,
  type InvoiceItemInput,
} from '@/hooks/useInvoices'
import { useClients } from '@/hooks/useClients'
import { useCompany } from '@/context/CompanyContext'
import { Button, Card, Input, Label, Select } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import type { InvoiceStatus } from '@/types/database'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function emptyItem(): InvoiceItemInput {
  return { description: '', quantity: 1, unit_price: 0 }
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'

  const { data: clients = [] } = useClients()
  const { data: existingInvoices = [] } = useInvoices()
  const { data: loaded } = useInvoice(isNew ? undefined : id)

  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const deleteInvoice = useDeleteInvoice()

  const [form, setForm] = useState<InvoiceInput>({
    client_id: null,
    invoice_number: '',
    status: 'draft',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: defaultDueDate(),
    notes: '',
    tax_rate: 0,
    items: [emptyItem()],
  })

  useEffect(() => {
    if (isNew) {
      const nextNumber = `INV-${String(existingInvoices.length + 1).padStart(4, '0')}`
      setForm((f) => ({ ...f, invoice_number: nextNumber }))
    }
  }, [isNew, existingInvoices.length])

  useEffect(() => {
    if (loaded) {
      setForm({
        client_id: loaded.invoice.client_id,
        invoice_number: loaded.invoice.invoice_number,
        status: loaded.invoice.status,
        issue_date: loaded.invoice.issue_date,
        due_date: loaded.invoice.due_date,
        notes: loaded.invoice.notes,
        tax_rate: loaded.invoice.tax_rate,
        items: loaded.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      })
    }
  }, [loaded])

  const subtotal = useMemo(
    () => form.items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [form.items],
  )
  const taxAmount = subtotal * (form.tax_rate / 100)
  const total = subtotal + taxAmount

  function updateItem(index: number, patch: Partial<InvoiceItemInput>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  async function handleSave() {
    const cleanItems = form.items.filter((i) => i.description.trim() !== '')
    const payload = { ...form, items: cleanItems }
    if (isNew) {
      const invoice = await createInvoice.mutateAsync(payload)
      navigate(`/invoices/${invoice.id}`, { replace: true })
    } else if (id) {
      await updateInvoice.mutateAsync({ id, ...payload })
    }
  }

  async function handleDelete() {
    if (!id || isNew) return
    if (!confirm('Delete this invoice permanently?')) return
    await deleteInvoice.mutateAsync(id)
    navigate('/invoices')
  }

  const saving = createInvoice.isPending || updateInvoice.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? 'New invoice' : form.invoice_number}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isNew ? 'Create a new invoice' : 'Edit invoice details'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
          )}
          {!isNew && (
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={16} /> Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save invoice'}
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="invoice_number">Invoice number</Label>
            <Input
              id="invoice_number"
              value={form.invoice_number}
              onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="client">Client</Label>
            <Select
              id="client"
              value={form.client_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value || null }))}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InvoiceStatus }))}
            >
              {(['draft', 'sent', 'paid', 'overdue', 'void'] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="tax_rate">Tax rate (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              min="0"
              step="0.01"
              value={form.tax_rate}
              onChange={(e) => setForm((f) => ({ ...f, tax_rate: Number(e.target.value) }))}
            />
          </div>
          <div>
            <Label htmlFor="issue_date">Issue date</Label>
            <Input
              id="issue_date"
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="due_date">Due date</Label>
            <Input
              id="due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
          <Button variant="secondary" onClick={addItem} className="print:hidden">
            <Plus size={14} /> Add line
          </Button>
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-12 gap-2 text-xs font-medium uppercase text-slate-500 sm:grid dark:text-slate-400">
            <span className="col-span-6">Description</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-2">Unit price</span>
            <span className="col-span-2 text-right">Amount</span>
          </div>
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <Input
                className="col-span-12 sm:col-span-6"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
              />
              <Input
                className="col-span-4 sm:col-span-2"
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              />
              <Input
                className="col-span-4 sm:col-span-2"
                type="number"
                min="0"
                step="0.01"
                value={item.unit_price}
                onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
              />
              <div className="col-span-3 text-right text-sm font-medium text-slate-700 sm:col-span-1 dark:text-slate-300">
                {formatCurrency(item.quantity * item.unit_price, currency)}
              </div>
              <button
                onClick={() => removeItem(i)}
                className="col-span-1 flex justify-end text-slate-400 hover:text-negative-500 print:hidden"
                aria-label="Remove line"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Tax ({form.tax_rate}%)</span>
              <span>{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Payment terms, thank-you note, etc."
        />
      </Card>
    </div>
  )
}
