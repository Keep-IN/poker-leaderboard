import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Profile } from './supabase'

/** Akun yang di-suspend dealer: semua request API ditolak database, aplikasi hanya menampilkan alasannya. */
export interface Suspension { reason: string; at: string; by: string | null }

interface AuthState {
  session: Session | null
  profile: Profile | null
  suspended: Suspension | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [suspended, setSuspended] = useState<Suspension | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setSuspended(null)
      return
    }
    const sus = await supabase.rpc('my_suspension')
    setSuspended((sus.data as Suspension | null) ?? null)
    if (sus.data) return setProfile(null)
    const { data } = await supabase.from('profiles').select('id, name, role').eq('id', userId).maybeSingle()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // Defer: calling Supabase inside this callback can deadlock the auth lock.
      setTimeout(() => loadProfile(next?.user.id), 0)
    })
    // cek ulang saat aplikasi dibuka lagi: suspend dari dealer langsung berlaku tanpa perlu login ulang
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data }) => data.session && loadProfile(data.session.user.id))
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [loadProfile])

  const value: AuthState = {
    session,
    profile,
    suspended,
    loading,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut()
      // kursi meja online tersimpan per device: hapus supaya akun berikutnya di device ini tidak memakai kursi akun ini
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('meja:') && k !== 'meja:rt')
          .forEach((k) => localStorage.removeItem(k))
      } catch {
        /* storage tidak tersedia */
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
