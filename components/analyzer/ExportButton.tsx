'use client'
// components/analyzer/ExportButton.tsx

import { useState, useRef } from 'react'
import { Download, FileText, Table, FileCode, ChevronDown } from 'lucide-react'
import type { AnalysisResult } from '@/lib/types'
import { getExportFilename } from '@/lib/utils'

interface Props {
  result: AnalysisResult
}

type ExportFormat = 'pdf' | 'excel' | 'html'
type ExportStatus = 'idle' | 'loading' | 'done' | 'error'

export function ExportButton({ result }: Props) {
  const [open, setOpen]     = useState(false)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [format, setFormat] = useState<ExportFormat | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function handleExport(fmt: ExportFormat) {
    setOpen(false)
    setFormat(fmt)
    setStatus('loading')

    try {
      if (fmt === 'pdf')   await exportPdf(result)
      if (fmt === 'excel') await exportExcel(result)
      if (fmt === 'html')  exportHtml(result)
      setStatus('done')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      console.error('Export error:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const OPTIONS = [
    { id: 'pdf'   as ExportFormat, icon: <FileText  className="w-4 h-4" />, label: 'PDF' },
    { id: 'excel' as ExportFormat, icon: <Table      className="w-4 h-4" />, label: 'Excel (.xlsx)' },
    { id: 'html'  as ExportFormat, icon: <FileCode   className="w-4 h-4" />, label: 'Google Docs (HTML)' },
  ]

  const isLoading = status === 'loading'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isLoading && setOpen(o => !o)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 
                   text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {isLoading ? (
          <span className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
        ) : status === 'done' ? (
          <span className="text-emerald-500">✓</span>
        ) : (
          <Download className="w-4 h-4" />
        )}
        {isLoading ? 'Generando...' : status === 'done' ? 'Descargado' : 'Exportar'}
        {!isLoading && status === 'idle' && <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
            {OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => handleExport(opt.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300
                           hover:bg-zinc-800 hover:text-zinc-100 transition-colors text-left"
              >
                <span className="text-zinc-500">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Export functions ──────────────────────────────────────────────────────────

async function exportPdf(result: AnalysisResult) {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')

  // Create a temporary hidden div with the report content
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 794px; background: #111; color: #fafafa;
    font-family: system-ui, sans-serif; padding: 40px;
  `
  container.innerHTML = buildPdfHtml(result)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 1.5,
      backgroundColor: '#111111',
      logging: false,
    })

    const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW     = pdf.internal.pageSize.getWidth()
    const pageH     = pdf.internal.pageSize.getHeight()
    const ratio     = canvas.width / canvas.height
    const pdfH      = pageW / ratio

    let y = 0
    while (y < canvas.height) {
      if (y > 0) pdf.addPage()
      const remaining = Math.min(canvas.height - y, canvas.height * (pageH / pdfH))
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width  = canvas.width
      pageCanvas.height = remaining
      const ctx = pageCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, -y)
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, pageW, pageW * (remaining / canvas.width))
      y += remaining
    }

    pdf.save(getExportFilename(result.url, 'pdf'))
  } finally {
    document.body.removeChild(container)
  }
}

async function exportExcel(result: AnalysisResult) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()

  // Hoja 1: Resumen
  const summaryData = [
    ['SEO Analyzer — Reporte'],
    [],
    ['URL',                result.url],
    ['Fecha',              new Date().toLocaleDateString('es-AR')],
    ['Score Global',       result.globalScore],
    ['Score SEO',          result.seo.score],
    ['Score Performance',  result.performance.score],
    [],
    ['Issues Críticos',    result.issues.filter(i => i.severity === 'critical').length],
    ['Issues Warnings',    result.issues.filter(i => i.severity === 'warning').length],
    ['Issues Info',        result.issues.filter(i => i.severity === 'info').length],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Resumen')

  // Hoja 2: Issues
  const issuesHeaders = ['Severidad', 'Categoría', 'Issue', 'Descripción', 'Cómo solucionarlo']
  const issuesData = result.issues.map(i => [
    i.severity.toUpperCase(),
    i.category.toUpperCase(),
    i.title,
    i.description,
    i.how_to_fix,
  ])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([issuesHeaders, ...issuesData]), 'Issues')

  // Hoja 3: SEO Checks
  const seoHeaders = ['Check', 'Estado', 'Valor', 'Severidad']
  const seoData = result.seo.checks.map(c => [
    c.label,
    c.status === 'pass' ? '✓ PASS' : c.status === 'warn' ? '⚠ WARN' : '✗ FAIL',
    c.value ?? '',
    c.severity,
  ])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([seoHeaders, ...seoData]), 'SEO Checks')

  // Hoja 4: Performance Checks
  const perfHeaders = ['Check', 'Estado', 'Valor', 'Severidad']
  const perfData = result.performance.checks.map(c => [
    c.label,
    c.status === 'pass' ? '✓ PASS' : c.status === 'warn' ? '⚠ WARN' : '✗ FAIL',
    c.value ?? '',
    c.severity,
  ])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([perfHeaders, ...perfData]), 'Performance Checks')

  XLSX.writeFile(wb, getExportFilename(result.url, 'xlsx'))
}

function exportHtml(result: AnalysisResult) {
  const html = buildPdfHtml(result, true)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = getExportFilename(result.url, 'html')
  a.click()
  URL.revokeObjectURL(a.href)
}

function buildPdfHtml(result: AnalysisResult, standalone = false): string {
  const criticalCount = result.issues.filter(i => i.severity === 'critical').length
  const warningCount  = result.issues.filter(i => i.severity === 'warning').length
  const infoCount     = result.issues.filter(i => i.severity === 'info').length

  const severityColor: Record<string, string> = {
    critical: '#EF4444',
    warning:  '#F59E0B',
    info:     '#6366F1',
  }

  const issuesHtml = result.issues.map(issue => `
    <tr>
      <td style="color:${severityColor[issue.severity]};font-weight:600;text-transform:uppercase;font-size:11px">${issue.severity}</td>
      <td style="text-transform:uppercase;font-size:11px;color:#71717a">${issue.category}</td>
      <td style="font-weight:500">${issue.title}</td>
      <td style="color:#a1a1aa;font-size:12px">${issue.how_to_fix}</td>
    </tr>
  `).join('')

  const body = `
    <div style="font-family:system-ui,sans-serif;max-width:780px;margin:0 auto;color:#fafafa;background:#111;padding:40px">
      <div style="margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <div style="width:32px;height:32px;background:#10B981;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px">🔍</div>
          <span style="font-size:18px;font-weight:600">SEO Analyzer — Reporte</span>
        </div>
        <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:24px">
          <div style="font-size:13px;color:#71717a;margin-bottom:4px">URL analizada</div>
          <div style="font-size:15px;font-weight:500;margin-bottom:16px;word-break:break-all">${result.url}</div>
          <div style="font-size:12px;color:#52525b">Analizado: ${new Date(result.analyzedAt).toLocaleString('es-AR')}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px">
        ${[
          { label: 'Score Global', value: result.globalScore },
          { label: 'Score SEO', value: result.seo.score },
          { label: 'Score Performance', value: result.performance.score },
        ].map(s => `
          <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;padding:20px;text-align:center">
            <div style="font-size:36px;font-weight:700;color:${s.value >= 75 ? '#10B981' : s.value >= 50 ? '#F59E0B' : '#EF4444'}">${s.value}</div>
            <div style="font-size:12px;color:#71717a;margin-top:4px">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:32px">
        <div style="text-align:center;padding:12px;background:#EF444420;border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:#EF4444">${criticalCount}</div>
          <div style="font-size:11px;color:#EF4444">Críticos</div>
        </div>
        <div style="text-align:center;padding:12px;background:#F59E0B20;border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:#F59E0B">${warningCount}</div>
          <div style="font-size:11px;color:#F59E0B">Warnings</div>
        </div>
        <div style="text-align:center;padding:12px;background:#6366F120;border-radius:8px">
          <div style="font-size:24px;font-weight:700;color:#6366F1">${infoCount}</div>
          <div style="font-size:11px;color:#6366F1">Info</div>
        </div>
      </div>

      <h2 style="font-size:16px;font-weight:600;margin-bottom:16px">Issues (${result.issues.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid #2A2A2A">
            <th style="text-align:left;padding:8px 12px 8px 0;color:#71717a;font-weight:500;font-size:11px">SEVERIDAD</th>
            <th style="text-align:left;padding:8px 12px 8px 0;color:#71717a;font-weight:500;font-size:11px">MÓDULO</th>
            <th style="text-align:left;padding:8px 12px 8px 0;color:#71717a;font-weight:500;font-size:11px">ISSUE</th>
            <th style="text-align:left;padding:8px 0;color:#71717a;font-weight:500;font-size:11px">RECOMENDACIÓN</th>
          </tr>
        </thead>
        <tbody>
          ${issuesHtml}
        </tbody>
      </table>
    </div>
  `

  if (!standalone) return body

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>SEO Report — ${result.url}</title>
  <style>body{margin:0;background:#111;color:#fafafa}tr{border-bottom:1px solid #1A1A1A}td{padding:10px 12px 10px 0;vertical-align:top}</style>
</head>
<body>${body}</body>
</html>`
}
