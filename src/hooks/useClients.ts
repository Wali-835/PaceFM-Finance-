import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Client } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useClients() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['clients', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<Client[]>(`/api/companies/${companyId}/clients`),
  })
}

export interface ClientInput {
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

export function useCreateClient() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ClientInput) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Client>(`/api/companies/${activeCompany.id}/clients`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', activeCompany?.id] })
    },
  })
}

export function useUpdateClient() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: ClientInput & { id: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Client>(`/api/companies/${activeCompany.id}/clients/${id}`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', activeCompany?.id] })
    },
  })
}

export function useDeleteClient() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/clients/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients', activeCompany?.id] })
    },
  })
}
