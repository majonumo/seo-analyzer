-- ═══════════════════════════════════════════════════════════════
-- MIGRACIÓN 002 — Hotel Intelligence Platform Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- HOTELES — propiedades gestionadas
CREATE TABLE IF NOT EXISTS hotels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  country       TEXT NOT NULL CHECK (country IN ('mx', 'us', 'fr')),
  destination   TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en', 'fr')),
  gsc_property  TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- COMPETIDORES OTA por hotel
CREATE TABLE IF NOT EXISTS competitors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID REFERENCES hotels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('booking', 'expedia', 'direct', 'other')),
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- AUDITORÍAS técnicas SEO
CREATE TABLE IF NOT EXISTS audits (
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

-- ISSUES individuales detectados por auditoría
CREATE TABLE IF NOT EXISTS issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID REFERENCES audits(id) ON DELETE CASCADE,
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'low')),
  url             TEXT NOT NULL,
  description     TEXT,
  recommendation  TEXT,
  current_value   TEXT,
  expected_value  TEXT,
  fixed           BOOLEAN DEFAULT false,
  fixed_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- DELTAS — diferencias entre auditoría actual y anterior
CREATE TABLE IF NOT EXISTS deltas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  audit_id        UUID REFERENCES audits(id) ON DELETE CASCADE,
  prev_audit_id   UUID REFERENCES audits(id),
  type            TEXT NOT NULL,
  description     TEXT NOT NULL,
  previous_value  TEXT,
  current_value   TEXT,
  impact          TEXT CHECK (impact IN ('positive', 'negative', 'neutral')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- PRECIOS OTA de competidores
CREATE TABLE IF NOT EXISTS competitor_prices (
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

-- KEYWORDS de Google Search Console
CREATE TABLE IF NOT EXISTS keywords (
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

-- REPORTES de investigación
CREATE TABLE IF NOT EXISTS research_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID REFERENCES hotels(id),
  destination  TEXT,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  sources      JSONB DEFAULT '[]',
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

-- Políticas: solo usuarios autenticados
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hotels' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON hotels FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'competitors' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audits' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON audits FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'issues' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deltas' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON deltas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'competitor_prices' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON competitor_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'keywords' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON keywords FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'research_reports' AND policyname = 'auth_only') THEN
    CREATE POLICY "auth_only" ON research_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES para performance
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_audits_hotel_created   ON audits(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_audit           ON issues(audit_id);
CREATE INDEX IF NOT EXISTS idx_issues_hotel_type      ON issues(hotel_id, type);
CREATE INDEX IF NOT EXISTS idx_issues_pending         ON issues(severity) WHERE fixed = false;
CREATE INDEX IF NOT EXISTS idx_deltas_hotel_created   ON deltas(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_hotel_date    ON keywords(hotel_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_quickwins     ON keywords(hotel_id, position) WHERE position BETWEEN 5 AND 20;
CREATE INDEX IF NOT EXISTS idx_prices_hotel           ON competitor_prices(hotel_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_hotel_type    ON research_reports(hotel_id, type, created_at DESC);
