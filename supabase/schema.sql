-- supabase/schema.sql
-- Ejecutar en Supabase > SQL Editor

create table if not exists projects (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  domain             text not null,
  avg_score          integer not null default 0,
  avg_seo            integer not null default 0,
  avg_perf           integer not null default 0,
  total_pages        integer not null default 0,
  completed_at       text not null default '',
  sitemap_url        text,
  audit_urls         jsonb not null default '[]',
  nav_urls           jsonb not null default '[]',
  results            jsonb not null default '[]',
  lighthouse_results jsonb not null default '[]'
);

-- Índice para listar por fecha
create index if not exists projects_created_at_idx on projects (created_at desc);

-- Row Level Security: acceso público (sin auth por ahora)
alter table projects enable row level security;

create policy "public read"   on projects for select using (true);
create policy "public insert" on projects for insert with check (true);
create policy "public delete" on projects for delete using (true);
