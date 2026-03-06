import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

export async function exportToPdf(elementId, filename) {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  // Capture SVG dimensions from the live DOM before cloning,
  // because html2canvas clones the DOM and recharts SVGs lack explicit
  // width/height attributes (they rely on CSS), which makes them render blank.
  const svgDimensions = Array.from(element.querySelectorAll('svg')).map(svg => {
    const rect = svg.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })

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

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
  const scaledW = imgWidth * ratio

  // Paginate if content is taller than one A4 page
  let yPos = 0
  const pageHeightPx = pdfHeight / ratio

  while (yPos < imgHeight) {
    if (yPos > 0) pdf.addPage()

    const srcY = yPos
    const srcH = Math.min(pageHeightPx, imgHeight - yPos)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = imgWidth
    pageCanvas.height = srcH
    const ctx = pageCanvas.getContext('2d')
    ctx.drawImage(canvas, 0, srcY, imgWidth, srcH, 0, 0, imgWidth, srcH)

    const pageImg = pageCanvas.toDataURL('image/png')
    pdf.addImage(pageImg, 'PNG', 0, 0, scaledW, srcH * ratio)
    yPos += pageHeightPx
  }

  pdf.save(filename || 'POT_Informe.pdf')
}
