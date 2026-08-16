import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export type InvoiceWithTotals = Invoice & {
  total: number
  subtotal: number
  tax_amount: number
  wht_amount: number
  client_name: string | null
}

export function useInvoices() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['invoices', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<InvoiceWithTotals[]>(`/api/companies/${companyId}/invoices`),
  })
}

export function useInvoice(id: string | undefined) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['invoice', id],
    enabled: !!id && !!companyId,
    queryFn: () =>
      api.get<{ invoice: InvoiceWithTotals; items: InvoiceItem[] }>(
        `/api/companies/${companyId}/invoices/${id}`,
      ),
  })
}

export interface InvoiceItemInput {
  description: string
  unit: string
  quantity: number
  unit_price: number
}

export interface InvoiceInput {
  client_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  notes: string
  tax_rate: number
  wht_rate: number
  items: InvoiceItemInput[]
}

export function useCreateInvoice() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: InvoiceInput) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Invoice>(`/api/companies/${activeCompany.id}/invoices`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompany?.id] })
    },
  })
}

export function useUpdateInvoice() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: InvoiceInput & { id: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Invoice>(`/api/companies/${activeCompany.id}/invoices/${id}`, input)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompany?.id] })
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] })
    },
  })
}

export function useUpdateInvoiceStatus() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InvoiceStatus }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.patch<Invoice>(`/api/companies/${activeCompany.id}/invoices/${id}/status`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompany?.id] })
    },
  })
}

export function useDeleteInvoice() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/invoices/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompany?.id] })
    },
  })
}
