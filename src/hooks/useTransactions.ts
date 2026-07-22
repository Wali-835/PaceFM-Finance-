import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CategoryKind, Transaction } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'
import { useAuth } from '@/context/AuthContext'

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
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId!)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters.from) query = query.gte('occurred_on', filters.from)
      if (filters.to) query = query.lte('occurred_on', filters.to)
      if (filters.kind) query = query.eq('kind', filters.kind)
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId)

      const { data, error } = await query
      if (error) throw error
      return data
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
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      if (!activeCompany) throw new Error('No active company')
      const { error } = await supabase.from('transactions').insert({
        company_id: activeCompany.id,
        created_by: user?.id ?? null,
        ...input,
      })
      if (error) throw error
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
      const { error } = await supabase.from('transactions').update(input).eq('id', id)
      if (error) throw error
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
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', activeCompany?.id] })
    },
  })
}
