import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { proyectos as proyectosApi } from '../api/client'
import AnalysisReport from '../components/AnalysisReport'
import { exportToExcel } from '../utils/exportExcel'
import { exportToPdf } from '../utils/exportPdf'
import { ArrowLeft, RefreshCw, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams()
  const [proyecto, setProyecto] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        proyectosApi.get(id),
        proyectosApi.analysis(id).catch(() => null),
      ])
      setProyecto(pRes.data)
      setAnalysis(aRes?.data || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  const handleExcelExport = () => {
    if (analysis) exportToExcel(analysis)
  }

  const handlePdfExport = async () => {
    if (!analysis) return
    setExportingPdf(true)
    setPdfError(null)
    const name = `POT_${(analysis.proyecto?.nombre || proyecto?.nombre || 'Informe').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    try {
      await exportToPdf(analysis, name)
    } catch (e) {
      setPdfError('Error al exportar PDF: ' + e.message)
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) return <div className="p-8 text-brand-gray">Cargando...</div>

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-brand-gray hover:text-brand-dark">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-dark">{proyecto?.nombre}</h1>
            <p className="text-sm text-brand-gray">
              {[proyecto?.cliente, proyecto?.ubicacion].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="text-brand-gray hover:text-brand-dark p-1">
            <RefreshCw className="w-4 h-4" />
          </button>
          {analysis && (
            <>
              <button onClick={handleExcelExport}
                className="flex items-center gap-1.5 text-sm border border-green-200 text-green-700 px-3 py-2 rounded hover:bg-green-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button onClick={handlePdfExport} disabled={exportingPdf}
                className="flex items-center gap-1.5 text-sm border border-red-200 text-red-700 px-3 py-2 rounded hover:bg-red-50 disabled:opacity-50 transition-colors">
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {pdfError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {pdfError}
        </div>
      )}

      {analysis ? (
        <div id="project-report-content">
          <AnalysisReport analysis={analysis} />
        </div>
      ) : (
        <div className="bg-white rounded border border-gray-200 p-10 text-center text-brand-gray">
          <p className="text-lg font-medium mb-1">Sin análisis guardado</p>
          <p className="text-sm">Este proyecto fue creado manualmente o con una versión anterior del sistema.</p>
          <p className="text-sm mt-1">Usa <span className="font-semibold text-brand">Analizar archivo</span> y guarda el resultado para ver el informe completo aquí.</p>
        </div>
      )}
    </div>
  )
}
