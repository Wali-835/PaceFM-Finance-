import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Vendor } from '@/types/database'
import { useCompany } from '@/context/CompanyContext'

export function useVendors() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['vendors', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<Vendor[]>(`/api/companies/${companyId}/vendors`),
  })
}

export interface VendorInput {
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

export function useCreateVendor() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: VendorInput) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<Vendor>(`/api/companies/${activeCompany.id}/vendors`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors', activeCompany?.id] })
    },
  })
}

export function useUpdateVendor() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: VendorInput & { id: string }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.put<Vendor>(`/api/companies/${activeCompany.id}/vendors/${id}`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors', activeCompany?.id] })
    },
  })
}

export function useDeleteVendor() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/vendors/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors', activeCompany?.id] })
    },
  })
}
