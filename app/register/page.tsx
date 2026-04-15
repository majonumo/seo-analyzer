'use client'
// app/register/page.tsx — registro de nuevo usuario del equipo

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Loader2, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const router   = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true) }
  }

  if (success) return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <Search className="w-7 h-7 text-emerald-400" />
        </div>
        <h2 className="text-lg font-bold text-zinc-100 mb-2">Revisa tu email</h2>
        <p className="text-sm text-zinc-400 mb-5">Te enviamos un enlace de confirmación a <strong className="text-zinc-200">{email}</strong></p>
        <Link href="/login" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Volver al login →
        </Link>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Search className="w-4 h-4 text-zinc-950" />
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-100">Hotel Intelligence</span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
          <h1 className="text-xl font-bold text-zinc-100 mb-1">Crear cuenta</h1>
          <p className="text-sm text-zinc-500 mb-6">Solo para miembros del equipo</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear cuenta'}
            </button>
          </form>
          <p className="text-center text-xs text-zinc-600 mt-4">
            ¿Ya tenés cuenta? <Link href="/login" className="text-zinc-400 hover:text-zinc-200 transition-colors">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
