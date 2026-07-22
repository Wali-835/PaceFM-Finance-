import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CategoryKind, Transaction } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export interface TransactionFilters {
  from?: string
  to?: string
  kind?: CategoryKind
  categoryId?: string
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['transactions', companyId, filters],
    enabled: !!companyId,
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.kind) params.set('kind', filters.kind)
      if (filters.categoryId) params.set('categoryId', filters.categoryId)
      const query = params.toString() ? `?${params.toString()}` : ''
      return api.get<Transaction[]>(`/api/companies/${companyId}/transactions${query}`)
    },
  })
}

export interface TransactionInput {
  account_id: string | null
  category_id: string | null
  kind: CategoryKind
  amount: number
  occurred_on: string
  description: string
}

export function useCreateTransaction() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Transaction>(`/api/companies/${activeCompany.id}/transactions`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] })
    },
  })
}

export function useUpdateTransaction() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Transaction>(`/api/companies/${activeCompany.id}/transactions/${id}`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] })
    },
  })
}

export function useDeleteTransaction() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/transactions/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] })
    },
  })
}
