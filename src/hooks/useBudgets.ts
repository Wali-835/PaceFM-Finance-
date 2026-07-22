import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Budget } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useBudgets(month: string) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['budgets', companyId, month],
    enabled: !!companyId,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('company_id', companyId!)
        .eq('month', month)
      if (error) throw error
      return data
    },
  })
}

export function useUpsertBudget() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { category_id: string; month: string; amount: number }) => {
      if (!activeCompany) throw new Error('No active company')
      const { error } = await supabase
        .from('budgets')
        .upsert(
          { company_id: activeCompany.id, ...input },
          { onConflict: 'company_id,category_id,month' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', activeCompany?.id] })
    },
  })
}
