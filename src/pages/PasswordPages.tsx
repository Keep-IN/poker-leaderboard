import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ErrorText, PageLoader } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorMessage, supabase } from '../lib/supabase'
import { AuthShell, Field } from './AuthPage'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    setSent(true)
  }

  return (
    <AuthShell subtitle="Reset password">
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300">
            Kalau <span className="font-semibold">{email.trim()}</span> terdaftar, link reset password sudah dikirim. Cek
            inbox dan folder spam.
          </p>
          <p className="text-xs text-slate-500">Link hanya berlaku sekali dan akan kedaluwarsa dalam 1 jam.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-slate-400">Masukkan email akun kamu. Kami akan mengirim link untuk membuat password baru.</p>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} className="w-full">
            Kirim link reset
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link to="/login" className="font-semibold text-gold-400">
          ‹ Kembali ke login
        </Link>
      </p>
    </AuthShell>
  )
}

/** Opened from the reset email link (Supabase signs the user in with a recovery session), or by a logged-in user. */
export function ResetPassword() {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [linkError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_description'))
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) return setError('Konfirmasi password tidak sama')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(errorMessage(error))
    navigate('/', { replace: true })
  }

  if (authLoading) return <PageLoader />

  if (!session)
    return (
      <AuthShell subtitle="Reset password">
        <div className="space-y-4 text-center">
          <ErrorText>
            {linkError ? 'Link reset sudah tidak berlaku atau sudah pernah dipakai.' : 'Buka halaman ini dari link di email reset password.'}
          </ErrorText>
          <Link to="/forgot-password" className="inline-block text-sm font-semibold text-gold-400">
            Kirim link baru
          </Link>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell subtitle="Buat password baru">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-400">
          Akun: <span className="font-semibold text-slate-200">{session.user.email}</span>
        </p>
        <Field
          label="Password baru"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <Field
          label="Ulangi password baru"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={6}
          required
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full">
          Simpan password
        </Button>
      </form>
    </AuthShell>
  )
}
