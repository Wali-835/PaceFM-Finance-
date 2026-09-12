import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCompany } from '@/context/CompanyContext'
import type { MemberRole } from '@/types/database'

export type Member = {
  role: MemberRole
  user: { id: string; email: string }
}

export type Invite = {
  id: string
  email: string
  role: MemberRole
  created_at: string
}

export function useMembers() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['members', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<Member[]>(`/api/companies/${companyId}/members`),
  })
}

export function useInvites() {
  const { activeCompany } = useCompany()
  const companyId = activeCompany?.id

  return useQuery({
    queryKey: ['invites', companyId],
    enabled: !!companyId,
    queryFn: () => api.get<Invite[]>(`/api/companies/${companyId}/invites`),
  })
}

export function useInviteMember() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { email: string; role: 'admin' | 'member' }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.post<{ status: 'added' | 'pending' }>(`/api/companies/${activeCompany.id}/members`, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
      queryClient.invalidateQueries({ queryKey: ['invites', activeCompany?.id] })
    },
  })
}

export function useUpdateMemberRole() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: MemberRole }) => {
      if (!activeCompany) throw new Error('No active company')
      return api.patch<Member>(`/api/companies/${activeCompany.id}/members/${userId}`, { role })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
    },
  })
}

export function useRemoveMember() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/members/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', activeCompany?.id] })
    },
  })
}

export function useCancelInvite() {
  const { activeCompany } = useCompany()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (inviteId: string) => {
      if (!activeCompany) throw new Error('No active company')
      await api.delete(`/api/companies/${activeCompany.id}/invites/${inviteId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', activeCompany?.id] })
    },
  })
}
