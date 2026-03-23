// app/api/lighthouse/route.ts
// POST /api/lighthouse — llama a PageSpeed Insights de forma independiente.
// Se usa lazy desde LighthousePanel para no bloquear el análisis principal.

import { NextRequest, NextResponse } from 'next/server'
import { analyzeLighthouse } from '@/lib/analyzers/lighthouse'

export const maxDuration = 60 // PSI puede tardar hasta ~40s en URLs lentas

export async function POST(req: NextRequest) {
  let url: string
  try {
    const body = await req.json()
    url = body.url
    if (!url || typeof url !== 'string') throw new Error()
  } catch {
    return NextResponse.json({ available: false, error: 'URL requerida.' }, { status: 400 })
  }

  const result = await analyzeLighthouse(url)
  return NextResponse.json(result, { status: 200 })
}
