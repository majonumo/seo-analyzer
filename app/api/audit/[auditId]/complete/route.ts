// app/api/audit/[auditId]/complete/route.ts
// POST: recibe los resultados del crawl, guarda issues, calcula score y deltas

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Ctx = { params: { auditId: string } }

interface PageResult {
  url:      string
  issues:   {
    id: string; category: string; severity: 'critical' | 'warning' | 'info'
    title: string; description: string; how_to_fix: string; value?: string
  }[]
}

interface HreflangIssue {
  type: string; severity: 'critical' | 'high' | 'low'
  description: string; recommendation: string
}

interface CompleteBody {
  hotelId:        string
  pageResults:    PageResult[]
  hreflangIssues: HreflangIssue[]
  mainUrl:        string
}

// Mapeo severity existente → severity hotel
function mapSev(s: 'critical' | 'warning' | 'info'): 'critical' | 'high' | 'low' {
  return s === 'critical' ? 'critical' : s === 'warning' ? 'high' : 'low'
}

// Score según spec: 100 - critical×10(max50) - high×3(max30) - low×1(max20)
function calcScore(critical: number, high: number, low: number): number {
  const d = Math.min(critical * 10, 50) + Math.min(high * 3, 30) + Math.min(low, 20)
  return Math.max(0, 100 - d)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: CompleteBody
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { hotelId, pageResults, hreflangIssues, mainUrl } = body
  const auditId = params.auditId
  const supabase = createSupabaseServerClient()

  // ── 1. Construir lista de issues ───────────────────────────────────────────
  const issuesToInsert: {
    audit_id: string; hotel_id: string; type: string
    severity: 'critical' | 'high' | 'low'; url: string
    description: string; recommendation: string
    current_value: string | null
  }[] = []

  for (const page of pageResults) {
    for (const issue of page.issues) {
      issuesToInsert.push({
        audit_id:       auditId,
        hotel_id:       hotelId,
        type:           issue.id,
        severity:       mapSev(issue.severity),
        url:            page.url,
        description:    issue.description,
        recommendation: issue.how_to_fix,
        current_value:  issue.value ?? null,
      })
    }
  }

  // Agregar issues de hreflang (ya vienen con severidad hotel)
  for (const h of hreflangIssues) {
    issuesToInsert.push({
      audit_id:       auditId,
      hotel_id:       hotelId,
      type:           h.type,
      severity:       h.severity,
      url:            mainUrl,
      description:    h.description,
      recommendation: h.recommendation,
      current_value:  null,
    })
  }

  // ── 2. Guardar issues en batch ─────────────────────────────────────────────
  if (issuesToInsert.length > 0) {
    const { error: insertErr } = await supabase.from('issues').insert(issuesToInsert)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // ── 3. Calcular conteos y score ────────────────────────────────────────────
  const critical = issuesToInsert.filter(i => i.severity === 'critical').length
  const high     = issuesToInsert.filter(i => i.severity === 'high').length
  const low      = issuesToInsert.filter(i => i.severity === 'low').length
  const score    = calcScore(critical, high, low)

  // ── 4. Actualizar registro de auditoría ────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('audits')
    .update({
      status:          'completed',
      score,
      pages_crawled:   pageResults.length,
      issues_critical: critical,
      issues_high:     high,
      issues_low:      low,
      completed_at:    new Date().toISOString(),
    })
    .eq('id', auditId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // ── 5. Calcular deltas vs auditoría anterior ───────────────────────────────
  const { data: prevAudit } = await supabase
    .from('audits')
    .select('id, score, pages_crawled, issues_critical')
    .eq('hotel_id', hotelId)
    .eq('status', 'completed')
    .neq('id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (prevAudit) {
    const deltas: {
      hotel_id: string; audit_id: string; prev_audit_id: string
      type: string; description: string
      previous_value: string; current_value: string; impact: string
    }[] = []

    // Score change
    if (prevAudit.score !== null && prevAudit.score !== score) {
      const diff = score - prevAudit.score
      deltas.push({
        hotel_id:       hotelId,
        audit_id:       auditId,
        prev_audit_id:  prevAudit.id,
        type:           'score_change',
        description:    `Score ${diff > 0 ? 'mejoró' : 'empeoró'} ${Math.abs(diff)} puntos`,
        previous_value: String(prevAudit.score),
        current_value:  String(score),
        impact:         diff > 0 ? 'positive' : 'negative',
      })
    }

    // Critical issues change
    if (prevAudit.issues_critical !== critical) {
      const diff = critical - prevAudit.issues_critical
      deltas.push({
        hotel_id:       hotelId,
        audit_id:       auditId,
        prev_audit_id:  prevAudit.id,
        type:           diff > 0 ? 'new_issue' : 'fixed_issue',
        description:    `Issues críticos: ${diff > 0 ? `+${diff} nuevos` : `${diff} resueltos`}`,
        previous_value: String(prevAudit.issues_critical),
        current_value:  String(critical),
        impact:         diff > 0 ? 'negative' : 'positive',
      })
    }

    if (deltas.length > 0) {
      await supabase.from('deltas').insert(deltas)
    }
  }

  return NextResponse.json({ ok: true, score, critical, high, low, total: issuesToInsert.length })
}
