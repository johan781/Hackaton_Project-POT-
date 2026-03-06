import * as XLSX from 'xlsx'

const TIPO_LABELS = {
  tension_vertical:    'Tensión Vertical',
  compresion_vertical: 'Compresión Vertical',
  carga_lateral:       'Carga Lateral',
}

export function exportToExcel(analysis) {
  const wb = XLSX.utils.book_new()
  const { proyecto, puntos = [] } = analysis

  // ── Sheet 1: Resumen ejecutivo ─────────────────────────────────────────────
  const resumenRows = [
    ['INFORME POT — PULL OUT TEST'],
    ['Proyecto:', proyecto?.nombre],
    ['Cliente:', proyecto?.cliente],
    ['Ubicación:', proyecto?.ubicacion],
    ['Fecha:', proyecto?.fecha],
    [],
    ['RESUMEN DE RESULTADOS'],
    ['Punto ID', 'Prof. (m)', 'Tipo Perfil', 'Fecha Ensayo', 'Estado',
     'Tensión V. — Desp. máx (mm)', 'Tensión V. — Carga máx (kN)',
     'Compresión V. — Desp. máx (mm)', 'Compresión V. — Carga máx (kN)',
     'Carga Lateral — Desp. máx (mm)', 'Carga Lateral — Carga máx (kN)'],
  ]

  for (const p of puntos) {
    const byTipo = Object.fromEntries((p.ensayos || []).map(e => [e.tipo, e]))
    const tv = byTipo.tension_vertical
    const cv = byTipo.compresion_vertical
    const cl = byTipo.carga_lateral
    resumenRows.push([
      p.punto_id,
      p.profundidad_m,
      p.tipo_perfil || '',
      p.fecha_ensayo || '',
      p.cumple_criterio ? 'CUMPLE' : 'REQUIERE REDISEÑO',
      tv?.desplazamiento_maximo_mm ?? '',
      tv?.carga_maxima_kn ?? '',
      cv?.desplazamiento_maximo_mm ?? '',
      cv?.carga_maxima_kn ?? '',
      cl?.desplazamiento_maximo_mm ?? '',
      cl?.carga_maxima_kn ?? '',
    ])
  }

  resumenRows.push([])
  resumenRows.push(['CRITERIOS DE ACEPTACIÓN'])
  resumenRows.push(['Desplazamiento máximo de falla:', '< 25 mm'])
  resumenRows.push(['(cumple_criterio = true si el ensayo no alcanzó los 25 mm de desplazamiento)'])

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [18, 10, 14, 14, 20, 22, 20, 24, 22, 22, 20].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── One sheet per punto ───────────────────────────────────────────────────
  for (const p of puntos) {
    const rows = [
      [`PUNTO: ${p.punto_id}`],
      ['Profundidad hincado:', p.profundidad_m, 'm'],
      ['Tipo de perfil:', p.tipo_perfil || '—'],
      ['Fecha ensayo:', p.fecha_ensayo || '—'],
      ['Coordenadas:', p.coordenadas || '—'],
      ['Estado:', p.cumple_criterio ? 'CUMPLE CRITERIO ✓' : 'REQUIERE REDISEÑO ✗'],
      ['Observaciones:', p.observaciones || '—'],
      [],
    ]

    for (const ensayo of p.ensayos || []) {
      const tipoLabel = TIPO_LABELS[ensayo.tipo] || ensayo.tipo
      rows.push([`ENSAYO — ${ensayo.nombre || tipoLabel}`])
      rows.push(['Carga máxima:', ensayo.carga_maxima_kgf, 'kgf', ensayo.carga_maxima_kn, 'kN'])
      rows.push(['Desp. máximo:', ensayo.desplazamiento_maximo_mm, 'mm'])
      rows.push(['Cumple criterio:', ensayo.cumple_criterio ? 'SI ✓' : 'NO ✗ (falla a 25 mm)'])
      rows.push([])
      rows.push(['#', 'Desplazamiento (mm)', 'Fuerza (kg)', 'Fuerza (kN)', 'Rigidez K (kN/mm)'])

      for (const [i, pt] of (ensayo.puntos || []).entries()) {
        rows.push([
          i + 1,
          pt.desplazamiento_mm ?? '',
          pt.fuerza_kg ?? '',
          pt.fuerza_kn ?? '',
          pt.rigidez_kn_mm ?? '',
        ])
      }
      rows.push([])
      rows.push([])
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [6, 20, 16, 14, 18].map(w => ({ wch: w }))
    const sheetName = p.punto_id.replace(/[\/\\?*\[\]]/g, '-').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  const filename = `POT_${(proyecto?.nombre || 'Informe').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
