'use client'
// app/settings/page.tsx — configuración de la cuenta y la aplicación

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, User, Key, Bell, Shield,
  Loader2, Save, Eye, EyeOff, CheckCircle,
} from 'lucide-react'

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [newPassword, setNewPassword]   = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [savingPw, setSavingPw]         = useState(false)
  const [pwError, setPwError]           = useState('')
  const [pwSaved, setPwSaved]           = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email ?? '')
    })
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) { setPwError('Mínimo 6 caracteres'); return }
    setSavingPw(true); setPwError(''); setPwSaved(false)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwError(error.message); setSavingPw(false); return }
    setPwSaved(true)
    setNewPassword('')
    setTimeout(() => setPwSaved(false), 3000)
    setSavingPw(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top nav */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/hotels" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center">
            <Search className="w-3 h-3 text-zinc-950" />
          </div>
          <span className="text-sm font-bold text-zinc-100">Hotel Intelligence</span>
          <span className="text-zinc-700 text-sm ml-1">/ Configuración</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-100">Configuración</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestioná tu cuenta y preferencias</p>
        </div>

        {/* Account info */}
        <Section
          title="Cuenta"
          description="Información de tu cuenta de acceso"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{userEmail || '—'}</p>
              <p className="text-xs text-zinc-500">Miembro del equipo</p>
            </div>
          </div>
        </Section>

        {/* Change password */}
        <Section
          title="Cambiar contraseña"
          description="Actualizá tu contraseña de acceso"
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {pwError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{pwError}</p>}
            {pwSaved && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Contraseña actualizada
              </p>
            )}
            <button type="submit" disabled={savingPw || !newPassword}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
              {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingPw ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </form>
        </Section>

        {/* Integrations */}
        <Section
          title="Integraciones"
          description="APIs externas conectadas a la plataforma"
        >
          <div className="space-y-3">
            <IntegrationRow
              icon={<Key className="w-4 h-4" />}
              name="Google PageSpeed API"
              envVar="PAGESPEED_API_KEY"
              description="Métricas de performance y Core Web Vitals"
              configured={!!process.env.NEXT_PUBLIC_PAGESPEED_CONFIGURED}
            />
            <IntegrationRow
              icon={<Bell className="w-4 h-4" />}
              name="Gemini AI"
              envVar="GEMINI_API_KEY"
              description="Análisis e investigación con IA generativa"
              configured={!!process.env.NEXT_PUBLIC_GEMINI_CONFIGURED}
            />
            <IntegrationRow
              icon={<Shield className="w-4 h-4" />}
              name="Google Search Console"
              envVar="GOOGLE_GSC_CLIENT_EMAIL"
              description="Sync de keywords y datos de búsqueda"
              configured={false}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-4 border-t border-zinc-800 pt-4">
            Las integraciones se configuran mediante variables de entorno en Vercel o tu archivo <code className="text-zinc-500">.env.local</code>.
          </p>
        </Section>

        {/* Platform info */}
        <Section title="Acerca de">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Plataforma</span>
              <span className="text-zinc-300">Hotel Intelligence v1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Stack</span>
              <span className="text-zinc-300">Next.js 14 · Supabase · Vercel</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Mercados</span>
              <span className="text-zinc-300">🇲🇽 MX · 🇺🇸 US · 🇫🇷 FR</span>
            </div>
          </div>
        </Section>
      </main>
    </div>
  )
}

function IntegrationRow({
  icon, name, envVar, description, configured,
}: {
  icon: React.ReactNode
  name: string
  envVar: string
  description: string
  configured: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200">{name}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${
        configured
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : 'text-zinc-500 bg-zinc-800 border-zinc-700'
      }`}>
        {configured ? 'Conectado' : 'No config.'}
      </span>
    </div>
  )
}
