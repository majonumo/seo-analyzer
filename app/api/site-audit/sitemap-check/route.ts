// app/api/site-audit/sitemap-check/route.ts
// POST: analiza el sitemap del sitio y devuelve issues en formato hotel

import { NextRequest, NextResponse } from 'next/server'
import { analyzeSitemap } from '@/lib/analyzers/sitemap'

export async function POST(req: NextRequest) {
  let body: { url: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { url } = body
  if (!url) return NextResponse.json({ error: 'Falta url' }, { status: 400 })

  try {
    const result = await analyzeSitemap(url)

    // Mapear checks del sitemap a issues formato hotel
    const issues = result.checks
      .filter(c => c.status !== 'pass')
      .map(c => ({
        type:           `sitemap_${c.id.replace('sitemap-', '')}`,
        severity:       (c.status === 'fail' && c.severity === 'critical'
                          ? 'critical'
                          : c.status === 'fail' ? 'high' : 'low') as 'critical' | 'high' | 'low',
        url,
        description:    c.value ?? c.label,
        recommendation: getSitemapFix(c.id),
      }))

    return NextResponse.json({
      found:      result.found,
      url:        result.url,
      totalUrls:  result.urlCount,
      score:      result.score,
      issues,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

function getSitemapFix(id: string): string {
  const fixes: Record<string, string> = {
    'sitemap-found':      'Crear sitemap.xml en la raíz y declararlo en robots.txt: "Sitemap: https://tudominio.com/sitemap.xml"',
    'sitemap-valid-xml':  'Validar el sitemap en xml-sitemaps.com/validate-xml-sitemap.html y corregir errores de formato',
    'sitemap-has-urls':   'Agregar todas las URLs importantes del sitio al sitemap',
    'sitemap-lastmod':    'Agregar <lastmod> con fecha ISO 8601 a cada URL del sitemap',
    'sitemap-priority':   'Agregar <priority> (0.0–1.0) para indicar la importancia de cada URL',
    'sitemap-warnings':   'Revisar y corregir las advertencias del sitemap para optimizar la indexación',
  }
  return fixes[id] ?? 'Revisar la configuración del sitemap'
}
