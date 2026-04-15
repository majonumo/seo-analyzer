'use client'
// app/hotels/[id]/settings/page.tsx — editar datos del hotel

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Trash2, AlertTriangle } from 'lucide-react'
import { HotelTabNav } from '@/components/hotel/HotelTabNav'
import type { Country, Language, Hotel } from '@/lib/supabase'

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

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

export default function HotelSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params)
  const router    = useRouter()
  const [hotel, setHotel]     = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({
    name: '', url: '', country: 'mx' as Country,
    destination: '', language: 'es' as Language, gsc_property: '',
  })

  useEffect(() => { load() }, [id])

  async function load() {
    const r = await fetch(`/api/hotels/${id}`)
    if (r.ok) {
      const h: Hotel = await r.json()
      setHotel(h)
      setForm({
        name:         h.name,
        url:          h.url,
        country:      h.country,
        destination:  h.destination,
        language:     h.language,
        gsc_property: h.gsc_property ?? '',
      })
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`/api/hotels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, gsc_property: form.gsc_property || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      setHotel(json)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el hotel "${hotel?.name}"?\n\nSe eliminarán TODAS las auditorías, issues, keywords, competidores y reportes asociados. Esta acción es irreversible.`)) return
    setDeleting(true)
    await fetch(`/api/hotels/${id}`, { method: 'DELETE' })
    router.push('/hotels')
  }

  function set(field: string, value: string) { setForm(p => ({ ...p, [field]: value })) }

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-5 h-5 text-zinc-500 animate-spin" /></div>
  if (!hotel)  return <div className="text-red-400 text-sm p-4">Hotel no encontrado</div>

  return (
    <div className="max-w-5xl mx-auto">
      <HotelTabNav hotelId={id} hotelName={hotel.name} hotelUrl={hotel.url} country={hotel.country} />

      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-zinc-100 mb-6">Configuración del hotel</h2>

        {/* Edit form */}
        <form onSubmit={handleSave} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-7 space-y-5 mb-6">
          <Field label="Nombre del hotel *">
            <input value={form.name} onChange={e => set('name', e.target.value)} required className={inputCls} />
          </Field>
          <Field label="URL del sitio web *" hint="Incluyendo https://">
            <input value={form.url} onChange={e => set('url', e.target.value)} required type="url" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="País *">
              <select value={form.country} onChange={e => set('country', e.target.value)} className={inputCls}>
                {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.flag} {c.label}</option>)}
              </select>
            </Field>
            <Field label="Idioma principal *">
              <select value={form.language} onChange={e => set('language', e.target.value)} className={inputCls}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Destino *">
            <input value={form.destination} onChange={e => set('destination', e.target.value)} required placeholder="Tulum" className={inputCls} />
          </Field>
          <Field label="Propiedad GSC" hint="URL exacta como aparece en Google Search Console (opcional)">
            <input value={form.gsc_property} onChange={e => set('gsc_property', e.target.value)} type="url" placeholder="https://hotelboutiquetulum.com/" className={inputCls} />
          </Field>

          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">✓ Cambios guardados</p>}

          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-semibold transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">Zona de peligro</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Eliminar el hotel borrará permanentemente todas sus auditorías, issues, keywords, competidores y reportes de investigación.
          </p>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Eliminar hotel
          </button>
        </div>
      </div>
    </div>
  )
}
