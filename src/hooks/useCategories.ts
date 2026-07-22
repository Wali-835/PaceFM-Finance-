import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Category, CategoryKind } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useCategories(kind?: CategoryKind) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['categories', companyId, kind],
    enabled: !!companyId,
    queryFn: async (): Promise<Category[]> => {
      let query = supabase.from('categories').select('*').eq('company_id', companyId!)
      if (kind) query = query.eq('kind', kind)
      const { data, error } = await query.order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCreateCategory() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; kind: CategoryKind; color: string }) => {
      if (!activeCompany) throw new Error('No active company')
      const { error } = await supabase.from('categories').insert({
        company_id: activeCompany.id,
        ...input,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
    },
  })
}

export function useDeleteCategory() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
    },
  })
}
