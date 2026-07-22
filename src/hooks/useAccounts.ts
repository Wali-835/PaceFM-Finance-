import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Account, AccountType } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useAccounts() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['accounts', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', companyId!)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateAccount() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; type: AccountType; opening_balance: number }) => {
      if (!activeCompany) throw new Error('No active company')
      const { error } = await supabase.from('accounts').insert({
        company_id: activeCompany.id,
        ...input,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeCompany?.id] })
    },
  })
}
