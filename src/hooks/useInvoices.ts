import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Invoice, InvoiceItem, InvoiceStatus } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export type InvoiceWithTotals = Invoice & {
  total: number
  subtotal: number
  tax_amount: number
  client_name: string | null
}

export function useInvoices() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['invoices', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<InvoiceWithTotals[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, clients(name), invoice_totals(subtotal, tax_amount, total)')
        .eq('company_id', companyId!)
        .order('issue_date', { ascending: false })
      if (error) throw error
      return (data as unknown as Array<Invoice & {
        clients: { name: string } | null
        invoice_totals: { subtotal: number; tax_amount: number; total: number } | null
      }>).map((row) => ({
        ...row,
        client_name: row.clients?.name ?? null,
        subtotal: row.invoice_totals?.subtotal ?? 0,
        tax_amount: row.invoice_totals?.tax_amount ?? 0,
        total: row.invoice_totals?.total ?? 0,
      }))
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoice', id],
    enabled: !!id,
    queryFn: async (): Promise<{ invoice: Invoice; items: InvoiceItem[] }> => {
      const [invoiceRes, itemsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id!).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id!).order('position'),
      ])
      if (invoiceRes.error) throw invoiceRes.error
      if (itemsRes.error) throw itemsRes.error
      return { invoice: invoiceRes.data, items: itemsRes.data }
    },
  })
}

export interface InvoiceItemInput {
  description: string
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
  items: InvoiceItemInput[]
}

export function useCreateInvoice() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: InvoiceInput) => {
      if (!activeCompany) throw new Error('No active company')
      const { items, ...invoiceFields } = input
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({ company_id: activeCompany.id, ...invoiceFields })
        .select()
        .single()
      if (error) throw error

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(
          items.map((item, position) => ({ ...item, invoice_id: invoice.id, position })),
        )
        if (itemsError) throw itemsError
      }
      return invoice
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
      const { items, ...invoiceFields } = input
      const { error } = await supabase.from('invoices').update(invoiceFields).eq('id', id)
      if (error) throw error

      const { error: deleteError } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', id)
      if (deleteError) throw deleteError

      if (items.length > 0) {
        const { error: itemsError } = await supabase.from('invoice_items').insert(
          items.map((item, position) => ({ ...item, invoice_id: id, position })),
        )
        if (itemsError) throw itemsError
      }
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
      const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
      if (error) throw error
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
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', activeCompany?.id] })
    },
  })
}
