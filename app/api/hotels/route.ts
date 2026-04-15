// app/api/hotels/route.ts — GET (lista) + POST (crear hotel)

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Hotel } from '@/lib/supabase'

// ── GET — lista de hoteles ─────────────────────────────────────────────────────

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── POST — crear hotel ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Partial<Omit<Hotel, 'id' | 'created_at' | 'updated_at'>>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { name, url, country, destination, language, gsc_property } = body
  if (!name || !url || !country || !destination) {
    return NextResponse.json({ error: 'Faltan campos requeridos: name, url, country, destination' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('hotels')
    .insert({ name, url, country, destination, language: language ?? 'es', gsc_property: gsc_property ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
