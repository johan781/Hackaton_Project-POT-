import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import TrafficLight from './TrafficLight'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react'

const TIPO_META = {
  tension_vertical:    { label: 'Tensión Vertical',    color: '#3B82F6', bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  compresion_vertical: { label: 'Compresión Vertical',  color: '#F59E0B', bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  carga_lateral:       { label: 'Carga Lateral',        color: '#8B5CF6', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
}

function LoadDispChart({ ensayo }) {
  const meta = TIPO_META[ensayo.tipo] || TIPO_META.tension_vertical
  const pts = (ensayo.puntos || []).map(p => ({
    x: p.desplazamiento_mm ?? 0,
    y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
  }))
  if (!pts.length) return <div className="flex items-center justify-center h-36 text-gray-400 text-sm">Sin datos</div>

  const maxX = Math.max(...pts.map(d => d.x), 5)
  const maxY = Math.max(...pts.map(d => d.y), 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={pts} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="x"
          type="number"
          domain={[0, Math.ceil(maxX * 1.1)]}
          label={{ value: 'Desplazamiento (mm)', position: 'insideBottom', offset: -12, fontSize: 10 }}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          domain={[0, Math.ceil(maxY * 1.1)]}
          label={{ value: 'Fuerza (kN)', angle: -90, position: 'insideLeft', fontSize: 10, dy: 40 }}
          tick={{ fontSize: 10 }}
        />
        <Tooltip
          formatter={(v) => [`${v} kN`, 'Fuerza']}
          labelFormatter={(l) => `δ = ${l} mm`}
        />
        <ReferenceLine x={25} stroke="#EF4444" strokeDasharray="5 3"
          label={{ value: '25 mm', fill: '#EF4444', fontSize: 9, position: 'top' }} />
        <Line
          data={pts}
          dataKey="y"
          name="Fuerza"
          stroke={meta.color}
          strokeWidth={2}
          dot={{ r: 3, fill: meta.color }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function EnsayoTable({ puntos = [] }) {
  return (
    <div className="overflow-x-auto rounded border border-gray-200 text-xs">
      <table className="min-w-full">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr>
            <th className="px-3 py-1.5 text-center">#</th>
            <th className="px-3 py-1.5 text-right">Desp. (mm)</th>
            <th className="px-3 py-1.5 text-right">Fuerza (kg)</th>
            <th className="px-3 py-1.5 text-right">Fuerza (kN)</th>
            <th className="px-3 py-1.5 text-right">K (kN/mm)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {puntos.map((p, i) => {
            const overLimit = (p.desplazamiento_mm ?? 0) >= 25
            return (
              <tr key={i} className={overLimit ? 'bg-red-50' : ''}>
                <td className="px-3 py-1 text-center text-gray-400">{i + 1}</td>
                <td className={`px-3 py-1 text-right font-mono ${overLimit ? 'text-red-600 font-bold' : ''}`}>
                  {p.desplazamiento_mm ?? '—'}
                </td>
                <td className="px-3 py-1 text-right font-mono">{p.fuerza_kg ?? '—'}</td>
                <td className="px-3 py-1 text-right font-mono">{p.fuerza_kn ?? '—'}</td>
                <td className="px-3 py-1 text-right font-mono text-gray-400">{p.rigidez_kn_mm ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EnsayoCard({ ensayo }) {
  const [showTable, setShowTable] = useState(false)
  const meta = TIPO_META[ensayo.tipo] || TIPO_META.tension_vertical
  const cumple = ensayo.cumple_criterio
  const dispMax = ensayo.desplazamiento_maximo_mm ?? 0

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cumple
            ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
          <span className="font-semibold text-sm text-gray-800">{ensayo.nombre || meta.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
            {dispMax >= 25 ? `Falla @ ${dispMax} mm` : `Máx. ${dispMax} mm`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{ensayo.carga_maxima_kgf ?? '—'}</span> kgf
            {' / '}
            <span className="font-semibold text-gray-700">{ensayo.carga_maxima_kn ?? '—'}</span> kN
          </span>
          <button onClick={() => setShowTable(v => !v)} className="text-gray-400 hover:text-gray-600">
            {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        <LoadDispChart ensayo={ensayo} />
      </div>

      {showTable && (
        <div className="px-4 pb-4">
          <EnsayoTable puntos={ensayo.puntos || []} />
        </div>
      )}
    </div>
  )
}

function PuntoCard({ punto }) {
  const [expanded, setExpanded] = useState(false)
  const cumple = punto.cumple_criterio
  const ensayos = punto.ensayos || []

  return (
    <div className={`rounded-xl border-2 ${cumple ? 'border-green-200' : 'border-red-200'} bg-white overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${cumple ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-3">
          {cumple
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : <XCircle className="w-5 h-5 text-red-500" />}
          <span className="font-bold text-gray-800 font-mono text-lg">{punto.punto_id}</span>
          <TrafficLight estado={punto.estado} size="sm" />
          {punto.tipo_perfil && (
            <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
              {punto.tipo_perfil}
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600 p-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick stats */}
      <div className="px-5 py-3 flex flex-wrap gap-4 text-sm border-b border-gray-100">
        <span>
          <span className="text-gray-500 text-xs">Profundidad: </span>
          <span className="font-semibold">{punto.profundidad_m ?? '—'} m</span>
        </span>
        {punto.fecha_ensayo && (
          <span>
            <span className="text-gray-500 text-xs">Fecha: </span>
            <span className="font-semibold">{punto.fecha_ensayo}</span>
          </span>
        )}
        {punto.coordenadas && (
          <span>
            <span className="text-gray-500 text-xs">Coord: </span>
            <span className="font-mono text-xs">{punto.coordenadas}</span>
          </span>
        )}
        {/* Per-ensayo compliance badges */}
        {ensayos.map(e => {
          const meta = TIPO_META[e.tipo] || TIPO_META.tension_vertical
          return (
            <span key={e.tipo} className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>
              {meta.label}: {e.cumple_criterio ? 'OK' : `Falla ${e.desplazamiento_maximo_mm ?? '?'} mm`}
            </span>
          )
        })}
        {punto.observaciones && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            {punto.observaciones}
          </span>
        )}
      </div>

      {/* Expanded ensayos */}
      {expanded && (
        <div className="p-5 space-y-5">
          {ensayos.length === 0
            ? <div className="text-gray-400 text-sm text-center py-4">Sin datos de ensayo</div>
            : ensayos.map(e => <EnsayoCard key={e.tipo} ensayo={e} />)
          }
        </div>
      )}
    </div>
  )
}

export default function AnalysisReport({ analysis }) {
  const { proyecto, puntos = [] } = analysis
  const totalEnsayos = puntos.reduce((s, p) => s + (p.ensayos || []).length, 0)
  const cumplen = puntos.filter(p => p.cumple_criterio).length
  const noC = puntos.length - cumplen
  const pct = puntos.length ? Math.round((cumplen / puntos.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-xl text-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Informe POT — Pull Out Test</div>
            <h2 className="text-2xl font-bold">{proyecto?.nombre || 'Sin nombre'}</h2>
            <div className="text-sm opacity-80 mt-1">
              {[proyecto?.cliente, proyecto?.ubicacion, proyecto?.fecha].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black">{pct}%</div>
            <div className="text-xs opacity-70">cumplimiento</div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{puntos.length}</div>
          <div className="text-xs text-gray-500 mt-1">Puntos analizados</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{cumplen}</div>
          <div className="text-xs text-gray-500 mt-1">Cumplen criterio</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{noC}</div>
          <div className="text-xs text-gray-500 mt-1">Requieren rediseño</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{totalEnsayos}</div>
          <div className="text-xs text-gray-500 mt-1">Ensayos totales</div>
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Resumen de Resultados</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Punto</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Prof. (m)</th>
                <th className="px-3 py-2 text-center">Tensión V.</th>
                <th className="px-3 py-2 text-center">Compresión V.</th>
                <th className="px-3 py-2 text-center">Carga Lateral</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {puntos.map((p) => {
                const byTipo = Object.fromEntries((p.ensayos || []).map(e => [e.tipo, e]))
                return (
                  <tr key={p.punto_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-semibold">{p.punto_id}</td>
                    <td className="px-3 py-2"><TrafficLight estado={p.estado} size="sm" /></td>
                    <td className="px-3 py-2 text-right">{p.profundidad_m ?? '—'}</td>
                    {['tension_vertical', 'compresion_vertical', 'carga_lateral'].map(tipo => {
                      const e = byTipo[tipo]
                      if (!e) return <td key={tipo} className="px-3 py-2 text-center text-gray-300 text-xs">N/A</td>
                      const over = (e.desplazamiento_maximo_mm ?? 0) >= 25
                      return (
                        <td key={tipo} className="px-3 py-2 text-center">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {e.desplazamiento_maximo_mm ?? '?'} mm / {e.carga_maxima_kn ?? '?'} kN
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-punto cards */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">Detalle por Punto</h3>
        {puntos.map(p => <PuntoCard key={p.punto_id} punto={p} />)}
      </div>
    </div>
  )
}
