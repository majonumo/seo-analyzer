// app/api/audit/[auditId]/issues/route.ts — GET: lista de issues de una auditoría

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { auditId: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('issues')
    .select('id, type, severity, url, description, recommendation, current_value, fixed, fixed_at, created_at')
    .eq('audit_id', params.auditId)
    .order('severity', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
