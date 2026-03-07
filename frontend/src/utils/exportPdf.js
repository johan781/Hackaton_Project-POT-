import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas-pro'

const DISP_SATISFACTORIO = 15.0
const DISP_REDISENO = 25.4

// Palette: #797979, #fd9c10, #f2f2f2, #000000, #1a1a1a
const C_GRAY = [121, 121, 121]
const C_ORANGE = [253, 156, 16]
const C_LIGHT = [242, 242, 242]
const C_BLACK = [0, 0, 0]
const C_DARK = [26, 26, 26]

const TIPO_LABEL = {
  tension_vertical: 'Tensión Vertical',
  compresion_vertical: 'Compresión Vertical',
  carga_lateral: 'Carga Lateral'
}

async function captureChart(chartId) {
  const element = document.getElementById(chartId)
  if (!element) return null

  const svgDimensions = Array.from(element.querySelectorAll('svg')).map(svg => {
    const rect = svg.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (_clonedDoc, clonedElement) => {
        const clonedSvgs = Array.from(clonedElement.querySelectorAll('svg'))
        clonedSvgs.forEach((svg, i) => {
          const dims = svgDimensions[i]
          if (dims && dims.width > 0) {
            svg.setAttribute('width', String(dims.width))
            svg.setAttribute('height', String(dims.height))
          }
        })
      },
    })
    return canvas.toDataURL('image/png')
  } catch (err) {
    console.error('Error capturando chart', chartId, err)
    return null
  }
}

export async function exportToPdf(analysis, filename, extra = {}) {
  const { proyecto, puntos = [] } = analysis
  const { pct = null, satisf = null, noDeform = null, rediseno = null, puntoEstadoMap = null, loadSet = null } = extra

  // Intentamos cargar el logo de assets públicos
  let logoBase64 = null
  try {
    const res = await fetch('/logo.png')
    if (res.ok) {
      const blob = await res.blob()
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
    }
  } catch (err) {
    console.warn('No se pudo cargar el logo', err)
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.width
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  let currentY = margin

  if (logoBase64) {
    const logoW = 40
    const logoH = 12
    pdf.addImage(logoBase64, 'PNG', margin, currentY, logoW, logoH)
    currentY += logoH + 8
  }

  // --- PORTADA Y CABECERA ---
  pdf.setFontSize(10)
  pdf.setTextColor(...C_GRAY) // #797979
  pdf.text('INFORME POT — PULL OUT TEST', margin, currentY)

  currentY += 8
  pdf.setFontSize(22)
  pdf.setTextColor(...C_DARK) // #1a1a1a
  pdf.setFont('helvetica', 'bold')
  pdf.text(proyecto?.nombre || 'Sin nombre de proyecto', margin, currentY)

  currentY += 6
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(...C_GRAY) // #797979
  const metaLine = [proyecto?.cliente, proyecto?.ubicacion, proyecto?.fecha].filter(Boolean).join(' · ')
  pdf.text(metaLine || 'Datos generales no definidos', margin, currentY)

  // --- RESUMEN DE INDICADORES ---
  currentY += 12
  autoTable(pdf, {
    startY: currentY,
    theme: 'plain',
    margin: { left: margin },
    tableWidth: contentWidth,
    head: [['Total Puntos', 'Casos Satisfactorios', 'Requiere Rediseño', 'Cumplimiento (%)']],
    body: [[
      puntos.length.toString(),
      satisf !== null ? satisf.toString() : 'N/A',
      rediseno !== null ? rediseno.toString() : 'N/A',
      pct !== null ? `${pct}%` : 'N/A',
    ]],
    headStyles: { fontStyle: 'bold', fontSize: 10, textColor: C_DARK, fillColor: C_LIGHT }, // #1a1a1a, #f2f2f2
    bodyStyles: { fontSize: 12, textColor: C_BLACK } // #000000
  })

  currentY = pdf.lastAutoTable.finalY + 12

  // --- TABLA RESUMEN DE PUNTOS ---
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...C_ORANGE) // #fd9c10
  pdf.text('Resumen General de Puntos', margin, currentY)
  currentY += 4

  const summaryBody = puntos.map(p => {
    const estadoStr = puntoEstadoMap && puntoEstadoMap[p.punto_id]
      ? puntoEstadoMap[p.punto_id].replace(/_/g, ' ')
      : 'no evaluado'

    const tVertical = p.ensayos?.find(e => e.tipo === 'tension_vertical')?.carga_maxima_kn || 'N/A'
    const cVertical = p.ensayos?.find(e => e.tipo === 'compresion_vertical')?.carga_maxima_kn || 'N/A'
    const lateral = p.ensayos?.find(e => e.tipo === 'carga_lateral')?.carga_maxima_kn || 'N/A'

    return [
      p.punto_id,
      p.profundidad_m || '-',
      estadoStr.toUpperCase(),
      tVertical,
      cVertical,
      lateral
    ]
  })

  autoTable(pdf, {
    startY: currentY,
    theme: 'plain',
    head: [['Punto', 'Prof. (m)', 'Evaluación', 'Tens. V (kN)', 'Comp. V (kN)', 'Lateral (kN)']],
    body: summaryBody,
    styles: { fontSize: 9, cellPadding: 2, textColor: C_BLACK },
    headStyles: { fillColor: C_ORANGE, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C_LIGHT }
  })

  currentY = pdf.lastAutoTable.finalY + 15

  // --- DETALLES DE CADA PUNTO ---
  for (const p of puntos) {
    if (currentY > 260) {
      pdf.addPage()
      currentY = margin
    }

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...C_DARK) // #1a1a1a
    pdf.text(`Punto Analizado: ${p.punto_id}`, margin, currentY)

    currentY += 6
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C_GRAY) // #797979

    const details = []
    if (p.profundidad_m) details.push(`Profundidad: ${p.profundidad_m}m`)
    if (p.tipo_perfil) details.push(`Tipo de perfil: ${p.tipo_perfil}`)
    if (p.fecha_ensayo) details.push(`Fecha: ${p.fecha_ensayo}`)
    if (p.coordenadas) details.push(`Coordenadas: ${p.coordenadas}`)

    pdf.text(details.join(' | '), margin, currentY)
    currentY += 6
    if (p.observaciones) {
      pdf.text(`Observaciones: ${p.observaciones}`, margin, currentY)
      currentY += 6
    }

    // ITERAR SOBRE SUS ENSAYOS
    for (const e of (p.ensayos || [])) {
      if (currentY > 230) {
        pdf.addPage()
        currentY = margin
      }

      const tipoLbl = TIPO_LABEL[e.tipo] || e.tipo
      currentY += 4
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...C_ORANGE) // #fd9c10
      pdf.text(`Ensayo: ${tipoLbl} (Max: ${e.carga_maxima_kn || '?'} kN)`, margin, currentY)
      currentY += 4

      // chartId references the explicitly rendered hidden charts in AnalysisReport
      const chartId = `pdf-chart-${p.punto_id}-${e.tipo}`
      const base64Chart = await captureChart(chartId)

      if (base64Chart) {
        const imgHeight = 60
        if (currentY + imgHeight > 280) {
          pdf.addPage()
          currentY = margin
        }
        pdf.addImage(base64Chart, 'PNG', margin, currentY, contentWidth, imgHeight)
        currentY += imgHeight + 6
      } else {
        pdf.setFontSize(9)
        pdf.setTextColor(...C_GRAY)
        pdf.text('(Gráfico no disponible o colapsado en la vista)', margin, currentY)
        currentY += 6
      }

      const rawDataBody = (e.puntos || []).map((pt, i) => [
        (i + 1).toString(),
        pt.desplazamiento_mm || '-',
        pt.fuerza_kg || '-',
        pt.fuerza_kn || '-',
        pt.rigidez_kn_mm || '-'
      ])

      if (rawDataBody.length > 0) {
        autoTable(pdf, {
          startY: currentY,
          theme: 'grid',
          head: [['Paso', 'Desplazamiento (mm)', 'Fuerza (kgf)', 'Fuerza (kN)', 'Rigidez (kN/mm)']],
          body: rawDataBody,
          styles: { fontSize: 8, cellPadding: 1.5, textColor: C_BLACK, lineColor: [220, 220, 220] },
          headStyles: { fillColor: C_LIGHT, textColor: C_DARK, fontStyle: 'bold' },
          margin: { left: margin + 5, right: margin + 5 }
        })
        currentY = pdf.lastAutoTable.finalY + 10
      }
    }

    currentY += 8
  }

  // --- FOOTER PAGINATION ---
  const pageCount = pdf.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(...C_GRAY)
    pdf.text(`Página ${i} de ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.height - 10)
  }

  pdf.save(filename || 'POT_Informe_Detallado.pdf')
}
