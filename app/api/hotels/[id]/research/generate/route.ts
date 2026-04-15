// app/api/hotels/[id]/research/generate/route.ts
// POST: genera un reporte de investigación con Gemini AI

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { ReportType } from '@/lib/supabase'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
const TIMEOUT_MS = 45_000

export const maxDuration = 55

type Ctx = { params: { id: string } }

const TYPE_SYSTEM: Record<ReportType, string> = {
  market_analysis:  'Eres un experto en mercados hoteleros de lujo en México, USA y Francia. Genera un análisis de mercado profundo y accionable.',
  competitor_intel: 'Eres un especialista en inteligencia competitiva hotelera. Analiza la situación competitiva y proporciona insights estratégicos.',
  ota_strategy:     'Eres un estratega de revenue management hotelero. Genera una estrategia para reducir dependencia de OTAs y aumentar reservas directas.',
  due_diligence:    'Eres un consultor de inversión inmobiliaria hotelera. Genera un reporte de due diligence completo con análisis de riesgos.',
  content_strategy: 'Eres un experto en SEO y marketing de contenidos hotelero. Genera una estrategia de contenido orientada a posicionamiento orgánico.',
  monthly_news:     'Eres un analista de mercado hotelero. Resume las noticias y tendencias más relevantes del período y sugiere acciones concretas.',
}

const TYPE_STRUCTURE: Record<ReportType, string> = {
  market_analysis: `
## Análisis de Mercado — {destination}

### Resumen Ejecutivo
[2-3 párrafos sobre el estado actual del mercado]

### Contexto del Destino
- **Tipo de destino:**
- **Segmento dominante:**
- **Temporalidad:**

### Tendencias Clave 2025-2026
1.
2.
3.

### Análisis de Demanda
- Mercados emisores principales:
- Perfil del viajero:
- Duración media de estadía:

### Análisis de Oferta
- Inventario de habitaciones estimado:
- Ocupación media de mercado:
- RevPAR promedio:

### Oportunidades Identificadas
-

### Riesgos y Amenazas
-

### Recomendaciones Estratégicas
1.
2.
3.

### Conclusión
`,
  competitor_intel: `
## Inteligencia Competitiva — {hotel_name}

### Set Competitivo Analizado

### Posicionamiento de Precios
| Competidor | Precio base | Plataforma principal | Estrategia |
|------------|-------------|---------------------|------------|

### Análisis Digital
- **SEO:**
- **Redes sociales:**
- **Experiencia de reserva directa:**

### Estrategias de Marketing Detectadas

### Ventajas Competitivas de {hotel_name}

### Brechas a Aprovechar

### Acciones Recomendadas
`,
  ota_strategy: `
## Estrategia Anti-OTA — {hotel_name}

### Diagnóstico Actual
- Dependencia OTA estimada:
- Principales canales actuales:

### Benchmarks del Sector

### Estrategia de Direct Booking

#### Corto plazo (0-3 meses)
1.
2.

#### Mediano plazo (3-12 meses)
1.
2.

### Tácticas de Paridad de Precios

### Programa de Fidelización

### Tecnología Recomendada
- **Motor de reservas:**
- **CRM:**
- **Email marketing:**

### KPIs Objetivo
| Métrica | Actual | Objetivo 12m |
|---------|--------|--------------|

### ROI Esperado
`,
  due_diligence: `
## Due Diligence — {destination}

### Propiedad Analizada

### Mercado y Ubicación
- **Destino:**
- **Micro-ubicación:**
- **Competencia directa:**

### Marco Regulatorio
- **Licencias requeridas:**
- **Regulaciones STR:**
- **Impuestos hoteleros:**

### Análisis Financiero Estimado
| Métrica | Proyección conservadora | Proyección optimista |
|---------|------------------------|---------------------|
| Ocupación | | |
| ADR | | |
| RevPAR | | |

### Riesgos Identificados
| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|

### Análisis SWOT

### Recomendación Final
`,
  content_strategy: `
## Estrategia de Contenido SEO — {hotel_name}

### Auditoría de Contenido Actual

### Keywords Objetivo
| Keyword | Intención | Volumen est. | Dificultad |
|---------|-----------|-------------|------------|

### Arquitectura de Contenido

#### Páginas Pilares (Evergreen)
1.
2.

#### Clústeres de Contenido

### Calendario Editorial
| Mes | Tema | Formato | Keyword | CTA |
|-----|------|---------|---------|-----|

### Optimización On-Page Prioritaria

### Link Building

### Métricas de Éxito

### Presupuesto Estimado
`,
  monthly_news: `
## Intelligence Report — {destination}
**Período:** {period}

### Headlines del Mercado

### Movimientos de Competidores

### Tendencias de Precios y Ocupación

### Novedades en OTAs y Distribución

### Regulaciones y Normativas

### Acciones Sugeridas para {hotel_name}
| Acción | Urgencia | Responsable |
|--------|----------|-------------|

### Próximo Período — Qué Monitorear
`,
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })
  }

  let body: { type: ReportType; destination?: string; extraContext?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { type, destination, extraContext } = body

  // Obtener datos del hotel
  const supabase = createSupabaseServerClient()
  const { data: hotel } = await supabase
    .from('hotels')
    .select('name, url, country, destination, language')
    .eq('id', params.id)
    .single()

  const dest   = destination || hotel?.destination || 'el destino'
  const hName  = hotel?.name || 'el hotel'
  const period = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  // Armar prompt
  const structure = TYPE_STRUCTURE[type]
    .replace(/{hotel_name}/g, hName)
    .replace(/{destination}/g, dest)
    .replace(/{period}/g, period)

  const systemPrompt = TYPE_SYSTEM[type]

  const userPrompt = `
Hotel: ${hName}
URL: ${hotel?.url ?? 'N/A'}
Destino: ${dest}
Mercado: ${hotel?.country === 'mx' ? 'México' : hotel?.country === 'us' ? 'USA' : 'Francia'}
Idioma principal: ${hotel?.language ?? 'es'}
${extraContext ? `\nContexto adicional del usuario:\n${extraContext}` : ''}

Genera un reporte completo siguiendo EXACTAMENTE esta estructura en markdown.
Rellena todos los campos con información real, específica y accionable.
No uses placeholders vacíos — proporciona contenido real y útil.
Usa datos del sector hotelero de lujo/boutique actualizados a 2025-2026.

ESTRUCTURA A SEGUIR:
${structure}
`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const gemRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature:     0.7,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!gemRes.ok) {
      const err = await gemRes.text()
      return NextResponse.json({ error: `Gemini error: ${gemRes.status} — ${err}` }, { status: 500 })
    }

    const data = await gemRes.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Gemini no devolvió contenido' }, { status: 500 })
    }

    return NextResponse.json({ content: text })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json({ error: msg.includes('abort') ? 'Timeout — intentá de nuevo' : msg }, { status: 500 })
  } finally {
    clearTimeout(timer)
  }
}
