# SEO Analyzer

Herramienta de diagnóstico rápido de SEO on-page y performance.  
Ingresá una URL → obtené scores, issues accionables y un reporte exportable.

## Stack
- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Cheerio** (parsing HTML server-side)
- **Zod** (validación)
- **jsPDF + html2canvas** (export PDF)
- **SheetJS** (export Excel)

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env.local

# 3. Correr en desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Estructura

```
app/               → Páginas y API routes (Next.js App Router)
components/        → Componentes React por dominio
lib/
  analyzers/       → Lógica de análisis SEO y Performance
  exporters/       → Lógica de exportación (PDF, Excel, HTML)
  types.ts         → Tipos TypeScript (fuente de verdad)
  scoring.ts       → Cálculo de scores y helpers de UI
  utils.ts         → Utilidades generales
spec/              → Documentación spec-driven
```

## Spec

Toda la documentación de producto y técnica está en `/spec`.

```
spec/
├── README.md
├── docs/
│   ├── PRD.md
│   ├── USER_STORIES.md
│   └── DESIGN_SYSTEM.md
├── features/
│   ├── SEO_MODULE.md
│   ├── PERFORMANCE_MODULE.md
│   ├── DASHBOARD.md
│   ├── ISSUES.md
│   └── EXPORT.md
└── technical/
    ├── ARCHITECTURE.md
    ├── API_CONTRACTS.md
    └── ROADMAP.md
```

## Deploy

```bash
# Vercel (recomendado)
npx vercel

# Build manual
npm run build
npm start
```
