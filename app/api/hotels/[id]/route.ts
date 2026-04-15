// app/api/hotels/[id]/route.ts — GET + PUT + DELETE individual hotel

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

// ── GET — detalle del hotel con último audit ───────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data: hotel, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Último audit completado
  const { data: lastAudit } = await supabase
    .from('audits')
    .select('id, score, pages_crawled, issues_critical, issues_high, issues_low, completed_at, status')
    .eq('hotel_id', params.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ ...hotel, last_audit: lastAudit ?? null })
}

// ── PUT — actualizar hotel ─────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Ctx) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('hotels')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── DELETE — eliminar hotel ────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('hotels').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
