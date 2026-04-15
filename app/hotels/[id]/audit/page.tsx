'use client'
// app/hotels/[id]/audit/page.tsx — auditoría SEO con SSE streaming (Sprint 2)

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Construction } from 'lucide-react'

export default function HotelAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/hotels/${id}`} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">Auditoría SEO</h1>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 flex flex-col items-center justify-center text-center">
        <Construction className="w-10 h-10 text-amber-400 mb-4" />
        <p className="text-zinc-300 font-semibold mb-1">Sprint 2 — En desarrollo</p>
        <p className="text-zinc-500 text-sm">Auditoría multi-página con SSE streaming.<br/>
        Por ahora podés usar el <Link href="/" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Audit Tool</Link> en la página principal.</p>
      </div>
    </div>
  )
}
