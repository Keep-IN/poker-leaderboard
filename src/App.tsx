import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { PageLoader } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import CreateMatch from './pages/CreateMatch'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import MatchRoom from './pages/MatchRoom'
import Matches from './pages/Matches'
import { ForgotPassword, ResetPassword } from './pages/PasswordPages'

export default function App() {
  if (!isConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="matches" element={<Matches />} />
            <Route path="matches/:id" element={<MatchRoom />} />
            <Route path="dealer/new" element={<DealerOnly><CreateMatch /></DealerOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (session) return <Navigate to="/" replace />
  return children
}

function DealerOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return <PageLoader />
  if (profile.role !== 'dealer') return <Navigate to="/" replace />
  return children
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-md p-6 pt-20 text-center">
      <p className="text-4xl">♠</p>
      <h1 className="mt-3 text-xl font-bold">Supabase belum dikonfigurasi</h1>
      <p className="mt-2 text-sm text-slate-400">
        Isi <code className="text-gold-300">VITE_SUPABASE_URL</code> dan <code className="text-gold-300">VITE_SUPABASE_KEY</code> di
        file <code>.env</code> (lokal) atau Environment Variables di Vercel. Lihat README.
      </p>
    </div>
  )
}
