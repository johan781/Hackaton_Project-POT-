import { useState, useEffect } from 'react'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ResponsiveContainer, Legend,
} from 'recharts'
import TrafficLight from './TrafficLight'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Settings2, Minus, Info } from 'lucide-react'

// ─── Thresholds ────────────────────────────────────────────────────────────────
const DISP_SATISFACTORIO = 15.0   // mm
const DISP_REDISENO = 25.4   // mm

// Estado order for "worst" comparison (ascending severity)
const ESTADO_ORDER = ['satisfactorio', 'margen_fuerza', 'no_cumple_deformaciones', 'requiere_rediseno']

// ─── Test type metadata ───────────────────────────────────────────────────────
const TIPO_META = {
  tension_vertical:    { label: 'Tensión Vertical',   color: '#fd9c10', bg: 'bg-orange-50',   border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700',  loadKey: 'tension_kN' },
  compresion_vertical: { label: 'Compresión Vertical', color: '#797979', bg: 'bg-gray-100',    border: 'border-gray-300',    badge: 'bg-gray-200 text-gray-700',      loadKey: 'compresion_kN' },
  carga_lateral:       { label: 'Carga Lateral',       color: '#1a1a1a', bg: 'bg-neutral-100', border: 'border-neutral-300', badge: 'bg-neutral-200 text-neutral-700', loadKey: 'lateral_kN' },
}

// ─── Criteria helpers (ONLY used when a load set is selected) ─────────────────
const CRITERIO_INFO = {
  satisfactorio: {
    label: 'Profundidad de hincado satisfactoria',
    short: `≤ ${DISP_SATISFACTORIO} mm`,
    color: 'text-green-700', bg: 'bg-green-100',
  },
  margen_fuerza: {
    label: 'Carga de diseño no alcanzada — desplazamiento dentro del límite',
    short: 'Margen de fuerza',
    color: 'text-blue-700', bg: 'bg-blue-100',
  },
  no_cumple_deformaciones: {
    label: 'No cumple criterio de deformaciones',
    short: `${DISP_SATISFACTORIO}–${DISP_REDISENO} mm`,
    color: 'text-amber-700', bg: 'bg-amber-100',
  },
  requiere_rediseno: {
    label: 'Requiere rediseño',
    short: `> ${DISP_REDISENO} mm`,
    color: 'text-red-700', bg: 'bg-red-100',
  },
}

function estadoFromDisp(disp, tipo) {
  if (disp === null) return 'requiere_rediseno'
  if (disp <= DISP_SATISFACTORIO) return 'satisfactorio'
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
  if (estado === 'margen_fuerza') return <Info className={`${cls} text-blue-500 flex-shrink-0`} />
  if (estado === 'no_cumple_deformaciones') return <AlertTriangle className={`${cls} text-amber-500 flex-shrink-0`} />
  return <XCircle className={`${cls} text-red-500 flex-shrink-0`} />
}

// ─── Interpolation ────────────────────────────────────────────────────────────
function interpolateY(pts, targetX) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x >= targetX) {
      const { x: x0, y: y0 } = pts[i - 1]
      const { x: x1, y: y1 } = pts[i]
      if (x1 === x0) return +y0.toFixed(3)
      return +(y0 + (targetX - x0) * (y1 - y0) / (x1 - x0)).toFixed(3)
    }
  }
  return null
}

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

      // Force not reached — evaluate displacement at the max measured point
      if (interpDisp === null && pts.length > 0) {
        const lastPt = pts.at(-1)
        const dispAtMax = +lastPt.x.toFixed(3)
        const forceAtMax = +lastPt.y.toFixed(3)
        const margin = +(designForce - forceAtMax).toFixed(3)
        const marginPct = +(margin / designForce * 100).toFixed(1)
        // If displacement at max force is within the hard limit → margen de fuerza, no es fallo
        if (dispAtMax <= DISP_REDISENO) {
          return { paso: s.paso, designForce, interpDisp: dispAtMax, forceAtMax, margin, marginPct, notReached: true, estado: 'margen_fuerza', criterio: CRITERIO_INFO.margen_fuerza }
        }
        // Displacement too high even without reaching design force → real failure
        return { paso: s.paso, designForce, interpDisp: dispAtMax, forceAtMax, margin, marginPct, notReached: true, estado: 'requiere_rediseno', criterio: CRITERIO_INFO.requiere_rediseno }
      }

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
        <thead className="text-brand-gray uppercase text-xs" style={{ backgroundColor: `${color}18` }}>
          <tr>
            <th className="px-3 py-1.5 text-center">Escalón</th>
            <th className="px-3 py-1.5 text-right">Carga diseño (kN)</th>
            <th className="px-3 py-1.5 text-right">Desp. en curva (mm)</th>
            <th className="px-3 py-1.5 text-right">Margen fuerza</th>
            <th className="px-3 py-1.5 text-center">Evaluación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => {
            const c = row.criterio
            return (
              <tr key={row.paso} className={c.bg}>
                <td className="px-3 py-1 text-center text-brand-gray font-mono">{row.paso}</td>
                <td className="px-3 py-1 text-right font-mono font-semibold" style={{ color }}>
                  {row.designForce} kN
                </td>
                <td className={`px-3 py-1 text-right font-mono font-semibold ${c.color}`}>
                  {row.interpDisp !== null ? `${row.interpDisp} mm` : '—'}
                  {row.notReached && row.forceAtMax != null && (
                    <span className="ml-1 text-brand-gray font-normal opacity-70">@ {row.forceAtMax} kN</span>
                  )}
                </td>
                <td className="px-3 py-1 text-right font-mono text-brand-gray">
                  {row.notReached
                    ? <span className="text-blue-600">−{row.margin} kN ({row.marginPct}%)</span>
                    : <span className="opacity-30">—</span>
                  }
                </td>
                <td className="px-3 py-1 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.color}`}>
                    {row.estado === 'satisfactorio' && <CheckCircle2 className="w-3 h-3" />}
                    {row.estado === 'margen_fuerza' && <Info className="w-3 h-3" />}
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

// ─── Axis range helpers ───────────────────────────────────────────────────────
function niceMax(val, pad = 0.18) {
  if (!val || val <= 0) return 1
  const padded = val * (1 + pad)
  const mag = Math.pow(10, Math.floor(Math.log10(padded)))
  for (const s of [1, 2, 2.5, 5, 10]) {
    const c = Math.ceil(padded / (mag * s)) * mag * s
    if (c >= padded) return +c.toPrecision(4)
  }
  return Math.ceil(padded)
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 shadow-md rounded-lg px-3 py-2 text-xs min-w-[120px]">
      <p className="text-brand-gray mb-1 font-medium">δ = <span className="font-mono text-brand-dark">{label} mm</span></p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} className="font-mono" style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value} kN</span>
        </p>
      ))}
    </div>
  )
}

// ─── Load-displacement chart ─────────────────────────────────────────────────
function LoadDispChart({ ensayo, refRows }) {
  const meta = TIPO_META[ensayo.tipo] || TIPO_META.tension_vertical
  const gradId = `grad-${ensayo.tipo}`

  const pts = (() => {
    const all = (ensayo.puntos || []).map(p => ({
      x: +(p.desplazamiento_mm ?? 0).toFixed(4),
      y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
    }))
    // Keep only the loading envelope: points where displacement >= previous max
    let maxX = -Infinity
    return all.filter(p => {
      if (p.x >= maxX) { maxX = p.x; return true }
      return false
    })
  })()
  if (!pts.length) return (
    <div className="flex items-center justify-center h-36 text-gray-400 text-sm">Sin datos</div>
  )

  const maxDesign = refRows?.length ? Math.max(...refRows.map(r => r.designForce)) : 0
  const dataMaxX = Math.max(...pts.map(d => d.x))

  // Scale to data only — reference lines appear only if they fall within range
  const calcXMax = () => niceMax(dataMaxX)
  const calcYMax = () => niceMax(Math.max(...pts.map(d => d.y), maxDesign, 1))

  const [showAxisControls, setShowAxisControls] = useState(false)
  const [xMin, setXMin] = useState(0)
  const [xMax, setXMax] = useState(calcXMax)
  const [yMin, setYMin] = useState(0)
  const [yMax, setYMax] = useState(calcYMax)

  useEffect(() => {
    setXMin(0); setXMax(niceMax(dataMaxX))
    setYMin(0); setYMax(niceMax(Math.max(...pts.map(d => d.y), maxDesign, 1)))
  }, [ensayo.tipo, pts.length]) // eslint-disable-line

  const safeNum = (v, fb) => { const n = parseFloat(v); return isFinite(n) ? n : fb }

  const [offset15, setOffset15] = useState({ dx: 0, dy: 0 })
  const [offset254, setOffset254] = useState({ dx: 0, dy: 0 })

  const startDrag = (currentOffset, setOffset) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const { dx: baseDx, dy: baseDy } = currentOffset
    const onMove = (me) => setOffset({ dx: baseDx + me.clientX - startX, dy: baseDy + me.clientY - startY })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const DotWithLabel = (color, disp, force, offset, onDragStart) => ({ cx, cy }) => {
    if (cx == null || cy == null) return null
    const line1 = `δ = ${disp} mm`
    const line2 = `F = ${force} kN`
    const w = Math.max(line1.length, line2.length) * 6.8 + 12
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
        <g style={{ cursor: 'grab' }} onMouseDown={onDragStart}>
          <rect x={cx - w - 6 + offset.dx} y={cy - 38 + offset.dy} width={w} height={30} rx={3}
            fill="white" stroke={color} strokeWidth={1} opacity={0.95} />
          <text x={cx - 10 + offset.dx} y={cy - 24 + offset.dy} textAnchor="end" fontSize={11} fontWeight="600" fill={color}>
            {line1}
          </text>
          <text x={cx - 10 + offset.dx} y={cy - 11 + offset.dy} textAnchor="end" fontSize={11} fontWeight="600" fill={color}>
            {line2}
          </text>
        </g>
      </g>
    )
  }


  return (
    <div id={`chart-${ensayo.punto_id}-${ensayo.tipo}`}>
      {/* Controls bar */}
      <div className="flex justify-end mb-1.5">
        <button
          onClick={() => setShowAxisControls(v => !v)}
          title="Ajustar escala de ejes"
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors
            ${showAxisControls ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-brand-gray hover:border-brand hover:text-brand'}`}
        >
          <Settings2 className="w-3 h-3" />
          Ejes
        </button>
      </div>

      {showAxisControls && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 mb-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded text-xs">
          {[
            { label: 'X mín (mm)', val: xMin, set: setXMin, step: 0.5, fb: 0 },
            { label: 'X máx (mm)', val: xMax, set: setXMax, step: 0.5, fb: calcXMax() },
            { label: 'Y mín (kN)', val: yMin, set: setYMin, step: 0.1, fb: 0 },
            { label: 'Y máx (kN)', val: yMax, set: setYMax, step: 0.1, fb: calcYMax() },
          ].map(({ label, val, set, step, fb }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-brand-gray/80">{label}</span>
              <input type="number" value={val} step={step}
                onChange={e => set(safeNum(e.target.value, fb))}
                className="border border-gray-200 rounded px-2 py-0.5 font-mono text-right focus:outline-none focus:border-brand bg-white" />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 flex justify-end">
            <button
              onClick={() => { setXMin(0); setXMax(calcXMax()); setYMin(0); setYMax(calcYMax()) }}
              className="text-xs text-brand-gray hover:text-brand underline"
            >
              Restablecer automático
            </button>
          </div>
        </div>
      )}

      <div style={{ width: '100%', height: '260px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 10, right: 24, left: 10, bottom: 26 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={true} />

            <XAxis
              dataKey="x" type="number"
              domain={[xMin, xMax]}
              tickCount={7}
              tickFormatter={v => +v.toFixed(2)}
              label={{ value: 'Desplazamiento (mm)', position: 'insideBottom', offset: -14, fontSize: 10, fill: '#6b7280' }}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={{ stroke: '#d1d5db' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickCount={7}
              tickFormatter={v => +v.toFixed(2)}
              label={{ value: 'Fuerza (kN)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#6b7280', dy: 45 }}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              axisLine={{ stroke: '#d1d5db' }}
              tickLine={{ stroke: '#d1d5db' }}
              width={52}
            />

            <Tooltip content={<ChartTooltip />} />
            <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 10, color: '#6b7280' }} />

            {/* Limit lines — only rendered if within visible X range */}
            {DISP_SATISFACTORIO <= xMax && (
              <ReferenceLine x={DISP_SATISFACTORIO} stroke="#F59E0B" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: `${DISP_SATISFACTORIO} mm`, fill: '#92400E', fontSize: 9, position: 'insideTopRight' }} />
            )}
            {DISP_REDISENO <= xMax && (
              <ReferenceLine x={DISP_REDISENO} stroke="#EF4444" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: `${DISP_REDISENO} mm`, fill: '#991B1B', fontSize: 9, position: 'insideTopRight' }} />
            )}

            {/* Intersection dots at threshold x-values */}
            {DISP_SATISFACTORIO >= xMin && DISP_SATISFACTORIO <= xMax && interpolateY(pts, DISP_SATISFACTORIO) != null && (
              <ReferenceDot x={DISP_SATISFACTORIO} y={interpolateY(pts, DISP_SATISFACTORIO)} r={0}
                shape={DotWithLabel('#F59E0B', DISP_SATISFACTORIO, interpolateY(pts, DISP_SATISFACTORIO), offset15, startDrag(offset15, setOffset15))} />
            )}
            {DISP_REDISENO >= xMin && DISP_REDISENO <= xMax && interpolateY(pts, DISP_REDISENO) != null && (
              <ReferenceDot x={DISP_REDISENO} y={interpolateY(pts, DISP_REDISENO)} r={0}
                shape={DotWithLabel('#EF4444', DISP_REDISENO, interpolateY(pts, DISP_REDISENO), offset254, startDrag(offset254, setOffset254))} />
            )}

            {/* Area fill under curve */}
            <Area
              data={pts}
              dataKey="y"
              name="Curva medida"
              stroke={meta.color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={{ r: 2.5, fill: meta.color, stroke: 'white', strokeWidth: 1 }}
              activeDot={{ r: 4, stroke: 'white', strokeWidth: 1.5 }}
              connectNulls
              type="monotone"
            />

          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Raw data table ───────────────────────────────────────────────────────────
function EnsayoTable({ puntos = [] }) {
  return (
    <div className="overflow-x-auto rounded border border-gray-200 text-xs">
      <table className="min-w-full">
        <thead className="bg-brand-light text-brand-gray uppercase text-xs">
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
              <td className="px-3 py-1 text-center text-brand-gray">{i + 1}</td>
              <td className="px-3 py-1 text-right font-mono">{p.desplazamiento_mm ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono">{p.fuerza_kg ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono">{p.fuerza_kn ?? '—'}</td>
              <td className="px-3 py-1 text-right font-mono text-brand-gray">{p.rigidez_kn_mm ?? '—'}</td>
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

  // Build measured points in kN for interpolation (sorted ascending by force)
  const measuredPts = (ensayo.puntos || [])
    .map(p => ({
      x: p.desplazamiento_mm ?? 0,
      y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
    }))
    .sort((a, b) => a.y - b.y)

  // Comparison rows and worst estado — ONLY when a load set is selected
  const refRows = selectedLoadSet ? buildRefRows(measuredPts, selectedLoadSet.steps, meta.loadKey, ensayo.tipo) : []
  const hasRef = refRows.length > 0
  const estado = hasRef ? worstEstado(refRows.map(r => r.estado)) : null
  const criterio = estado ? CRITERIO_INFO[estado] : null

  const maxDesign = hasRef ? refRows.at(-1).designForce : null

  const failReason = (() => {
    if (!hasRef || !estado || estado === 'satisfactorio') return null
    if (estado === 'margen_fuerza') {
      const row = refRows.find(r => r.estado === 'margen_fuerza')
      if (!row) return null
      return `Carga no alcanzada en escalón ${row.paso} — medido ${row.forceAtMax} kN de ${row.designForce} kN requeridos (−${row.margin} kN, −${row.marginPct}%)`
    }
    if (estado === 'no_cumple_deformaciones') {
      const row = refRows.find(r => r.estado === 'no_cumple_deformaciones')
      if (!row) return null
      return `Desplazamiento de ${row.interpDisp} mm en escalón ${row.paso} (${row.designForce} kN) — entre ${DISP_SATISFACTORIO} y ${DISP_REDISENO} mm`
    }
    // requiere_rediseno — puede ser por desplazamiento excedido o carga no alcanzada con desp. alto
    const row = refRows.find(r => r.estado === 'requiere_rediseno')
    if (!row) return null
    if (row.notReached)
      return `Desplazamiento de ${row.interpDisp} mm al máximo medido (${row.forceAtMax} kN) supera el límite de ${DISP_REDISENO} mm — carga de diseño ${row.designForce} kN no alcanzada`
    if (ensayo.tipo === 'carga_lateral')
      return `Desplazamiento lateral de ${row.interpDisp} mm en escalón ${row.paso} (${row.designForce} kN) supera el límite de ${DISP_SATISFACTORIO} mm`
    return `Desplazamiento de ${row.interpDisp} mm en escalón ${row.paso} (${row.designForce} kN) supera el límite de ${DISP_REDISENO} mm`
  })()

  return (
    <div className={`rounded border ${meta.border} ${meta.bg} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasRef
            ? <CriterioIcon estado={estado} />
            : <Minus className="w-4 h-4 text-brand-gray/40 flex-shrink-0" />}
          <span className="font-semibold text-sm text-brand-dark">{ensayo.nombre || meta.label}</span>
          {hasRef && criterio && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${criterio.bg} ${criterio.color}`}>
              {criterio.short}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-brand-gray">
          <span>
            <span className="font-semibold text-brand-dark">{ensayo.carga_maxima_kgf ?? '—'}</span> kgf
            {' / '}
            <span className="font-semibold text-brand-dark">{ensayo.carga_maxima_kn ?? '—'}</span> kN
            {maxDesign != null && (
              <span className="ml-2 text-brand-gray/70">
                (diseño máx:{' '}
                <span className={`font-semibold ${(ensayo.carga_maxima_kn ?? 0) >= maxDesign ? 'text-green-600' : 'text-amber-600'}`}>
                  {maxDesign} kN
                </span>)
              </span>
            )}
          </span>
          <button onClick={() => setShowRawTable(v => !v)} className="text-brand-gray hover:text-brand-dark">
            {showRawTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Criteria detail — ONLY when a load set is selected */}
      {hasRef && criterio && (
        <div className={`mx-4 mb-2 px-3 py-1.5 rounded text-xs font-medium ${criterio.bg} ${criterio.color}`}>
          {criterio.label}
          {failReason && <span className="ml-2 opacity-75 font-normal">— {failReason}</span>}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 pb-2">
        <LoadDispChart ensayo={{ ...ensayo, punto_id: ensayo.punto_id }} refRows={refRows} />
      </div>

      {/* Comparison table — ONLY when a load set is selected */}
      {hasRef && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-brand-gray mb-1">
            Comparación con juego de cargas — desplazamiento interpolado de la curva medida
          </p>
          <RefCompareTable rows={refRows} color={meta.color} />
        </div>
      )}

      {/* Raw data table (collapsible) */}
      {showRawTable && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-brand-gray mb-1">Datos medidos</p>
          <EnsayoTable puntos={ensayo.puntos || []} />
        </div>
      )}
    </div>
  )
}

// ─── Single point card ────────────────────────────────────────────────────────
function PuntoCard({ punto, selectedLoadSet, forceOpen = false }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (forceOpen) setExpanded(true)
  }, [forceOpen])
  const ensayos = punto.ensayos || []

  // Compute per-ensayo estado from refRows — ONLY when a load set is selected
  const ensayoEstados = selectedLoadSet
    ? ensayos.map(e => {
      const meta = TIPO_META[e.tipo] || TIPO_META.tension_vertical
      const measPts = (e.puntos || [])
        .map(p => ({
          x: p.desplazamiento_mm ?? 0,
          y: +(((p.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
        }))
        .sort((a, b) => a.y - b.y)
      const rows = buildRefRows(measPts, selectedLoadSet.steps, meta.loadKey, e.tipo)
      return rows.length ? worstEstado(rows.map(r => r.estado)) : 'no_evaluado'
    })
    : []

  const hasRef = selectedLoadSet !== null
  const puntoEstado = hasRef && ensayoEstados.length
    ? worstEstado(ensayoEstados)
    : null

  const borderCls = !hasRef ? 'border-gray-200' :
    puntoEstado === 'satisfactorio' ? 'border-green-300' :
      puntoEstado === 'margen_fuerza' ? 'border-amber-300' :
        puntoEstado === 'no_cumple_deformaciones' ? 'border-amber-300' : 'border-red-300'

  const headBg = !hasRef ? 'bg-brand-light' :
    puntoEstado === 'satisfactorio' ? 'bg-green-50' :
      puntoEstado === 'margen_fuerza' ? 'bg-amber-50' :
        puntoEstado === 'no_cumple_deformaciones' ? 'bg-amber-50' : 'bg-red-50'

  // TrafficLight estado: show computed if hasRef, else 'no_evaluado'
  const tlEstado = hasRef && puntoEstado ? puntoEstado : 'no_evaluado'

  return (
    <div className={`rounded border-2 ${borderCls} bg-white overflow-hidden`}>
      <div className={`px-5 py-3 flex items-center justify-between ${headBg}`}>
        <div className="flex items-center gap-3">
          {hasRef && puntoEstado
            ? <CriterioIcon estado={puntoEstado} cls="w-5 h-5" />
            : <Minus className="w-5 h-5 text-brand-gray/30 flex-shrink-0" />}
          <span className="font-bold text-brand-dark font-mono text-lg">{punto.punto_id}</span>
          <TrafficLight estado={tlEstado} size="sm" />
          {punto.tipo_perfil && (
            <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-brand-gray">
              {punto.tipo_perfil}
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-brand-gray hover:text-brand-dark p-1">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="px-5 py-3 flex flex-wrap gap-4 text-sm border-b border-gray-100">
        <span>
          <span className="text-brand-gray text-xs">Profundidad: </span>
          <span className="font-semibold text-brand-dark">{punto.profundidad_m ?? '—'} m</span>
        </span>
        {punto.fecha_ensayo && (
          <span>
            <span className="text-brand-gray text-xs">Fecha: </span>
            <span className="font-semibold text-brand-dark">{punto.fecha_ensayo}</span>
          </span>
        )}
        {punto.coordenadas && (
          <span>
            <span className="text-brand-gray text-xs">Coord: </span>
            <span className="font-mono text-xs text-brand-dark">{punto.coordenadas}</span>
          </span>
        )}
        {/* Per-ensayo badges — only when hasRef */}
        {hasRef && ensayos.map((e, i) => {
          const c = CRITERIO_INFO[ensayoEstados[i]]
          if (!c) return null
          return (
            <span key={e.tipo} className={`text-xs px-2 py-0.5 rounded font-medium ${c.bg} ${c.color}`}>
              {TIPO_META[e.tipo]?.label ?? e.tipo}: {c.short}
            </span>
          )
        })}
        {!hasRef && (
          <span className="text-xs text-brand-gray italic">Selecciona un juego de cargas para evaluar</span>
        )}
        {punto.observaciones && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
            {punto.observaciones}
          </span>
        )}
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {ensayos.length === 0
            ? <div className="text-brand-gray text-sm text-center py-4">Sin datos de ensayo</div>
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
      <Settings2 className="w-4 h-4 text-brand-gray flex-shrink-0" />
      <span className="text-sm text-brand-dark font-medium">Juego de cargas de diseño:</span>
      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded px-3 py-1.5 bg-white text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30"
      >
        <option value="">— Sin referencia —</option>
        {loadSets.map(ls => <option key={ls.id} value={ls.id}>{ls.label}</option>)}
      </select>
      {sel && (() => {
        const last = sel.steps.at(-1)
        return (
          <span className="text-xs text-brand-gray">
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
  const [activePuntoId, setActivePuntoId] = useState(null)

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
        const measPts = (e.puntos || [])
          .map(pt => ({
            x: pt.desplazamiento_mm ?? 0,
            y: +(((pt.fuerza_kg ?? 0) * 0.00980665).toFixed(3)),
          }))
          .sort((a, b) => a.y - b.y)
        const rows = buildRefRows(measPts, selectedLoadSet.steps, meta.loadKey, e.tipo)
        return rows.length ? worstEstado(rows.map(r => r.estado)) : 'no_evaluado'
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
      <div className="bg-brand-dark rounded text-white p-6" style={{ borderLeft: '4px solid #fd9c10' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">Informe POT — Pull Out Test</div>
            <h2 className="text-2xl font-bold">{proyecto?.nombre || 'Sin nombre'}</h2>
            <div className="text-sm opacity-70 mt-1">
              {[proyecto?.cliente, proyecto?.ubicacion, proyecto?.fecha].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black" style={{ color: '#fd9c10' }}>{pct !== null ? `${pct}%` : '—'}</div>
            <div className="text-xs opacity-60">
              {pct !== null ? 'hincados satisfactorios' : 'sin juego de cargas'}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-brand-dark">{puntos.length}</div>
          <div className="text-xs text-brand-gray mt-1">Puntos analizados</div>
        </div>
        <div className={`rounded border p-4 text-center ${hasRef ? 'bg-green-50 border-green-200' : 'bg-brand-light border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-green-600' : 'text-brand-gray/30'}`}>
            {satisf ?? '—'}
          </div>
          <div className="text-xs text-brand-gray mt-1">Hincado satisfactorio</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-green-600' : 'text-brand-gray/30'}`}>
            ≤ {DISP_SATISFACTORIO} mm
          </div>
        </div>
        <div className={`rounded border p-4 text-center ${hasRef ? 'bg-amber-50 border-amber-200' : 'bg-brand-light border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-amber-600' : 'text-brand-gray/30'}`}>
            {noDeform ?? '—'}
          </div>
          <div className="text-xs text-brand-gray mt-1">No cumple deformaciones</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-amber-600' : 'text-brand-gray/30'}`}>
            {DISP_SATISFACTORIO}–{DISP_REDISENO} mm
          </div>
        </div>
        <div className={`rounded border p-4 text-center ${hasRef ? 'bg-red-50 border-red-200' : 'bg-brand-light border-gray-200'}`}>
          <div className={`text-2xl font-bold ${hasRef ? 'text-red-600' : 'text-brand-gray/30'}`}>
            {rediseno ?? '—'}
          </div>
          <div className="text-xs text-brand-gray mt-1">Requiere rediseño</div>
          <div className={`text-xs font-medium mt-0.5 ${hasRef ? 'text-red-600' : 'text-brand-gray/30'}`}>
            &gt; {DISP_REDISENO} mm o carga no alcanzada
          </div>
        </div>
      </div>

      {/* Criteria legend */}
      <div className="bg-brand-light rounded border border-gray-200 p-4">
        <p className="text-xs font-semibold text-brand-gray uppercase tracking-wide mb-2">Criterios de evaluación</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="font-semibold text-green-700">Satisfactorio</span>
            <span className="text-brand-gray">— δ ≤ {DISP_SATISFACTORIO} mm en todos los escalones</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-blue-700">Margen de fuerza</span>
            <span className="text-brand-gray">— carga de diseño no alcanzada, pero δ ≤ {DISP_REDISENO} mm</span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-700">No cumple deformaciones</span>
            <span className="text-brand-gray">— algún escalón entre {DISP_SATISFACTORIO} y {DISP_REDISENO} mm</span>
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-red-700">Requiere rediseño</span>
            <span className="text-brand-gray">— δ &gt; {DISP_REDISENO} mm</span>
          </span>
        </div>
      </div>

      {/* Load set selector */}
      {loadSets.length > 0 && (
        <div className="bg-white rounded border border-gray-200 p-4 space-y-2">
          <LoadSetSelector loadSets={loadSets} selectedId={selectedId} onChange={setSelectedId} />
          <p className="text-xs text-brand-gray">
            {hasRef
              ? 'Los escalones de carga se proyectan sobre cada curva (círculos blancos). La evaluación se basa en el desplazamiento interpolado para cada escalón.'
              : 'Selecciona un juego de cargas para activar la evaluación de cumplimiento.'}
          </p>
          {hasRef && selectedLoadSet && (
            <div className="mt-1 overflow-x-auto rounded border border-gray-200 text-xs">
              <p className="text-xs font-semibold text-brand-gray px-3 pt-2 pb-1 uppercase tracking-wide">
                Cargas de diseño — {selectedLoadSet.label}
              </p>
              <table className="min-w-full">
                <thead className="bg-brand-light text-brand-gray uppercase text-xs">
                  <tr>
                    <th className="px-3 py-1.5 text-center">Escalón</th>
                    <th className="px-3 py-1.5 text-right">Tensión (kN)</th>
                    <th className="px-3 py-1.5 text-right">Compresión (kN)</th>
                    <th className="px-3 py-1.5 text-right">Lateral (kN)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedLoadSet.steps.map(s => (
                    <tr key={s.paso} className="hover:bg-brand-light">
                      <td className="px-3 py-1 text-center font-mono text-brand-gray">{s.paso}</td>
                      <td className="px-3 py-1 text-right font-mono">{s.tension_kN}</td>
                      <td className="px-3 py-1 text-right font-mono">{s.compresion_kN}</td>
                      <td className="px-3 py-1 text-right font-mono">{s.lateral_kN}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary table */}
      <div className="bg-white rounded border border-gray-200 p-5">
        <h3 className="font-semibold text-brand-dark mb-3">Resumen de Resultados</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-light text-brand-gray text-xs uppercase">
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
                  <tr
                    key={p.punto_id}
                    className="hover:bg-brand-light cursor-pointer"
                    onClick={() => {
                      setActivePuntoId(p.punto_id)
                      setTimeout(() => document.getElementById(`punto-${p.punto_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-brand-dark underline decoration-dotted underline-offset-2">{p.punto_id}</td>
                    <td className="px-3 py-2">
                      <TrafficLight estado={puntoEstadoMap[p.punto_id] ?? 'no_evaluado'} size="sm" />
                    </td>
                    <td className="px-3 py-2 text-right text-brand-dark">{p.profundidad_m ?? '—'}</td>
                    {['tension_vertical', 'compresion_vertical', 'carga_lateral'].map(tipo => {
                      const e = byTipo[tipo]
                      if (!e) return <td key={tipo} className="px-3 py-2 text-center text-brand-gray/40 text-xs">N/A</td>
                      return (
                        <td key={tipo} className="px-3 py-2 text-center">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-brand-light text-brand-gray">
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
          <p className="text-xs text-brand-gray mt-3 italic text-center">
            Selecciona un juego de cargas de diseño para ver la evaluación de cumplimiento.
          </p>
        )}
      </div>

      {/* Per-punto cards */}
      <div className="space-y-4">
        <h3 className="font-semibold text-brand-dark">Detalle por Punto</h3>
        {puntos.map(p => (
          <div key={p.punto_id} id={`punto-${p.punto_id}`} style={{ scrollMarginTop: '1rem' }}>
            <PuntoCard punto={p} selectedLoadSet={selectedLoadSet} forceOpen={activePuntoId === p.punto_id} />
          </div>
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
