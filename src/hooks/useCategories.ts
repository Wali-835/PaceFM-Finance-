import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Category, CategoryKind } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useCategories(kind?: CategoryKind) {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['categories', companyId, kind],
    enabled: !!companyId,
    queryFn: () => {
      const query = kind ? `?kind=${kind}` : ''
      return api.get<Category[]>(`/api/companies/${companyId}/categories${query}`)
    },
  })
}

export function useCreateCategory() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; kind: CategoryKind; color: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Category>(`/api/companies/${activeCompany.id}/categories`, input)
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
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/categories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', activeCompany?.id] })
    },
  })
}
