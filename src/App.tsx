import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { CompanyProvider, useCompany } from '@/context/CompanyContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import CreateCompany from '@/pages/CreateCompany'
import Transactions from '@/pages/Transactions'
import Budgets from '@/pages/Budgets'
import Clients from '@/pages/Clients'
import Invoices from '@/pages/Invoices'
import InvoiceDetail from '@/pages/InvoiceDetail'
import SettingsPage from '@/pages/Settings'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Reports = lazy(() => import('@/pages/Reports'))

const queryClient = new QueryClient()

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireCompany({ children }: { children: ReactNode }) {
  const { activeCompany, loading } = useCompany()
  if (loading) return <FullScreenLoader />
  if (!activeCompany) return <CreateCompany />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <RequireCompany>
              <Layout />
            </RequireCompany>
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route path="transactions" element={<Transactions />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="clients" element={<Clients />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route
          path="reports"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <Reports />
            </Suspense>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompanyProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </CompanyProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
