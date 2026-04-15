// app/api/site-audit/hreflang/route.ts — POST: analiza hreflang de una URL

import { NextRequest, NextResponse } from 'next/server'
import { fetchPage } from '@/lib/analyzers'
import { analyzeHreflang } from '@/lib/analyzers/hreflang'

export const maxDuration = 15

export async function POST(req: NextRequest) {
  let body: { url?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })

  try {
    const { html } = await fetchPage(url)
    const result   = analyzeHreflang(html, url)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, issues: [] }, { status: 200 })
  }
}
