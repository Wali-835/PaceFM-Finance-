import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
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
    const { data, error } = await supabase.from('companies').select('*').order('created_at')
    if (!error && data) {
      setCompanies(data)
      if (!activeCompanyId && data.length > 0) {
        setActiveCompanyIdState(data[0].id)
        localStorage.setItem(ACTIVE_COMPANY_KEY, data[0].id)
      }
    }
    setLoading(false)
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
    if (!user) return { error: 'Not signed in' }
    const { data, error } = await supabase
      .from('companies')
      .insert({ name, currency, created_by: user.id })
      .select()
      .single()
    if (error) return { error: error.message }
    await refresh()
    if (data) setActiveCompanyId(data.id)
    return { error: null }
  }

  async function updateCompany(id: string, patch: { name?: string; currency?: string }) {
    const { error } = await supabase.from('companies').update(patch).eq('id', id)
    if (error) return { error: error.message }
    await refresh()
    return { error: null }
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
