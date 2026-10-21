import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ErrorText } from '../components/ui'
import { errorMessage, supabase } from '../lib/supabase'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const isRegister = mode === 'register'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Akun dibuat! Cek email kamu untuk konfirmasi, lalu login.')
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex gap-1 text-4xl">
          <span className="text-gold-400">♠</span>
          <span className="text-chip-red">♥</span>
          <span className="text-gold-400">♣</span>
          <span className="text-chip-red">♦</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Poker Night</h1>
        <p className="mt-1 text-sm text-slate-400">{isRegister ? 'Buat akun untuk mulai main' : 'Masuk ke akun kamu'}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {isRegister && (
          <Field label="Nama" value={name} onChange={setName} autoComplete="nickname" maxLength={40} required />
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          minLength={6}
          required
        />

        <ErrorText>{error}</ErrorText>
        {info && <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{info}</p>}

        <Button type="submit" loading={loading} className="w-full">
          {isRegister ? 'Daftar' : 'Masuk'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
        <Link to={isRegister ? '/login' : '/register'} className="font-semibold text-gold-400">
          {isRegister ? 'Masuk' : 'Daftar'}
        </Link>
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-white/10 bg-felt-950/60 px-4 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
        {...rest}
      />
    </label>
  )
}
