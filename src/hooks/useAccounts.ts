import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Account, AccountType } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useAccounts() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['accounts', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<Account[]>(`/api/companies/${companyId}/accounts`),
  })
}

export function useCreateAccount() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; type: AccountType; opening_balance: number }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Account>(`/api/companies/${activeCompany.id}/accounts`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeCompany?.id] })
    },
  })
}
