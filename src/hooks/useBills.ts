import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Bill, BillItem, BillStatus } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export type BillWithTotals = Bill & {
  total: number
  subtotal: number
  tax_amount: number
  wht_amount: number
  vendor_name: string | null
}

export function useBills() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['bills', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<BillWithTotals[]>(`/api/companies/${companyId}/bills`),
  })
}

export function useBill(id: string | undefined) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['bill', id],
    enabled: !!id && !!companyId,
    queryFn: () =>
      api.get<{ bill: BillWithTotals; items: BillItem[] }>(`/api/companies/${companyId}/bills/${id}`),
  })
}

export interface BillItemInput {
  description: string
  unit: string
  quantity: number
  unit_price: number
}

export interface BillInput {
  vendor_id: string | null
  bill_number: string
  status: BillStatus
  bill_date: string
  due_date: string
  notes: string
  tax_rate: number
  wht_rate: number
  items: BillItemInput[]
}

export function useCreateBill() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: BillInput) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Bill>(`/api/companies/${activeCompany.id}/bills`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', activeCompany?.id] })
    },
  })
}

export function useUpdateBill() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: BillInput & { id: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Bill>(`/api/companies/${activeCompany.id}/bills/${id}`, input)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bills', activeCompany?.id] })
      queryClient.invalidateQueries({ queryKey: ['bill', variables.id] })
    },
  })
}

export function useUpdateBillStatus() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BillStatus }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.patch<Bill>(`/api/companies/${activeCompany.id}/bills/${id}/status`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', activeCompany?.id] })
    },
  })
}

export function useDeleteBill() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/bills/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', activeCompany?.id] })
    },
  })
}
