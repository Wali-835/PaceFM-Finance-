import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { api, ApiError } from '@/lib/api'
import type { Company } from '@/types/database'
import { useAuth } from '@/context/AuthContext'

interface CompanyContextValue {
  companies: Company[]
  activeCompany: Company | null
  loading: boolean
  setActiveCompanyId: (id: string) => void
  createCompany: (name: string, currency: string) => Promise<{ error: string | null }>
  updateCompany: (id: string, patch: { name?: string; currency?: string }) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

const ACTIVE_COMPANY_KEY = 'pacefm.activeCompanyId'

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_COMPANY_KEY),
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setCompanies([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await api.get<Company[]>('/api/companies')
      setCompanies(data)
      setActiveCompanyIdState((current) => {
        if (current && data.some((c) => c.id === current)) return current
        if (data.length > 0) {
          localStorage.setItem(ACTIVE_COMPANY_KEY, data[0].id)
          return data[0].id
        }
        return current
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  function setActiveCompanyId(id: string) {
    setActiveCompanyIdState(id)
    localStorage.setItem(ACTIVE_COMPANY_KEY, id)
  }

  async function createCompany(name: string, currency: string) {
    try {
      const company = await api.post<Company>('/api/companies', { name, currency })
      await refresh()
      setActiveCompanyId(company.id)
      return { error: null }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to create company' }
    }
  }

  async function updateCompany(id: string, patch: { name?: string; currency?: string }) {
    try {
      await api.patch(`/api/companies/${id}`, patch)
      await refresh()
      return { error: null }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to update company' }
    }
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null

  return (
    <CompanyContext.Provider
      value={{ companies, activeCompany, loading, setActiveCompanyId, createCompany, updateCompany, refresh }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider')
  return ctx
}
