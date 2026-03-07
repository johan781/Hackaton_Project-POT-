import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

const COLORS = { Suave: '#797979', Medio: '#fd9c10', Duro: '#1a1a1a', Rechazo: '#000000' }

export default function DrivingChart({ tramos = [] }) {
  if (!tramos.length) {
    return <div className="flex items-center justify-center h-48 text-gray-400">Sin datos de hincado</div>
  }

  const data = tramos.map((t) => ({
    name: `T${t.numero_tramo}`,
    tiempo: t.tiempo_avance_min,
    clasificacion: t.clasificacion,
    prof: `${t.prof_inicio_m}–${t.prof_fin_m}m`,
  }))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-2">Tiempo de Avance por Tramo</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis label={{ value: 'min/tramo', angle: -90, position: 'insideLeft', fontSize: 11 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="bg-white border rounded shadow p-2 text-xs">
                  <div className="font-semibold">{d.name} ({d.prof})</div>
                  <div>Tiempo: <b>{d.tiempo} min</b></div>
                  <div>Clase: <b style={{ color: COLORS[d.clasificacion] }}>{d.clasificacion}</b></div>
                </div>
              )
            }}
          />
          <Bar dataKey="tiempo" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={COLORS[entry.clasificacion] || '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-2 text-xs justify-center">
        {Object.entries(COLORS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ background: v }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}
