import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import TrafficLight from './TrafficLight'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Settings2, Minus } from 'lucide-react'

// ─── Thresholds ────────────────────────────────────────────────────────────────
const DISP_SATISFACTORIO = 15.0   // mm
const DISP_REDISENO = 25.4   // mm

// Estado order for "worst" comparison
const ESTADO_ORDER = ['satisfactorio', 'no_cumple_deformaciones', 'requiere_rediseno']

// ─── Test type metadata ───────────────────────────────────────────────────────
const TIPO_META = {
  tension_vertical: { label: 'Tensión Vertical', color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', loadKey: 'tension_kN' },
  compresion_vertical: { label: 'Compresión Vertical', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', loadKey: 'compresion_kN' },
  carga_lateral: { label: 'Carga Lateral', color: '#8B5CF6', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', loadKey: 'lateral_kN' },
}

// ─── Criteria helpers (ONLY used when a load set is selected) ─────────────────
const CRITERIO_INFO = {
  satisfactorio: {
    label: 'Profundidad de hincado satisfactoria',
    short: `≤ ${DISP_SATISFACTORIO} mm`,
    color: 'text-green-700', bg: 'bg-green-100', icon: 'ok',
  },
  no_cumple_deformaciones: {
    label: `No cumple criterio de deformaciones — requiere rediseño`,
    short: `${DISP_SATISFACTORIO}–${DISP_REDISENO} mm`,
    color: 'text-amber-700', bg: 'bg-amber-100', icon: 'warn',
  },
  requiere_rediseno: {
    label: 'Requiere rediseño',
    short: `> ${DISP_REDISENO} mm`,
    color: 'text-red-700', bg: 'bg-red-100', icon: 'fail',
  },
}

function estadoFromDisp(disp, tipo) {
  if (disp === null) return 'requiere_rediseno'   // force not reached → fail
  if (disp <= DISP_SATISFACTORIO) return 'satisfactorio'
  // Lateral loads: no amber zone — directly requiere rediseño above 15 mm
  if (tipo === 'carga_lateral') return 'requiere_rediseno'
  if (disp <= DISP_REDISENO) return 'no_cumple_deformaciones'
  return 'requiere_rediseno'
}

function worstEstado(estados) {
  return estados.reduce((worst, e) => {
    return ESTADO_ORDER.indexOf(e) > ESTADO_ORDER.indexOf(worst) ? e : worst
  }, 'satisfactorio')
}

function CriterioIcon({ estado, cls = 'w-4 h-4' }) {
  if (estado === 'satisfactorio') return <CheckCircle2 className={`${cls} text-green-500 flex-shrink-0`} />
  if (estado === 'no_cumple_deformaciones') return <AlertTriangle className={`${cls} text-amber-500 flex-shrink-0`} />
  return <XCircle className={`${cls} text-red-500 flex-shrink-0`} />
}

// ─── Interpolation ────────────────────────────────────────────────────────────
function interpolateDisp(pts, targetY) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y >= targetY) {
      const { x: x0, y: y0 } = pts[i - 1]
      const { x: x1, y: y1 } = pts[i]
      if (y1 === y0) return +x0.toFixed(3)
      return +(x0 + (targetY - y0) * (x1 - x0) / (y1 - y0)).toFixed(3)
    }
  }
  return null  // force not reached
}

function buildRefRows(pts, steps, loadKey, tipo) {
  return steps
    .map(s => {
      const designForce = +(s[loadKey] ?? 0)
      if (designForce <= 0) return null
      const interpDisp = interpolateDisp(pts, designForce)
      const estado = estadoFromDisp(interpDisp, tipo)
      return { paso: s.paso, designForce, interpDisp, estado, criterio: CRITERIO_INFO[estado] }
    })
    .filter(Boolean)
}

// ─── Comparison table ─────────────────────────────────────────────────────────
function RefCompareTable({ rows, color }) {
  if (!rows.length) return null
  return (
    <div className="mt-3 overflow-x-auto rounded border border-gray-200 text-xs">
      <table className="min-w-full">
        <thead className="text-gray-500 uppercase text-xs" style={{ backgroundColor: `${color}18` }}>
          <tr>
            <th className="px-3 py-1.5 text-center">Escalón</th>
            <th className="px-3 py-1.5 text-right">Carga diseño (kN)</th>
            <th className="px-3 py-1.5 text-right">Desp. en curva (mm)</th>
            <th className="px-3 py-1.5 text-center">Evaluación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => {
            const c = row.criterio
            return (
              <tr key={row.paso} className={c.bg}>
                <td className="px-3 py-1 text-center text-gray-500 font-mono">{row.paso}</td>
                <td className="px-3 py-1 text-right font-mono font-semibold" style={{ color }}>
                  {row.designForce} kN
                </td>
                <td className={`px-3 py-1 text-right font-mono font-semibold ${c.color}`}>
                  {row.interpDisp !== null ? `${row.interpDisp} mm` : '— no alcanzada'}
                </td>
                <td className="px-3 py-1 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>
                    {row.estado === 'satisfactorio' && <CheckCircle2 className="w-3 h-3" />}
                    {row.estado === 'no_cumple_deformaciones' && <AlertTriangle className="w-3 h-3" />}
                    {row.estado === 'requiere_rediseno' && <XCircle className="w-3 h-3" />}
                    {c.short}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Load-displacement chart ─────────────────────────────────────────────────
function LoadDispChart({ ensayo, refRows }) {
  const meta = TIPO_META[ensayo.tipo] || TIPO_META.tension_vertical

  const pts = (ensayo.puntos || []).map(p => ({
    x: p.desplazamiento_mm ?? 0,
    y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
  }))
  if (!pts.length) return (
    <div className="flex items-center justify-center h-36 text-gray-400 text-sm">Sin datos</div>
  )

  const refPoints = (refRows || [])
    .filter(r => r.interpDisp !== null)
    .map(r => ({ x: r.interpDisp, ref: r.designForce, paso: r.paso }))

  const maxDesign = refRows?.length ? Math.max(...refRows.map(r => r.designForce)) : 0
  const maxX = Math.max(...pts.map(d => d.x), DISP_REDISENO * 1.1)
  const maxY = Math.max(...pts.map(d => d.y), maxDesign, 1)

  const CustomDot = ({ cx, cy, payload }) => {
    if (!payload || payload.ref == null) return null
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#fff" stroke={meta.color} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={2} fill={meta.color} />
      </g>
    )
  }

  return (
    <div id={`chart-${ensayo.punto_id}-${ensayo.tipo}`} style={{ width: '100%', height: '230px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, Math.ceil(maxX * 1.1)]}
            label={{ value: 'Desplazamiento (mm)', position: 'insideBottom', offset: -12, fontSize: 10 }}
            tick={{ fontSize: 10 }}
            allowDuplicatedCategory={false}
          />
          <YAxis
            domain={[0, Math.ceil(maxY * 1.15)]}
            label={{ value: 'Fuerza (kN)', angle: -90, position: 'insideLeft', fontSize: 10, dy: 40 }}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(v, name) => [`${v} kN`, name]}
            labelFormatter={(l) => `δ = ${l} mm`}
          />
          <Legend verticalAlign="top" height={26} iconSize={10} wrapperStyle={{ fontSize: 10 }} />

          {/* Displacement limit lines (always visible as visual reference) */}
          <ReferenceLine x={DISP_SATISFACTORIO} stroke="#F59E0B" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: `${DISP_SATISFACTORIO} mm`, fill: '#92400E', fontSize: 9, position: 'insideTopLeft' }} />
          <ReferenceLine x={DISP_REDISENO} stroke="#EF4444" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: `${DISP_REDISENO} mm`, fill: '#991B1B', fontSize: 9, position: 'insideTopLeft' }} />

          {/* Measured curve */}
          <Line
            data={pts}
            dataKey="y"
            name="Curva medida"
            stroke={meta.color}
            strokeWidth={2}
            dot={{ r: 3, fill: meta.color }}
            activeDot={{ r: 5 }}
            connectNulls
          />

          {/* Reference load points projected onto the curve */}
          {refPoints.length > 0 && (
            <Line
              data={refPoints}
              dataKey="ref"
              name="Escalones diseño"
              stroke={meta.color}
              strokeWidth={0}
              dot={<CustomDot />}
              activeDot={{ r: 7, strokeWidth: 2 }}
              legendType="circle"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Raw data table ───────────────────────────────────────────────────────────
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
          {puntos.map((p, i) => (
            <tr key={i}>
              <td className="px-3 py-1 text-center text-gray-400">{i + 1}</td>
              <td className="px-3 py-1 text-right font-mono">{p.desplazamiento_mm ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono">{p.fuerza_kg ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono">{p.fuerza_kn ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono text-gray-400">{p.rigidez_kn_mm ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Single test card ─────────────────────────────────────────────────────────
function EnsayoCard({ ensayo, selectedLoadSet }) {
  const [showRawTable, setShowRawTable] = useState(false)
  const meta = TIPO_META[ensayo.tipo] || TIPO_META.tension_vertical

  // Build measured points in kN for interpolation
  const measuredPts = (ensayo.puntos || []).map(p => ({
    x: p.desplazamiento_mm ?? 0,
    y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
  }))

  // Comparison rows and worst estado — ONLY when a load set is selected
  const refRows = selectedLoadSet ? buildRefRows(measuredPts, selectedLoadSet.steps, meta.loadKey, ensayo.tipo) : []
  const hasRef = refRows.length > 0
  const estado = hasRef ? worstEstado(refRows.map(r => r.estado)) : null
  const criterio = estado ? CRITERIO_INFO[estado] : null

  const maxDesign = hasRef ? refRows.at(-1).designForce : null

  return (
    <div className={`rounded-lg border ${meta.border} ${meta.bg} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasRef
            ? <CriterioIcon estado={estado} />
            : <Minus className="w-4 h-4 text-gray-300 flex-shrink-0" />}
          <span className="font-semibold text-sm text-gray-800">{ensayo.nombre || meta.label}</span>
          {hasRef && criterio && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${criterio.bg} ${criterio.color}`}>
              {criterio.short}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{ensayo.carga_maxima_kgf ?? '—'}</span> kgf
            {' / '}
            <span className="font-semibold text-gray-700">{ensayo.carga_maxima_kn ?? '—'}</span> kN
            {maxDesign != null && (
              <span className="ml-2 text-gray-400">
                (diseño máx:{' '}
                <span className={`font-semibold ${(ensayo.carga_maxima_kn ?? 0) >= maxDesign ? 'text-green-600' : 'text-amber-600'}`}>
                  {maxDesign} kN
                </span>)
              </span>
            )}
          </span>
          <button onClick={() => setShowRawTable(v => !v)} className="text-gray-400 hover:text-gray-600">
            {showRawTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Criteria detail — ONLY when a load set is selected */}
      {hasRef && criterio && (
        <div className={`mx-4 mb-2 px-3 py-1.5 rounded text-xs font-medium ${criterio.bg} ${criterio.color}`}>
          {criterio.label}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 pb-2">
        <LoadDispChart ensayo={{ ...ensayo, punto_id: ensayo.punto_id }} refRows={refRows} />
      </div>

      {/* Comparison table — ONLY when a load set is selected */}
      {hasRef && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">
            Comparación con juego de cargas — desplazamiento interpolado de la curva medida
          </p>
          <RefCompareTable rows={refRows} color={meta.color} />
        </div>
      )}

      {/* Raw data table (collapsible) */}
      {showRawTable && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">Datos medidos</p>
          <EnsayoTable puntos={ensayo.puntos || []} />
        </div>
      )}
    </div>
  )
}

// ─── Single point card ────────────────────────────────────────────────────────
function PuntoCard({ punto, selectedLoadSet }) {
  const [expanded, setExpanded] = useState(false)
  const ensayos = punto.ensayos || []

  // Compute per-ensayo estado from refRows — ONLY when a load set is selected
  const ensayoEstados = selectedLoadSet
    ? ensayos.map(e => {
      const meta = TIPO_META[e.tipo] || TIPO_META.tension_vertical
      const measPts = (e.puntos || []).map(p => ({
        x: p.desplazamiento_mm ?? 0,
        y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
      }))
      const rows = buildRefRows(measPts, selectedLoadSet.steps, meta.loadKey, e.tipo)
      return rows.length ? worstEstado(rows.map(r => r.estado)) : 'satisfactorio'
    })
    : []

  const hasRef = selectedLoadSet !== null
  const puntoEstado = hasRef && ensayoEstados.length
    ? worstEstado(ensayoEstados)
    : null

  const borderCls = !hasRef ? 'border-gray-200' :
    puntoEstado === 'satisfactorio' ? 'border-green-200' :
      puntoEstado === 'no_cumple_deformaciones' ? 'border-amber-200' : 'border-red-200'

  const headBg = !hasRef ? 'bg-gray-50' :
    puntoEstado === 'satisfactorio' ? 'bg-green-50' :
      puntoEstado === 'no_cumple_deformaciones' ? 'bg-amber-50' : 'bg-red-50'

  // TrafficLight estado: show computed if hasRef, else 'no_evaluado'
  const tlEstado = hasRef && puntoEstado ? puntoEstado : 'no_evaluado'

  return (
    <div className={`rounded-xl border-2 ${borderCls} bg-white overflow-hidden`}>
      <div className={`px-5 py-3 flex items-center justify-between ${headBg}`}>
        <div className="flex items-center gap-3">
          {hasRef && puntoEstado
            ? <CriterioIcon estado={puntoEstado} cls="w-5 h-5" />
            : <Minus className="w-5 h-5 text-gray-300 flex-shrink-0" />}
          <span className="font-bold text-gray-800 font-mono text-lg">{punto.punto_id}</span>
          <TrafficLight estado={tlEstado} size="sm" />
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
        {/* Per-ensayo badges — only when hasRef */}
        {hasRef && ensayos.map((e, i) => {
          const c = CRITERIO_INFO[ensayoEstados[i]]
          if (!c) return null
          return (
            <span key={e.tipo} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.color}`}>
              {TIPO_META[e.tipo]?.label ?? e.tipo}: {c.short}
            </span>
          )
        })}
        {!hasRef && (
          <span className="text-xs text-gray-400 italic">Selecciona un juego de cargas para evaluar</span>
        )}
        {punto.observaciones && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            {punto.observaciones}
          </span>
        )}
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {ensayos.length === 0
            ? <div className="text-gray-400 text-sm text-center py-4">Sin datos de ensayo</div>
            : ensayos.map(e => <EnsayoCard key={e.tipo} ensayo={{ ...e, punto_id: punto.punto_id }} selectedLoadSet={selectedLoadSet} />)
          }
        </div>
      )}
    </div>
  )
}

// ─── Load-set selector ────────────────────────────────────────────────────────
function LoadSetSelector({ loadSets, selectedId, onChange }) {
  const sel = loadSets.find(l => l.id === selectedId)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Settings2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm text-gray-600 font-medium">Juego de cargas de diseño:</span>
      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="">— Sin referencia —</option>
        {loadSets.map(ls => <option key={ls.id} value={ls.id}>{ls.label}</option>)}
      </select>
      {sel && (() => {
        const last = sel.steps.at(-1)
        return (
          <span className="text-xs text-gray-500">
            (T: {last.tension_kN} kN · C: {last.compresion_kN} kN · L: {last.lateral_kN} kN)
          </span>
        )
      })()}
    </div>
  )
}

// ─── Main report component ────────────────────────────────────────────────────
export default function AnalysisReport({ analysis }) {
  const { proyecto, puntos = [] } = analysis
  const [loadSets, setLoadSets] = useState([])
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    fetch('/cargas_defecto.json')
      .then(r => r.json())
      .then(d => setLoadSets(d.loadSets || []))
      .catch(() => { })
  }, [])

  const selectedLoadSet = loadSets.find(l => l.id === selectedId) || null
  const hasRef = selectedLoadSet !== null

  // KPI counts — only meaningful when a load set is selected
  // Per-punto computed estados (only when a load set is selected)
  const puntoEstadoMap = hasRef
    ? Object.fromEntries(puntos.map(p => {
      const ensayoEstados = (p.ensayos || []).map(e => {
        const meta = TIPO_META[e.tipo] || TIPO_META.tension_vertical
        const measPts = (e.puntos || []).map(pt => ({
          x: pt.desplazamiento_mm ?? 0,
          y: +(((pt.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
        }))
        const rows = buildRefRows(measPts, selectedLoadSet.steps, meta.loadKey, e.tipo)
        return rows.length ? worstEstado(rows.map(r => r.estado)) : 'satisfactorio'
      })
      return [p.punto_id, ensayoEstados.length ? worstEstado(ensayoEstados) : 'satisfactorio']
    }))
    : {}

  const allEstados = Object.values(puntoEstadoMap)
  const satisf = hasRef ? allEstados.filter(e => e === 'satisfactorio').length : null
  const noDeform = hasRef ? allEstados.filter(e => e === 'no_cumple_deformaciones').length : null
  const rediseno = hasRef ? allEstados.filter(e => e === 'requiere_rediseno').length : null
  const pct = hasRef && satisf !== null ? Math.round((satisf / puntos.length) * 100) : null

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
            <div className="text-4xl font-black">{pct !== null ? `${pct}%` : '—'}</div>
            <div className="text-xs opacity-70">
              {pct !== null ? 'hincados satisfactorios' : 'sin juego de cargas'}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{puntos.length}</div>
          <div className="text-xs text-gray-500 mt-1">Puntos analizados</div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${hasRef ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-green-600' : 'text-gray-300'}`}>
            {satisf ?? '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Hincado satisfactorio</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-green-600' : 'text-gray-300'}`}>
            ≤ {DISP_SATISFACTORIO} mm
          </div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${hasRef ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-amber-600' : 'text-gray-300'}`}>
            {noDeform ?? '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">No cumple deformaciones</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-amber-600' : 'text-gray-300'}`}>
            {DISP_SATISFACTORIO}–{DISP_REDISENO} mm
          </div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${hasRef ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-red-600' : 'text-gray-300'}`}>
            {rediseno ?? '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Requiere rediseño</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-red-600' : 'text-gray-300'}`}>
            &gt; {DISP_REDISENO} mm
          </div>
        </div>
      </div>

      {/* Criteria legend */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Criterios de evaluación</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-green-700">Satisfactorio</span>
            <span className="text-gray-500">— δ ≤ {DISP_SATISFACTORIO} mm en todos los escalones</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-700">No cumple deformaciones</span>
            <span className="text-gray-500">— algún escalón entre {DISP_SATISFACTORIO} y {DISP_REDISENO} mm</span>
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-red-700">Requiere rediseño</span>
            <span className="text-gray-500">— algún escalón &gt; {DISP_REDISENO} mm o carga no alcanzada</span>
          </span>
        </div>
      </div>

      {/* Load set selector */}
      {loadSets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <LoadSetSelector loadSets={loadSets} selectedId={selectedId} onChange={setSelectedId} />
          <p className="text-xs text-gray-400">
            {hasRef
              ? 'Los escalones de carga se proyectan sobre cada curva (círculos blancos). La evaluación se basa en el desplazamiento interpolado para cada escalón.'
              : 'Selecciona un juego de cargas para activar la evaluación de cumplimiento.'}
          </p>
        </div>
      )}

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
                <th className="px-3 py-2 text-center">Tensión V. (kN)</th>
                <th className="px-3 py-2 text-center">Compresión V. (kN)</th>
                <th className="px-3 py-2 text-center">Carga Lateral (kN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {puntos.map(p => {
                const byTipo = Object.fromEntries((p.ensayos || []).map(e => [e.tipo, e]))
                return (
                  <tr key={p.punto_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-semibold">{p.punto_id}</td>
                    <td className="px-3 py-2">
                      <TrafficLight estado={puntoEstadoMap[p.punto_id] ?? 'no_evaluado'} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right">{p.profundidad_m ?? '—'}</td>
                    {['tension_vertical', 'compresion_vertical', 'carga_lateral'].map(tipo => {
                      const e = byTipo[tipo]
                      if (!e) return <td key={tipo} className="px-3 py-2 text-center text-gray-300 text-xs">N/A</td>
                      return (
                        <td key={tipo} className="px-3 py-2 text-center">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {e.carga_maxima_kn ?? '?'} kN
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
        {!hasRef && (
          <p className="text-xs text-gray-400 mt-3 italic text-center">
            Selecciona un juego de cargas de diseño para ver la evaluación de cumplimiento.
          </p>
        )}
      </div>

      {/* Per-punto cards */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">Detalle por Punto</h3>
        {puntos.map(p => (
          <PuntoCard key={p.punto_id} punto={p} selectedLoadSet={selectedLoadSet} />
        ))}
      </div>

      {/* 
        Contenedor oculto: renderiza SIEMPRE todas las gráficas para que exportToPdf 
        pueda tomarlas con html2canvas sin importar si el usuario colapsó las tarjetitas. 
      */}
      <div style={{ position: 'absolute', top: 0, left: '-9999px', width: '800px', pointerEvents: 'none' }}>
        {puntos.map(p => (
          <div key={`pdf-hidden-${p.punto_id}`}>
            {(p.ensayos || []).map(e => {
              const meta = TIPO_META[e.tipo] || TIPO_META.tension_vertical
              const measPts = (e.puntos || []).map(pt => ({
                x: pt.desplazamiento_mm ?? 0,
                y: +(((pt.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
              }))
              const refRows = selectedLoadSet ? buildRefRows(measPts, selectedLoadSet.steps, meta.loadKey, e.tipo) : []
              return (
                <div key={e.tipo} id={`pdf-chart-${p.punto_id}-${e.tipo}`} style={{ width: '800px', height: '400px', backgroundColor: '#fff', padding: '20px' }}>
                  <LoadDispChart ensayo={{ ...e, punto_id: p.punto_id }} refRows={refRows} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
