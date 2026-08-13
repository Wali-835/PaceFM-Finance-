import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Printer, Trash2 } from 'lucide-react'
import {
  useCreateBill,
  useDeleteBill,
  useBill,
  useBills,
  useUpdateBill,
  type BillInput,
  type BillItemInput,
} from '@/hooks/useBills'
import { useVendors } from '@/hooks/useVendors'
import { useCompany } from '@/context/CompanyContext'
import { Button, Card, Input, Label, Select } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import type { BillStatus } from '@/types/database'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

const UNIT_SUGGESTIONS = ['pcs', 'hrs', 'kg', 'box', 'unit', 'day', 'month']

function emptyItem(): BillItemInput {
  return { description: '', unit: '', quantity: 1, unit_price: 0 }
}

export default function BillDetail() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const { activeCompany } = useCompany()
  const currency = activeCompany?.currency ?? 'USD'

  const { data: vendors = [] } = useVendors()
  const { data: existingBills = [] } = useBills()
  const { data: loaded } = useBill(isNew ? undefined : id)

  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()

  const [form, setForm] = useState<BillInput>({
    vendor_id: null,
    bill_number: '',
    status: 'unpaid',
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: defaultDueDate(),
    notes: '',
    tax_rate: 0,
    wht_rate: 0,
    items: [emptyItem()],
  })

  useEffect(() => {
    if (isNew) {
      const nextNumber = `BILL-${String(existingBills.length + 1).padStart(4, '0')}`
      setForm((f) => ({ ...f, bill_number: nextNumber }))
    }
  }, [isNew, existingBills.length])

  useEffect(() => {
    if (loaded) {
      setForm({
        vendor_id: loaded.bill.vendor_id,
        bill_number: loaded.bill.bill_number,
        status: loaded.bill.status,
        bill_date: loaded.bill.bill_date,
        due_date: loaded.bill.due_date,
        notes: loaded.bill.notes,
        tax_rate: loaded.bill.tax_rate,
        wht_rate: loaded.bill.wht_rate,
        items: loaded.items.map((i) => ({
          description: i.description,
          unit: i.unit,
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
  const whtAmount = subtotal * (form.wht_rate / 100)
  const total = subtotal + taxAmount - whtAmount

  function updateItem(index: number, patch: Partial<BillItemInput>) {
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
      const bill = await createBill.mutateAsync(payload)
      navigate(`/bills/${bill.id}`, { replace: true })
    } else if (id) {
      await updateBill.mutateAsync({ id, ...payload })
    }
  }

  async function handleDelete() {
    if (!id || isNew) return
    if (!confirm('Delete this bill permanently?')) return
    await deleteBill.mutateAsync(id)
    navigate('/bills')
  }

  const saving = createBill.isPending || updateBill.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {isNew ? 'New bill' : form.bill_number}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isNew ? 'Record a bill from a vendor' : 'Edit bill details'}
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
            {saving ? 'Saving…' : 'Save bill'}
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="bill_number">Bill number</Label>
            <Input
              id="bill_number"
              value={form.bill_number}
              onChange={(e) => setForm((f) => ({ ...f, bill_number: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Select
              id="vendor"
              value={form.vendor_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value || null }))}
            >
              <option value="">Select vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BillStatus }))}
            >
              {(['unpaid', 'paid', 'overdue', 'void'] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tax_rate">Tax (%)</Label>
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
              <Label htmlFor="wht_rate">WHT (%)</Label>
              <Input
                id="wht_rate"
                type="number"
                min="0"
                step="0.01"
                value={form.wht_rate}
                onChange={(e) => setForm((f) => ({ ...f, wht_rate: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bill_date">Bill date</Label>
            <Input
              id="bill_date"
              type="date"
              value={form.bill_date}
              onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))}
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
            <span className="col-span-4">Description</span>
            <span className="col-span-2">Unit</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-2">Unit price</span>
            <span className="col-span-2 text-right">Amount</span>
          </div>
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <Input
                className="col-span-12 sm:col-span-4"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
              />
              <Input
                className="col-span-4 sm:col-span-2"
                list="unit-suggestions"
                placeholder="e.g. pcs"
                value={item.unit}
                onChange={(e) => updateItem(i, { unit: e.target.value })}
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
          <datalist id="unit-suggestions">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
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
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>WHT ({form.wht_rate}%)</span>
              <span>-{formatCurrency(whtAmount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
              <span>Net payable</span>
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
          placeholder="Payment reference, notes, etc."
        />
      </Card>
    </div>
  )
}
