import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

const FASE_COLORS = { CARGA: '#3B82F6', MANT: '#10B981', DESC: '#EF4444' }
const KGF_TO_KN = 0.00980665

export default function LoadDisplacementChart({ ciclos = [] }) {
  if (!ciclos.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sin datos de ensayo</div>
  }

  const series = ciclos.map((ciclo) => ({
    label: `Ciclo ${ciclo.numero_ciclo}`,
    data: (ciclo.puntos || []).map((p) => ({
      x: p.desplazamiento_mm,
      y: parseFloat((p.carga_kgf * KGF_TO_KN).toFixed(3)),
      fase: p.fase,
    })),
  }))

  const allPoints = series.flatMap((s) => s.data)
  const maxX = Math.max(...allPoints.map((p) => p.x), 30)

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-2">Carga vs Desplazamiento</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, maxX + 2]}
            label={{ value: 'Desplazamiento (mm)', position: 'insideBottomRight', offset: -10, fontSize: 11 }}
          />
          <YAxis
            label={{ value: 'Carga (kN)', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            formatter={(val, name) => [`${val}`, name]}
            labelFormatter={(l) => `δ = ${l} mm`}
          />
          <Legend />
          <ReferenceLine x={25} stroke="#EF4444" strokeDasharray="5 5" label={{ value: 'Límite 25mm', fill: '#EF4444', fontSize: 10 }} />

          {series.map((s, i) => (
            <Line
              key={s.label}
              data={s.data}
              dataKey="y"
              name={s.label}
              stroke={Object.values(FASE_COLORS)[i % 3]}
              dot={false}
              strokeWidth={2}
              opacity={1 - i * 0.15}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
