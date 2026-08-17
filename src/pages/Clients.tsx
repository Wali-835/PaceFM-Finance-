import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
  type ClientInput,
} from '@/hooks/useClients'
import { Button, EmptyState, Input, Label, Modal, Select } from '@/components/ui'
import type { Client } from '@/types/database'

const emptyForm: ClientInput = {
  name: '',
  email: '',
  phone: '',
  address: '',
  eta_buyer_type: 'B',
  eta_tax_registration_number: null,
  eta_governorate: null,
  eta_region_city: null,
  eta_street: null,
  eta_building_number: null,
}

export default function Clients() {
  const { data: clients = [], isLoading } = useClients()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const deleteClient = useDeleteClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientInput>(emptyForm)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      eta_buyer_type: c.eta_buyer_type,
      eta_tax_registration_number: c.eta_tax_registration_number,
      eta_governorate: c.eta_governorate,
      eta_region_city: c.eta_region_city,
      eta_street: c.eta_street,
      eta_building_number: c.eta_building_number,
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (editing) {
      await updateClient.mutateAsync({ id: editing.id, ...form })
    } else {
      await createClient.mutateAsync(form)
    }
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client? Their invoices will remain but lose the client link.')) return
    await deleteClient.mutateAsync(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">People and companies you invoice</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add client
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add a client to start creating invoices for them."
          action={<Button onClick={openCreate}>Add client</Button>}
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
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-negative-500 dark:hover:bg-slate-800">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit client' : 'Add client'}>
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

          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="mb-3 text-xs font-medium uppercase text-slate-400">E-invoicing (ETA)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="eta_buyer_type">Buyer type</Label>
                <Select
                  id="eta_buyer_type"
                  value={form.eta_buyer_type}
                  onChange={(e) => setForm((f) => ({ ...f, eta_buyer_type: e.target.value }))}
                >
                  <option value="B">Business</option>
                  <option value="P">Natural person</option>
                  <option value="F">Foreigner</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="eta_client_trn">Tax registration no.</Label>
                <Input
                  id="eta_client_trn"
                  value={form.eta_tax_registration_number ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, eta_tax_registration_number: e.target.value || null }))}
                />
              </div>
              <div>
                <Label htmlFor="eta_client_governorate">Governorate</Label>
                <Input
                  id="eta_client_governorate"
                  value={form.eta_governorate ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, eta_governorate: e.target.value || null }))}
                />
              </div>
              <div>
                <Label htmlFor="eta_client_region_city">Region / City</Label>
                <Input
                  id="eta_client_region_city"
                  value={form.eta_region_city ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, eta_region_city: e.target.value || null }))}
                />
              </div>
              <div>
                <Label htmlFor="eta_client_street">Street</Label>
                <Input
                  id="eta_client_street"
                  value={form.eta_street ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, eta_street: e.target.value || null }))}
                />
              </div>
              <div>
                <Label htmlFor="eta_client_building">Building number</Label>
                <Input
                  id="eta_client_building"
                  value={form.eta_building_number ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, eta_building_number: e.target.value || null }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createClient.isPending || updateClient.isPending}>
              {editing ? 'Save changes' : 'Add client'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
