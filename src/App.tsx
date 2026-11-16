import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Button, PageLoader } from './components/ui'
import { formatDateTime } from './lib/format'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import AuthPage from './pages/AuthPage'
import CreateMatch from './pages/CreateMatch'
import DuelNew from './pages/DuelNew'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import MatchRoom from './pages/MatchRoom'
import Matches from './pages/Matches'
import MissionNew from './pages/MissionNew'
import Players, { PlayerProfile } from './pages/Players'
import Market from './pages/Market'
import Inventory from './pages/Inventory'
import Gifts from './pages/Gifts'
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
            <Route path="players" element={<Players />} />
            <Route path="players/:id" element={<PlayerProfile />} />
            <Route path="profile" element={<PlayerProfile self />} />
            <Route path="market" element={<Market />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="gifts" element={<Gifts />} />
            <Route path="duel/:opponentId" element={<DuelNew />} />
            <Route path="matches/new" element={<CreateMatch />} />
            <Route path="missions/new" element={<MissionNew />} />
            <Route path="dealer/new" element={<Navigate to="/matches/new" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, suspended } = useAuth()
  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (suspended) return <SuspendedScreen />
  return children
}

/** Akun di-suspend dealer: tidak bisa memakai aplikasi, hanya melihat alasannya lalu keluar. */
function SuspendedScreen() {
  const { suspended, signOut } = useAuth()
  if (!suspended) return null
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <div className="rounded-3xl border border-red-400/40 bg-red-500/10 p-6 text-center">
        <p className="text-5xl">🚫</p>
        <h1 className="mt-3 text-2xl font-extrabold">Akun kamu di-suspend</h1>
        <p className="mt-2 text-sm text-slate-300">Kamu tidak bisa memakai BTP Poker League sampai suspend dicabut oleh dealer.</p>
        <div className="mt-5 rounded-2xl bg-surface-950/60 p-4 text-left">
          <p className="text-xs uppercase tracking-wider text-slate-400">Alasan</p>
          <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-red-200">{suspended.reason}</p>
          <p className="mt-3 text-xs text-slate-400">
            Di-suspend{suspended.by ? ` oleh ${suspended.by}` : ''} · {formatDateTime(suspended.at)}
          </p>
        </div>
      </div>
      <Button variant="ghost" onClick={signOut} className="min-h-12 w-full">
        Keluar
      </Button>
    </div>
  )
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <PageLoader />
  if (session) return <Navigate to="/" replace />
  return children
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-md p-6 pt-20 text-center">
      <p className="text-4xl">♠</p>
      <h1 className="mt-3 text-xl font-bold">Supabase belum dikonfigurasi</h1>
      <p className="mt-2 text-sm text-slate-400">
        Isi <code className="text-brand-300">VITE_SUPABASE_URL</code> dan <code className="text-brand-300">VITE_SUPABASE_KEY</code> di
        file <code>.env</code> (lokal) atau Environment Variables di Vercel. Lihat README.
      </p>
    </div>
  )
}
