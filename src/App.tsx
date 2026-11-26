import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import Layout from '@/components/Layout'
import { Loading } from '@/components/common'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import AuthPage from '@/pages/AuthPage'
import Dashboard from '@/pages/Dashboard'
import TakeTest from '@/pages/TakeTest'
import AttemptReview from '@/pages/AttemptReview'
import History from '@/pages/History'
import Leaderboard from '@/pages/Leaderboard'
import AdminTests from '@/pages/admin/AdminTests'
import AdminTestDetail from '@/pages/admin/AdminTestDetail'
import AdminUsers from '@/pages/admin/AdminUsers'

function AdminOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <AuthPage />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/test/:id" element={<TakeTest />} />
        <Route path="/attempt/:id" element={<AttemptReview />} />
        <Route path="/history" element={<History />} />
        <Route path="/leaderboard/:id" element={<Leaderboard />} />
        <Route path="/admin" element={<AdminOnly><AdminTests /></AdminOnly>} />
        <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
        <Route path="/admin/tests/:id" element={<AdminOnly><AdminTestDetail /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={250}>
        <HashRouter>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </HashRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}
