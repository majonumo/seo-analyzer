'use client'
// app/hotels/new/page.tsx — formulario para crear nuevo hotel

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Building2 } from 'lucide-react'
import type { Country, Language } from '@/lib/supabase'

const COUNTRIES: { value: Country; label: string; flag: string }[] = [
  { value: 'mx', label: 'México',  flag: '🇲🇽' },
  { value: 'us', label: 'USA',     flag: '🇺🇸' },
  { value: 'fr', label: 'Francia', flag: '🇫🇷' },
]

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
]

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors'

export default function NewHotelPage() {
  const router = useRouter()
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({
    name: '', url: '', country: 'mx' as Country,
    destination: '', language: 'es' as Language, gsc_property: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          gsc_property: form.gsc_property || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      router.push(`/hotels/${json.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/hotels" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Nuevo hotel</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Agrega una propiedad al sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-7 space-y-5">
        <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-zinc-300">Información del hotel</span>
        </div>

        <Field label="Nombre del hotel *">
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required
            placeholder="Hotel Boutique Tulum"
            className={inputCls}
          />
        </Field>

        <Field label="URL del sitio web *" hint="URL exacta, incluyendo https://">
          <input
            value={form.url}
            onChange={e => set('url', e.target.value)}
            required
            type="url"
            placeholder="https://hotelboutiquetulum.com"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="País *">
            <select
              value={form.country}
              onChange={e => set('country', e.target.value)}
              className={inputCls}
            >
              {COUNTRIES.map(c => (
                <option key={c.value} value={c.value}>{c.flag} {c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Idioma principal *">
            <select
              value={form.language}
              onChange={e => set('language', e.target.value)}
              className={inputCls}
            >
              {LANGUAGES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Destino *" hint="Ciudad o zona turística (ej: Tulum, Miami, París)">
          <input
            value={form.destination}
            onChange={e => set('destination', e.target.value)}
            required
            placeholder="Tulum"
            className={inputCls}
          />
        </Field>

        <Field label="Propiedad de Google Search Console" hint="URL exacta como aparece en GSC (opcional)">
          <input
            value={form.gsc_property}
            onChange={e => set('gsc_property', e.target.value)}
            type="url"
            placeholder="https://hotelboutiquetulum.com/"
            className={inputCls}
          />
        </Field>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Guardando...' : 'Crear hotel'}
          </button>
          <Link href="/hotels"
            className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
