# Hotel Intelligence Platform — Spec Técnico Completo
> Documento de referencia para Claude Code. Versión 2.0 — Abril 2026.
> Este archivo debe estar en la raíz del proyecto como `SPEC.md` durante todo el desarrollo.
> Leerlo completo antes de escribir cualquier código.

---

## 1. Visión General

Sistema de inteligencia hotelera multi-sitio hosteable en Vercel + Supabase, que reemplaza
Semrush y otras herramientas SaaS de pago para gestión de SEO técnico, análisis competitivo
OTA y monitoreo de mercado hotelero en México / USA / Francia.

**Usuarios objetivo:** Equipo propio (1-5 personas). No es un SaaS público.

**Filosofía:** Todo gratis en tier inicial. Sin DataForSEO. Sin Semrush. Sin Ahrefs. Sin Airbnb.
Sin Inngest en el MVP — se agrega cuando se necesite programación automática.

**Punto de partida:** El proyecto `seo-analyzer` ya existente (Next.js + Supabase + Gemini +
PageSpeed API) que tiene auditoría por página, Lighthouse, scoring, y guardado en Supabase.
NO partir de cero ni del boilerplate nextbase. Extender lo que ya existe.

**Mercados:** México (es-MX) · USA (en-US) · Francia (fr-FR)

---

## 2. Decisiones de Arquitectura MVP

### Auditorías — Manual primero, programado después

**MVP (ahora):** Auditorías disparadas manualmente desde la UI.
El crawl multi-página usa SSE (Server-Sent Events) para mostrar progreso en tiempo real
sin exceder el timeout de Vercel. Página por página, resultado en vivo.

**Futuro (cuando escale):** Agregar Inngest para programación mensual automática.
Inngest es gratis (50k steps/mes), se registra en inngest.com con GitHub, y las keys
van en el `.env`. En desarrollo local: `npx inngest-cli dev` sin keys.

### Por qué SSE resuelve el problema de Vercel

Vercel mata funciones a los 10 segundos (Hobby plan). Un crawl de 50 páginas tarda 3-5 min.
SSE resuelve esto: el servidor procesa una página, envía el resultado al frontend, procesa
la siguiente, y así. Cada operación individual dura menos de 10 segundos. La conexión SSE
se mantiene viva mientras el servidor sigue enviando datos.

```
Usuario → "Run Audit" → /api/audit/stream (SSE)
  → fetch sitemap → lista de URLs
  → por cada URL:
      analizar página → send evento al frontend → frontend actualiza UI en vivo
  → al terminar: guardar resumen en Supabase
  → UI muestra resultado completo
```

### Delta — Por auditoría, no semanal

Los deltas comparan la auditoría actual vs la auditoría anterior del mismo hotel.
Se calculan automáticamente al completar cada auditoría, no en un cron separado.
La tabla se llama `deltas` (no `weekly_deltas`).

---

## 3. Stack Tecnológico

### Lo que ya existe en el proyecto seo-analyzer
| Componente | Tecnología | Estado |
|---|---|---|
| Framework | Next.js + TypeScript + Tailwind | ✅ Funcionando |
| Base de datos | Supabase (PostgreSQL) | ✅ Conectado |
| Auth | Supabase Auth | ❌ Falta agregar |
| Auditoría por página | Analizadores propios (SEO + performance) | ✅ Funcionando |
| Lighthouse / CWV | PageSpeed Insights API | ✅ Funcionando |
| Scoring | Sistema propio 0-100 | ✅ Funcionando |
| Proyectos guardados | Tabla `projects` en Supabase | ✅ Básico |
| UI components | shadcn/ui + Tailwind | ✅ Configurado |
| Gemini AI | Google AI Studio (gemini-1.5-flash) | ✅ Conectado |

### Lo que hay que agregar
| Componente | Tecnología | Notas |
|---|---|---|
| Multi-hotel | Refactor de `projects` a `hotels` | Extender schema |
| Crawl multi-página | SSE streaming + parsers propios | Sin CLI externo |
| Hreflang checker | Parser propio en TypeScript | Crítico MX/US/FR |
| GSC integration | Google Search Console API | Gratis |
| OTA competitors | Scraping Booking.com vía Bright Data | Ya instalado como skill |
| Charts | Recharts | Instalar |
| Markdown rendering | react-markdown + remark-gfm | Para reportes |
| Programación mensual | Inngest (futuro, no MVP) | Ver sección 9 |

### Variables de entorno completas
```env
# ── Supabase ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=           # ya existe
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # ya existe — REGENERAR (estaba expuesta en zip)
SUPABASE_SERVICE_ROLE_KEY=          # agregar

# ── PageSpeed Insights ────────────────────────────────────
PAGESPEED_API_KEY=                  # ya existe — REGENERAR

# ── Google AI Studio (Gemini) ─────────────────────────────
GEMINI_API_KEY=                     # ya existe — REGENERAR

# ── Google Search Console ─────────────────────────────────
GOOGLE_GSC_CLIENT_EMAIL=            # agregar cuando se implemente GSC
GOOGLE_GSC_PRIVATE_KEY=             # agregar cuando se implemente GSC

# ── App ───────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Futuro: Inngest (cuando se agregue programación mensual)
# INNGEST_EVENT_KEY=
# INNGEST_SIGNING_KEY=
# CRON_SECRET=
```

⚠️ **IMPORTANTE:** Las keys del `.env.local` estaban en el zip compartido y deben
regenerarse antes de cualquier deploy o commit.
- Supabase: Settings → API → Regenerate anon key
- Google Cloud Console: Credentials → regenerar PageSpeed key
- Google AI Studio: API Keys → regenerar Gemini key

---

## 4. Claude Code Skills Instaladas

Estas skills están en `~/.claude/skills/` y se usan desde el terminal de Claude Code
para el trabajo de investigación y análisis que alimenta el sistema.

### Stack de investigación y análisis estratégico
```bash
# Deep Research — investigación profunda de mercados
~/.claude/skills/deep-research/
# Repo: 199-biotechnologies/claude-deep-research-skill
# Modos: quick (3-5 min) | standard (5-10 min) | deep (10-20 min) | ultradeep (20-45 min)
# Ejemplo: "deep research standard: mercado hotelero boutique Tulum 2025-2026"
# Ejemplo: "deep research: regulaciones STR licencias París Francia 2025"

# Strategic analysis — Porter's 5 Forces, SWOT, Blue Ocean, BCG, decision-matrix
# Plugin: /plugin marketplace add lyndonkl/claude  (85 skills)
# Ejemplo: "competitive analysis: SWOT 3 hoteles más cercanos a [propiedad]"
# Ejemplo: "Blue Ocean Strategy: posicionamiento directo vs Booking/Expedia"
# Ejemplo: "decision-matrix: comprar vs desarrollar vs operar [propiedad]"

# Business strategy — pricing, GTM, content strategy, roadmap
# Plugin: /plugin marketplace add maigentic/stratarts  (27 skills)
# Ejemplo: "pricing-strategy-architect: estructura de precios vs OTAs [destino]"
# Ejemplo: "go-to-market-planner: estrategia direct booking hotel boutique México"
```

### Stack SEO técnico (Claude Code terminal)
```bash
# Auditoría técnica completa con frameworks
~/.claude/skills/tech-seo-audit/
# Repo: Suganthan-Mohanadasan/tech-seo-audit-skill
# Cubre: H1/titles/meta duplicados, hreflang, canonicals,
#        redirects chains, schema, CWV, mobile, security headers

# Scripts Python para checks específicos
~/.claude/skills/agentic-seo/
# Repo: Bhanunamikaze/Agentic-SEO-Skill
# Scripts disponibles:
#   broken_links.py   → detectar links 404
#   internal_links.py → estructura de linking interno
#   redirect_checker.py → chains y loops
#   parse_html.py     → extracción de elementos SEO
#   pagespeed.py      → Core Web Vitals
#   robots_checker.py → validar robots.txt
#   social_meta.py    → OG + Twitter cards
# Hreflang: valida BCP-47, bidireccionalidad, x-default
# Sitemap: detecta URLs 404, redirigidas, con noindex
# Ejemplo: "Validate hreflang on https://hotel.com — BCP-47, bidirectional, x-default"
# Ejemplo: "Audit sitemap quality for https://hotel.com and flag errors"
```

### Stack SEO contenido y keywords (sin pagar nada)
```bash
# SEO/GEO skills — standalone, cero dependencias, sin API keys requeridas
# Install: npx skills add aaron-he-zhu/seo-geo-claude-skills
# Skills incluidas:
#   keyword-research    → research sin API, usando SERP público
#   competitor-analysis → analizar competidores de blog
#   content-gap         → qué temas faltan vs competidores
#   technical-seo-checker → auditoría técnica básica
#   on-page-seo-auditor → auditoría on-page por URL
#   internal-linking-optimizer → optimizar estructura de links
#   rank-tracker        → seguimiento de posiciones
# Ejemplo: "keyword-research: variantes 'hotel boutique Tulum' sin API"
# Ejemplo: "content-gap: qué ángulo de contenido falta vs top 3 competidores"

# Blog skills — escritura SEO + auditoría + detección de canibalización
# Plugin: /plugin marketplace add AgriciDaniel/claude-blog
# Comandos:
#   /blog write [keyword]         → artículo optimizado Google + AI citations
#   /blog content-gap [tema]      → análisis de gap vs SERP
#   /blog cannibalization [url]   → detectar solapamiento de keywords
#   /blog seo-check [url]         → auditoría on-page completa
#   /blog brief [keyword]         → brief para escritura
#   /blog calendar [destino]      → calendario editorial
#   /blog rewrite [url]           → reescribir post existente
#   /blog schema [url]            → agregar structured data

# Google Search Console MCP — datos reales gratis
# Repo: github.com/ahonn/mcp-server-gsc
# Configurar en claude_desktop_config.json
# Ejemplo desde Claude Code: "Dame keywords posición 6-20 con >50 impresiones
#   y CTR <3% en [propiedad GSC] en los últimos 90 días"
```

### Stack competitive intelligence OTA
```bash
# Live scraping de OTAs y web de competidores
# Plugin: /plugin marketplace add brightdata/skills
# Casos de uso hoteleros:
#   → Scraping de precios Booking.com de competidores
#   → Cambios en web/messaging de hoteles competidores
#   → Análisis de reviews y ratings en OTAs
#   → Monitoring de ofertas especiales de competidores
# Ejemplo: "Compare pricing: hoteles competidores de [hotel] en Booking.com [destino]"
# Ejemplo: "Analyze competitor [URL]: cambios en pricing, messaging, ofertas este mes"
# IMPORTANTE: Sin Airbnb — solo Booking.com, Expedia, sitios directos
```

### Flujos de trabajo integrados (Claude Code → Supabase dashboard)

**Flujo 2 — Monitoreo mensual OTA (manual desde terminal)**
```bash
# Cada mes, ejecutar en Claude Code:
"Compare pricing: 5 competidores de [hotel] en Booking.com [destino] this month"
"Analyze competitor changes: [URL competidor 1], [URL competidor 2] vs last month"
"deep research quick: hospitality & hotel news [destino] last 30 days"
# → Guardar resultados como research_report en el dashboard via UI
```

**Flujo 3 — Due diligence de propiedad (manual)**
```bash
# Ejecutar en Claude Code antes de decisión de inversión:
"deep research standard: regulaciones hoteleras STR licencias impuestos [ciudad] 2025"
"competitive analysis: SWOT 3 hoteles boutique más cercanos a [URL/dirección propiedad]"
"decision-matrix: comprar vs desarrollar vs operar propiedad en [destino]
  con datos: [RevPAR zona, precio propiedad, regulaciones encontradas]"
# → Export como Investment Memo → guardar como research_report en dashboard
```

**Flujo 4 — Auditoría técnica SEO (desde UI del dashboard)**
```
Usuario → dashboard → hotel → tab "Auditoría" → botón "Run Audit"
→ SSE streaming: muestra progreso URL por URL en tiempo real
→ Issues guardados en Supabase al completar
→ Score calculado y guardado
→ Delta calculado vs auditoría anterior → mostrado en UI
```

**Flujo 5 — Quick wins keywords (desde UI)**
```
Usuario → dashboard → hotel → tab "Keywords"
→ Botón "Sync GSC" → pull últimos 90 días de GSC API
→ Tab "Quick wins": posición 6-20, >50 impresiones, CTR <3%
→ Lista de keywords con oportunidad de mejora accionable
→ Link directo: "Optimizar este post" → abre blog skill en Claude Code
```

**Flujo 6 — Análisis SEO competitivo de blog (Claude Code terminal)**
```bash
# Todo gratis, sin Semrush ni DataForSEO:
# 1. GSC MCP → quick wins reales del sitio
"keywords posición 6-20 con >50 impresiones y CTR <3% en [propiedad GSC]"
# 2. seo-geo-skills → gap vs competidores
"content-gap: top 3 competidores de blog hotelero en [destino] vs nuestro contenido"
# 3. brightdata → scrapear posts que rankean
"scrape content: top 3 resultados Google para [keyword hotelera]"
# 4. blog/write → artículo optimizado
"/blog write [keyword] — optimizado para hotelería [destino], idioma [es/en/fr]"
# 5. blog/cannibalization → verificar no compite con posts existentes
"/blog cannibalization --sitemap [URL sitemap hotel]"
```

---

## 5. Schema de Base de Datos (Supabase)

Migración `002_hotel_schema.sql` — reemplaza la tabla `projects` existente.
Si hay datos en `projects`, exportarlos primero con `SELECT * FROM projects`.

```sql
-- ═══════════════════════════════════════════════════════════════
-- HOTELES — propiedades gestionadas
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE hotels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  country       TEXT NOT NULL CHECK (country IN ('mx', 'us', 'fr')),
  destination   TEXT NOT NULL,   -- 'Tulum' | 'Miami' | 'Paris' | 'Cancún' | etc.
  language      TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en', 'fr')),
  gsc_property  TEXT,            -- URL exacta de la propiedad en GSC (opcional)
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- COMPETIDORES OTA por hotel (sin Airbnb)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE competitors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID REFERENCES hotels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('booking', 'expedia', 'direct', 'other')),
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- AUDITORÍAS técnicas SEO
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE audits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID REFERENCES hotels(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  score            INTEGER CHECK (score >= 0 AND score <= 100),
  pages_crawled    INTEGER DEFAULT 0,
  issues_critical  INTEGER DEFAULT 0,
  issues_high      INTEGER DEFAULT 0,
  issues_low       INTEGER DEFAULT 0,
  triggered_by     TEXT DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled')),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- ISSUES individuales detectados por auditoría
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID REFERENCES audits(id) ON DELETE CASCADE,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  -- SEO on-page:
  --   'missing_title' | 'long_title' | 'duplicate_title'
  --   'missing_meta_desc' | 'long_meta_desc' | 'duplicate_meta_desc'
  --   'missing_h1' | 'duplicate_h1' | 'missing_h2'
  --   'missing_canonical' | 'wrong_canonical'
  --   'noindex_accidental' | 'missing_og' | 'missing_schema'
  -- Técnicos:
  --   'broken_link' | 'redirect_chain' | 'redirect_loop'
  --   'sitemap_error' | 'orphan_page'
  -- Internacionalización (crítico para MX/US/FR):
  --   'hreflang_missing' | 'hreflang_no_xdefault'
  --   'hreflang_not_bidirectional' | 'hreflang_wrong_code'
  -- Contenido:
  --   'duplicate_content' | 'thin_content'
  --   'missing_alt' | 'missing_img_dimensions'
  -- Performance:
  --   'blocking_scripts' | 'large_html' | 'large_dom' | 'missing_viewport'
  severity        TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'low')),
  url             TEXT NOT NULL,
  description     TEXT,
  recommendation  TEXT,
  current_value   TEXT,    -- valor actual (ej: "título de 75 caracteres")
  expected_value  TEXT,    -- valor esperado (ej: "máximo 60 caracteres")
  fixed           BOOLEAN DEFAULT false,
  fixed_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- DELTAS — diferencias entre auditoría actual y anterior
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE deltas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  audit_id        UUID REFERENCES audits(id) ON DELETE CASCADE,
  prev_audit_id   UUID REFERENCES audits(id),
  type            TEXT NOT NULL,
  -- 'score_change' | 'new_issue' | 'fixed_issue'
  -- 'new_page' | 'removed_page'
  -- 'price_change' | 'ranking_change' | 'keyword_opportunity'
  description     TEXT NOT NULL,
  previous_value  TEXT,
  current_value   TEXT,
  impact          TEXT CHECK (impact IN ('positive', 'negative', 'neutral')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- PRECIOS OTA de competidores (scraping manual mensual)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE competitor_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  competitor_id   UUID REFERENCES competitors(id) ON DELETE CASCADE,
  price_usd       NUMERIC(10,2),
  price_local     NUMERIC(10,2),
  currency        TEXT DEFAULT 'USD',
  room_type       TEXT,
  check_in        DATE,
  check_out       DATE,
  platform        TEXT NOT NULL,
  scraped_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- KEYWORDS de Google Search Console
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE keywords (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID REFERENCES hotels(id) ON DELETE CASCADE,
  keyword      TEXT NOT NULL,
  position     NUMERIC(5,2),
  clicks       INTEGER DEFAULT 0,
  impressions  INTEGER DEFAULT 0,
  ctr          NUMERIC(5,4),
  date         DATE NOT NULL,
  country      TEXT,
  device       TEXT CHECK (device IN ('desktop', 'mobile', 'tablet')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hotel_id, keyword, date, country, device)
);

-- ═══════════════════════════════════════════════════════════════
-- REPORTES de investigación (Deep Research + análisis estratégico)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE research_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID REFERENCES hotels(id),  -- null = reporte global de destino
  destination  TEXT,
  type         TEXT NOT NULL,
  -- 'market_analysis'   → análisis de mercado / destino
  -- 'competitor_intel'  → inteligencia competitiva OTA
  -- 'ota_strategy'      → estrategia anti-OTA / direct booking
  -- 'due_diligence'     → due diligence de propiedad para inversión
  -- 'content_strategy'  → estrategia de contenido / blog / SEO
  -- 'monthly_news'      → news mensuales del destino
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,   -- markdown
  sources      JSONB DEFAULT '[]',  -- [{url, title, date}]
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — solo equipo autenticado
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON hotels FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON competitors FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON audits FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON issues FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON deltas FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON competitor_prices FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON keywords FOR ALL TO authenticated USING (true);
CREATE POLICY "auth_only" ON research_reports FOR ALL TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES para performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_audits_hotel_created   ON audits(hotel_id, created_at DESC);
CREATE INDEX idx_issues_audit           ON issues(audit_id);
CREATE INDEX idx_issues_hotel_type      ON issues(hotel_id, type);
CREATE INDEX idx_issues_pending         ON issues(severity) WHERE fixed = false;
CREATE INDEX idx_deltas_hotel_created   ON deltas(hotel_id, created_at DESC);
CREATE INDEX idx_keywords_hotel_date    ON keywords(hotel_id, date DESC);
CREATE INDEX idx_keywords_quickwins     ON keywords(hotel_id, position)
                                        WHERE position BETWEEN 5 AND 20;
CREATE INDEX idx_prices_hotel           ON competitor_prices(hotel_id, scraped_at DESC);
CREATE INDEX idx_research_hotel_type    ON research_reports(hotel_id, type, created_at DESC);
```

---

## 6. Arquitectura de Auditoría Multi-página (SSE Streaming)

### Endpoint SSE — `app/api/audit/stream/route.ts`

```typescript
export async function POST(req: Request) {
  const { hotelId, url } = await req.json()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)

      try {
        // 1. Crear registro en Supabase
        const { data: audit } = await supabase
          .from('audits')
          .insert({ hotel_id: hotelId, status: 'running', started_at: new Date() })
          .select().single()

        send({ type: 'started', auditId: audit.id })

        // 2. Fetch sitemap → lista de URLs (máx 100)
        send({ type: 'progress', message: 'Obteniendo sitemap...' })
        const urls = await fetchSitemap(url)
        send({ type: 'urls_found', count: urls.length })

        // 3. Analizar cada URL individualmente (cada una < 10 seg ✓)
        const allIssues = []
        for (let i = 0; i < urls.length; i++) {
          send({ type: 'analyzing', url: urls[i], current: i + 1, total: urls.length })
          const issues = await analyzePage(urls[i])
          allIssues.push(...issues)
          send({ type: 'page_done', url: urls[i], issuesFound: issues.length })
        }

        // 4. Guardar issues y calcular score
        await supabase.from('issues').insert(
          allIssues.map(i => ({ ...i, audit_id: audit.id, hotel_id: hotelId }))
        )

        const score = calculateAuditScore(allIssues)
        await supabase.from('audits').update({
          status: 'completed', score,
          pages_crawled: urls.length,
          issues_critical: allIssues.filter(i => i.severity === 'critical').length,
          issues_high: allIssues.filter(i => i.severity === 'high').length,
          issues_low: allIssues.filter(i => i.severity === 'low').length,
          completed_at: new Date()
        }).eq('id', audit.id)

        // 5. Calcular deltas vs auditoría anterior
        await calculateAndSaveDeltas(hotelId, audit.id)

        send({ type: 'completed', auditId: audit.id, score, total: allIssues.length })

      } catch (error) {
        send({ type: 'error', message: error.message })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

### Analizadores — extender los existentes

```
lib/analyzers/
├── index.ts          ← EXISTENTE: re-exportar todo
├── seo.ts            ← EXISTENTE: extender con duplicate_title, duplicate_meta
├── performance.ts    ← EXISTENTE: mantener
├── lighthouse.ts     ← EXISTENTE: mantener
├── sitemap.ts        ← EXISTENTE: extender → validar que URLs dan 200
├── hreflang.ts       ← NUEVO (crítico para MX/US/FR)
└── links.ts          ← NUEVO (broken links + redirect chains)
```

### Scoring de auditoría
```
score = 100
- issues_critical × 10   (descuento máximo: 50 puntos)
- issues_high × 3        (descuento máximo: 30 puntos)
- issues_low × 1         (descuento máximo: 20 puntos)
score = max(0, score)
```

---

## 7. Estructura de Carpetas del Proyecto

```
seo-analyzer/                          ← proyecto existente
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx             ← EXISTENTE o crear
│   │   └── register/page.tsx          ← NUEVO
│   ├── (dashboard)/
│   │   ├── layout.tsx                 ← MODIFICAR: sidebar multi-hotel
│   │   ├── page.tsx                   ← MODIFICAR: overview general
│   │   ├── hotels/
│   │   │   ├── page.tsx               ← NUEVO: lista de hoteles
│   │   │   ├── new/page.tsx           ← NUEVO: formulario nuevo hotel
│   │   │   └── [id]/
│   │   │       ├── page.tsx           ← NUEVO: overview hotel
│   │   │       ├── audit/page.tsx     ← NUEVO: auditoría técnica + SSE
│   │   │       ├── keywords/page.tsx  ← NUEVO: rankings GSC + quick wins
│   │   │       ├── competitors/page.tsx ← NUEVO: precios OTA
│   │   │       └── research/page.tsx  ← NUEVO: reportes markdown
│   │   ├── reports/page.tsx           ← NUEVO: deltas globales
│   │   └── settings/page.tsx          ← NUEVO
│   └── api/
│       ├── audit/
│       │   └── stream/route.ts        ← NUEVO: SSE crawl multi-página
│       ├── hotels/
│       │   ├── route.ts               ← NUEVO: GET/POST
│       │   └── [id]/route.ts          ← NUEVO: GET/PUT/DELETE
│       ├── keywords/
│       │   └── sync/route.ts          ← NUEVO: sync GSC
│       ├── competitors/
│       │   └── route.ts               ← NUEVO
│       ├── research/
│       │   └── route.ts               ← NUEVO
│       ├── projects/route.ts          ← EXISTENTE: mantener durante migración
│       ├── site-audit/                ← EXISTENTE: mantener
│       ├── lighthouse/                ← EXISTENTE: mantener
│       └── site-audit/page/route.ts   ← EXISTENTE: mantener
├── lib/
│   ├── analyzers/
│   │   ├── index.ts                   ← EXISTENTE
│   │   ├── seo.ts                     ← EXISTENTE: extender
│   │   ├── performance.ts             ← EXISTENTE
│   │   ├── lighthouse.ts              ← EXISTENTE
│   │   ├── sitemap.ts                 ← EXISTENTE: extender
│   │   ├── hreflang.ts                ← NUEVO
│   │   └── links.ts                   ← NUEVO
│   ├── gsc/
│   │   └── client.ts                  ← NUEVO: GSC API
│   ├── scoring.ts                     ← EXISTENTE
│   ├── supabase.ts                    ← EXISTENTE: extender types
│   ├── types.ts                       ← EXISTENTE: extender
│   └── utils.ts                       ← EXISTENTE
├── components/
│   ├── ui/                            ← EXISTENTE: shadcn/ui
│   ├── lighthouse/                    ← EXISTENTE
│   ├── shared/                        ← EXISTENTE
│   ├── dashboard/                     ← NUEVO
│   │   ├── hotel-card.tsx
│   │   ├── audit-progress.tsx         ← SSE progress bar en tiempo real
│   │   ├── issues-table.tsx           ← con filtros y mark-as-fixed
│   │   ├── score-history-chart.tsx    ← Recharts line chart
│   │   ├── keywords-table.tsx         ← con tab quick wins
│   │   ├── competitor-prices-table.tsx
│   │   ├── delta-feed.tsx
│   │   └── research-report-view.tsx   ← react-markdown
│   └── layout/
│       ├── sidebar.tsx                ← NUEVO
│       └── header.tsx                 ← NUEVO
├── SPEC.md                            ← ESTE ARCHIVO
└── supabase/
    └── migrations/
        ├── 001_original.sql           ← lo que ya existía
        └── 002_hotel_schema.sql       ← schema de sección 5
```

---

## 8. Páginas del Dashboard — Detalle

### `/` — Overview general
- Cards: hoteles activos, auditorías este mes, issues críticos pendientes, quick wins GSC
- Feed de deltas recientes de todos los hoteles
- Quick actions: "New hotel" | "Run audit" | "Sync GSC"

### `/hotels` — Lista de hoteles
- Tabla: nombre, destino, bandera país, score último audit, issues críticos, fecha
- Filtro por país (MX / US / FR) y destino
- Botón "Add hotel" → formulario

### `/hotels/[id]` — Overview hotel
- Header: nombre, URL, bandera, score con color semáforo
- 4 tabs: Auditoría · Keywords · Competidores · Investigación
- Feed de últimos deltas del hotel

### `/hotels/[id]/audit` — Auditoría técnica SEO
- Score gauge 0-100 (verde ≥80, amarillo 50-79, rojo <50)
- Botón "Run audit" → abre progress bar SSE
  - Muestra: URL siendo analizada, progreso N/total, issues encontrados
- Breakdown por severidad: crítico / alto / bajo
- Tabla de issues: tipo, severidad, URL, descripción, recomendación, "mark as fixed"
- Filtros: tipo de issue, severidad, estado (pendiente/resuelto)
- Line chart: historial de scores de últimas 8 auditorías (Recharts)
- Sección especial "Hreflang" con detalle de errores de internacionalización

### `/hotels/[id]/keywords` — Rankings GSC
- Botón "Sync GSC" → pull manual últimos 90 días
- Tabs: Todas las keywords | Quick wins | Top performers
- **Quick wins** = posición 6-20, impresiones >50, CTR <3%
  - Acción por keyword: "Optimizar contenido" (link con keyword pre-cargada)
- Line chart: evolución de posición de keyword seleccionada
- Selector: 7d / 30d / 90d
- Export CSV

### `/hotels/[id]/competitors` — Precios OTA
- Lista de competidores con plataforma
- Tabla de precios: competidor, habitación, precio, vs mi precio, fecha
- Badge verde/rojo: somos más baratos / más caros
- Historial de precios: line chart Recharts
- "Add competitor" → modal con formulario
- "Scrape now" → trigger manual

### `/hotels/[id]/research` — Reportes de investigación
- Lista de reportes: tipo, título, fecha
- Vista individual con markdown renderizado (react-markdown)
- "New report" → formulario con:
  - Tipo (market analysis / competitor intel / OTA strategy / due diligence / content strategy)
  - Destino / contexto
  - Prompt personalizado pre-cargado según tipo
- Export como .md

### `/reports` — Deltas globales
- Timeline de todos los deltas de todos los hoteles
- Filtros: hotel, tipo, impacto
- Resumen: N issues nuevos, N resueltos, cambios de score

---

## 9. Consideraciones Técnicas

### Seguridad — Keys regenerar AHORA
Las siguientes keys estaban expuestas en el `.env.local` del zip compartido:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase Dashboard → Settings → API → Regenerate
- `PAGESPEED_API_KEY` → Google Cloud Console → Credentials → Eliminar y crear nueva
- `GEMINI_API_KEY` → Google AI Studio → API Keys → Eliminar y crear nueva
- Verificar que `.gitignore` incluye `.env.local` antes del primer commit

### Hreflang — Crítico para MX/US/FR
Los hoteles operan en 3 idiomas (es-MX, en-US, fr-FR). El analizador `hreflang.ts` debe:
- Detectar ausencia total cuando el sitio tiene múltiples idiomas
- Verificar presencia de `x-default` (obligatorio con múltiples idiomas)
- Validar bidireccionalidad: si página ES apunta a FR, la página FR debe apuntar a ES
- Validar códigos BCP-47: `es-MX` no `es`, `en-US` no `en`, `fr-FR` no `fr`
- Detectar `es` genérico cuando debería ser `es-MX` (audiencia diferente)

### Contenido duplicado hotelero
Las páginas de habitaciones son naturalmente similares. Detectar:
- Mismo title tag en páginas de habitaciones distintas
- Misma meta description en múltiples habitaciones
- Bloques de texto con >70% similitud entre páginas de habitaciones

### Límites de Vercel Hobby
- Function timeout: 10 segundos → SSE resuelve esto (cada página individual < 10 seg)
- Bandwidth: 100GB/mes → suficiente
- Cron jobs: disponibles en Hobby para cuando se agregue Inngest

### Límites Supabase Free
- 500MB PostgreSQL → suficiente para 12+ meses con 10-20 hoteles
- 50,000 MAU → no aplica (equipo interno)
- 2GB bandwidth → suficiente

### Futuro: Inngest para programación mensual automática
Cuando el MVP esté validado y se quiera automatizar:
1. Registrarse en inngest.com → gratis, con GitHub, sin tarjeta
2. `pnpm add inngest`
3. Crear `/app/api/inngest/route.ts` (handler)
4. Agregar `INNGEST_EVENT_KEY` y `INNGEST_SIGNING_KEY` al `.env`
5. Crear functions en `/inngest/functions/audit-monthly.ts`
6. Agregar `vercel.json` con cron config mensual
7. En desarrollo local: `npx inngest-cli dev` (funciona sin keys)
8. Free tier: 50,000 steps/mes → con 20 hoteles mensuales ≈ 120 steps (0.2% del límite)

---

## 10. Dependencias a Agregar

```bash
# Charts — scores, keywords, precios históricos
pnpm add recharts

# Markdown rendering — reportes de investigación
pnpm add react-markdown remark-gfm

# XML parsing — sitemaps
pnpm add fast-xml-parser

# Google APIs — Search Console
pnpm add googleapis

# Date utilities
pnpm add date-fns

# Cheerio — ya debería estar en los analizadores existentes
# Si no: pnpm add cheerio @types/cheerio
```

---

## 11. Sprints de Desarrollo

### Sprint 1 — Fundación (Semana 1)
**Objetivo:** Multi-hotel funcionando con auth

- [ ] ⚠️ Regenerar todas las API keys expuestas en el zip
- [ ] Agregar Supabase Auth al proyecto (login + register + middleware)
- [ ] Crear migración `002_hotel_schema.sql` (sección 5 de este spec)
- [ ] API routes CRUD de hoteles
- [ ] UI: lista de hoteles + formulario nuevo hotel
- [ ] Sidebar/layout adaptado para navegación multi-hotel
- [ ] Deploy en Vercel con las nuevas variables de entorno
- [ ] Test: crear 2 hoteles reales, verificar auth funciona

### Sprint 2 — Auditoría Multi-página (Semana 2)
**Objetivo:** Crawl completo con SSE + issues hoteleros

- [ ] SSE endpoint: `app/api/audit/stream/route.ts`
- [ ] Nuevo analizador: `lib/analyzers/hreflang.ts`
- [ ] Nuevo analizador: `lib/analyzers/links.ts` (broken links)
- [ ] Extender `sitemap.ts`: validar URLs con respuesta HTTP
- [ ] UI: progress bar SSE en tiempo real
- [ ] UI: tabla de issues con filtros y "mark as fixed"
- [ ] UI: score gauge + line chart historial (Recharts)
- [ ] Cálculo de deltas al completar auditoría
- [ ] Test completo con un hotel real (auditar sitio completo)

### Sprint 3 — Keywords + Competidores + Research (Semana 3)
**Objetivo:** Sistema completo de inteligencia

- [ ] GSC API client (`lib/gsc/client.ts`) + sync manual
- [ ] UI keywords: tabla + tab quick wins + line chart posición
- [ ] UI competitors: tabla precios + formulario agregar
- [ ] UI research: lista + markdown render + formulario nuevo reporte
- [ ] UI `/reports`: deltas globales timeline
- [ ] UI `/`: overview general con todos los hoteles
- [ ] Export CSV de keywords
- [ ] Polish: loading states, error states, responsive, dark mode
- [ ] Test end-to-end: flujo completo de 2 hoteles reales

---

## 12. Instrucción para Claude Code al inicio de cada sesión

```
Lee SPEC.md completo antes de escribir cualquier código.

Este proyecto es el seo-analyzer existente (Next.js + TypeScript + Tailwind CSS +
Supabase + PageSpeed API + Gemini AI), extendido para convertirse en un sistema de
inteligencia hotelera multi-sitio para los mercados México, USA y Francia.

Reglas de negocio:
- NO usar Airbnb — solo Booking.com, Expedia y sitios directos para OTA
- NO usar Semrush, Ahrefs ni DataForSEO — todo gratis
- NO implementar Inngest todavía — auditorías son manuales con SSE streaming
- Los mercados son México (es-MX), USA (en-US), Francia (fr-FR)
- El hreflang es crítico — siempre validar BCP-47 y bidireccionalidad
- Las auditorías usan SSE para no exceder timeout de Vercel (10 seg por función)
- Los deltas se calculan al completar cada auditoría (no en cron separado)

Stack de código:
- Recharts para todos los charts
- react-markdown para renderizar reportes
- fast-xml-parser para sitemaps
- googleapis para GSC
- SSE (ReadableStream) para crawl multi-página

Skills disponibles en ~/.claude/skills/ para investigación:
- deep-research (199-biotechnologies) — mercados hoteleros
- tech-seo-audit (Suganthan-Mohanadasan) — auditorías técnicas
- agentic-seo (Bhanunamikaze) — scripts Python SEO específicos
- seo-geo-claude-skills (aaron-he-zhu) — keywords sin API
- claude-blog (AgriciDaniel) — contenido y blog SEO
- brightdata/skills — scraping OTA (solo Booking.com y Expedia)
- lyndonkl/claude — análisis estratégico (SWOT, Porter's, Blue Ocean)
- maigentic/stratarts — estrategia de negocio (pricing, GTM)
```

---

*Fin del spec. Versión 2.0 — Abril 2026.*
*Próximo paso inmediato: Sprint 1 — regenerar keys + auth + schema hotelero.*
