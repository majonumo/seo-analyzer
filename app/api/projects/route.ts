// app/api/projects/route.ts
// GET  /api/projects       → lista todos los proyectos guardados
// POST /api/projects       → guarda un nuevo proyecto

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { ProjectRow } from '@/lib/supabase'

// ── GET — listar proyectos ────────────────────────────────────────────────────

export async function GET() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, created_at, domain, avg_score, avg_seo, avg_perf, total_pages, completed_at, sitemap_url')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET /api/projects]', error)
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST — guardar proyecto ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Omit<ProjectRow, 'id' | 'created_at'>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert(body)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
