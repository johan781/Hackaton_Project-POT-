import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export async function exportToPdf(elementId, filename) {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
  const scaledW = imgWidth * ratio
  const scaledH = imgHeight * ratio

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
