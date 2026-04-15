// app/api/audit/[auditId]/issues/[issueId]/route.ts — PATCH: toggle fixed status

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { auditId: string; issueId: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  let body: { fixed: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('issues')
    .update({
      fixed:    body.fixed,
      fixed_at: body.fixed ? new Date().toISOString() : null,
    })
    .eq('id', params.issueId)
    .eq('audit_id', params.auditId)
    .select('id, fixed, fixed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
