import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  useVendors,
  useCreateVendor,
  useDeleteVendor,
  useUpdateVendor,
  type VendorInput,
} from '@/hooks/useVendors'
import { Button, EmptyState, Input, Label, Modal } from '@/components/ui'
import type { Vendor } from '@/types/database'

const emptyForm: VendorInput = { name: '', email: '', phone: '', address: '' }

export default function Vendors() {
  const { data: vendors = [], isLoading } = useVendors()
  const createVendor = useCreateVendor()
  const updateVendor = useUpdateVendor()
  const deleteVendor = useDeleteVendor()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorInput>(emptyForm)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(v: Vendor) {
    setEditing(v)
    setForm({ name: v.name, email: v.email, phone: v.phone, address: v.address })
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (editing) {
      await updateVendor.mutateAsync({ id: editing.id, ...form })
    } else {
      await createVendor.mutateAsync(form)
    }
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this vendor? Their bills will remain but lose the vendor link.')) return
    await deleteVendor.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Vendors</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">People and companies that bill you</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add vendor
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add a vendor to start tracking bills from them."
          action={<Button onClick={openCreate}>Add vendor</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{v.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{v.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{v.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(v)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-negative-500 dark:hover:bg-slate-800">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit vendor' : 'Add vendor'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value || null }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createVendor.isPending || updateVendor.isPending}>
              {editing ? 'Save changes' : 'Add vendor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
