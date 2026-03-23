// app/api/site-audit/urls/route.ts
// GET /api/site-audit/urls?url=https://... — detecta el sitemap y retorna URLs (max 100)

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSitemap } from '@/lib/analyzers/sitemap'

export const maxDuration = 20

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url param is required' }, { status: 400 })
  }

  let normalizedUrl = url.trim()
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  try {
    new URL(normalizedUrl)
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  try {
    const sitemapResult = await analyzeSitemap(normalizedUrl)

    if (!sitemapResult.found) {
      return NextResponse.json({
        found: false,
        urls: [],
        total: 0,
      })
    }

    // Take up to 100 URLs from the sitemap
    const urls = sitemapResult.urls.slice(0, 100).map(u => u.loc)

    return NextResponse.json({
      found: true,
      sitemapUrl: sitemapResult.url,
      urls,
      total: urls.length,
    })
  } catch (err) {
    const error = err as Error
    return NextResponse.json({ error: error.message ?? 'Error al analizar sitemap' }, { status: 500 })
  }
}
