import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Budget } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useBudgets(month: string) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['budgets', companyId, month],
    enabled: !!companyId,
    queryFn: () => api.get<Budget[]>(`/api/companies/${companyId}/budgets?month=${month}`),
  })
}

export function useUpsertBudget() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { category_id: string; month: string; amount: number }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Budget>(`/api/companies/${activeCompany.id}/budgets`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', activeCompany?.id] })
    },
  })
}
