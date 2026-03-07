import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzer } from '../api/client'
import AnalysisReport from '../components/AnalysisReport'
import { exportToExcel } from '../utils/exportExcel'
import { exportToPdf } from '../utils/exportPdf'
import {
  Upload, FileText, FileSpreadsheet, Loader2,
  Save, Trash2, Download, FileDown, AlertCircle, Bug,
} from 'lucide-react'

const ACCEPTED = '.pdf,.txt,.xlsx,.xls'
const FILE_ICONS = { pdf: FileText, xlsx: FileSpreadsheet, xls: FileSpreadsheet, txt: FileText }

function DebugPanel({ analysis }) {
  const debug = analysis?._debug
  if (!debug) return <div className="text-gray-400 text-sm p-4">No hay datos de debug disponibles.</div>

  return (
    <div className="space-y-4 text-xs font-mono">
      {/* File info */}
      <div className="bg-gray-900 text-green-400 rounded-lg p-4 space-y-1">
        <div className="text-gray-500 uppercase text-xs mb-2">Información del archivo</div>
        <div>Nombre: <span className="text-white">{debug.filename}</span></div>
        <div>Tipo: <span className="text-white">{debug.ext}</span></div>
        <div>Tamaño/Páginas: <span className="text-white">{debug.pages_or_size}</span></div>
      </div>

      {/* Input sent to Claude */}
      {debug.input_preview && (
        <div>
          <div className="text-gray-500 uppercase text-xs mb-1 font-sans">
            Contenido enviado a Claude (primeros 3000 chars)
          </div>
          <pre className="bg-gray-900 text-gray-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-xs max-h-64 overflow-y-auto">
            {debug.input_preview}
          </pre>
        </div>
      )}

      {/* Claude's raw JSON response */}
      <div>
        <div className="text-gray-500 uppercase text-xs mb-1 font-sans">
          Respuesta JSON de Claude
        </div>
        <pre className="bg-gray-900 text-blue-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-xs max-h-96 overflow-y-auto">
          {debug.claude_raw_response || 'Sin respuesta'}
        </pre>
      </div>

      {/* Parsed structure */}
      <div>
        <div className="text-gray-500 uppercase text-xs mb-1 font-sans">
          Estructura JSON parseada (sin _debug)
        </div>
        <pre className="bg-gray-900 text-yellow-300 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all text-xs max-h-96 overflow-y-auto">
          {JSON.stringify({ ...analysis, _debug: undefined }, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle') // idle | uploading | analyzing | done | error
  const [progress, setProgress] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [activeTab, setActiveTab] = useState('report') // report | debug
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setAnalysis(null)
    setError(null)
    setStatus('idle')
    setSavedId(null)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const runAnalysis = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress(0)
    setError(null)
    setAnalysis(null)
    try {
      const res = await analyzer.analyze(file, (e) => {
        if (e.total) {
          setProgress(Math.round((e.loaded / e.total) * 50))
        }
      })
      setStatus('analyzing')
      setProgress(75)
      await new Promise(r => setTimeout(r, 500))
      setAnalysis(res.data)
      setProgress(100)
      setStatus('done')
      setActiveTab('report')
    } catch (e) {
      const data = e.response?.data
      const msg = data?.fix
        ? `${data.error}\n\n${data.fix}`
        : (data?.error || e.message || 'Error desconocido durante el análisis.')
      setError(msg)
      setStatus('error')
    }
  }

  const handleSave = async () => {
    if (!analysis) return
    setSaving(true)
    try {
      const res = await analyzer.save(analysis)
      setSavedId(res.data.id)
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar el proyecto.')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setAnalysis(null)
    setFile(null)
    setStatus('idle')
    setError(null)
    setSavedId(null)
  }

  const handleExcelExport = () => {
    if (analysis) exportToExcel(analysis)
  }

  const handlePdfExport = async () => {
    if (!analysis) return
    setExportingPdf(true)
    setPdfError(null)
    const name = `POT_${(analysis.proyecto?.nombre || 'Informe').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    try {
      // Create 'extra' metadata based on state available in AnalyzePage via AnalysisReport
      // Since AnalysisReport manages the selected LoadSet locally, we can't easily export
      // the true 'pct' from here without lifting state. For now, we export basic analysis data.
      await exportToPdf(analysis, name)
    } catch (e) {
      setPdfError('Error al exportar PDF: ' + e.message)
    } finally {
      setExportingPdf(false)
    }
  }

  const FileIcon = file ? (FILE_ICONS[file.name.split('.').at(-1).toLowerCase()] || FileText) : Upload

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Análisis de Archivo POT</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carga un archivo PDF escaneado, Excel o TXT con datos Pull Out Test — el agente extrae y analiza todo automáticamente.
        </p>
      </div>

      {/* Upload zone */}
      {!analysis && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer
            ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'}
            ${status === 'uploading' || status === 'analyzing' ? 'pointer-events-none opacity-70' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />

          <FileIcon className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-blue-500' : 'text-gray-300'}`} />

          {!file ? (
            <>
              <p className="text-gray-700 font-semibold text-lg">Arrastra tu archivo aquí</p>
              <p className="text-gray-400 text-sm mt-1">o haz clic para seleccionar</p>
              <p className="text-gray-300 text-xs mt-3">Formatos soportados: PDF, XLSX, XLS, TXT</p>
            </>
          ) : (
            <>
              <p className="text-blue-700 font-semibold text-lg">{file.name}</p>
              <p className="text-gray-400 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Listo para analizar</p>
            </>
          )}
        </div>
      )}

      {/* Progress bar */}
      {(status === 'uploading' || status === 'analyzing') && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            {status === 'uploading' ? 'Enviando archivo al servidor...' : 'El agente está analizando el documento con visión IA...'}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400">Esto puede tomar 15-40 segundos según el tamaño del archivo.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold mb-0.5">Error en el análisis</div>
            <div className="whitespace-pre-wrap">{error}</div>
            {error.includes('ANTHROPIC_API_KEY') && (
              <div className="mt-2 text-xs bg-red-100 rounded p-2 font-mono">
                Agrega tu clave en: backend/.env → ANTHROPIC_API_KEY=sk-ant-...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!analysis && (
        <div className="flex gap-3">
          <button onClick={runAnalysis}
            disabled={!file || status === 'uploading' || status === 'analyzing'}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {status === 'uploading' || status === 'analyzing'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Upload className="w-4 h-4" />}
            {status === 'uploading' ? 'Enviando...' : status === 'analyzing' ? 'Analizando...' : 'Analizar archivo'}
          </button>
          {file && status === 'idle' && (
            <button onClick={handleDiscard}
              className="flex items-center gap-2 text-gray-500 border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <Trash2 className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-700">
                Análisis completado — {analysis.puntos?.length || 0} punto(s) extraídos
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {file.name} · {new Date().toLocaleString('es-PE')}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Export Excel */}
              <button onClick={handleExcelExport}
                className="flex items-center gap-1.5 text-sm border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>

              {/* Export PDF */}
              <button onClick={handlePdfExport} disabled={exportingPdf}
                className="flex items-center gap-1.5 text-sm border border-red-200 text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors">
                {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                PDF
              </button>

              {/* Discard */}
              <button onClick={handleDiscard}
                className="flex items-center gap-1.5 text-sm border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <Trash2 className="w-4 h-4" />
                Descartar
              </button>

              {/* Save */}
              {savedId ? (
                <button onClick={() => navigate(`/projects/${savedId}`)}
                  className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                  <Download className="w-4 h-4" />
                  Ver proyecto guardado
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Guardando...' : 'Guardar proyecto'}
                </button>
              )}
            </div>
          </div>

          {pdfError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {pdfError}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === 'report'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="w-4 h-4" />
              Informe
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === 'debug'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Bug className="w-4 h-4" />
              Debug
            </button>
          </div>

          {activeTab === 'report' ? (
            <div id="analysis-report-content">
              <AnalysisReport analysis={analysis} />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Bug className="w-4 h-4 text-orange-500" />
                Panel de Debug — datos crudos extraídos por Claude
              </h3>
              <DebugPanel analysis={analysis} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
