import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { proyectos as proyectosApi } from '../api/client'
import { Building2, ChevronRight } from 'lucide-react'

export default function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    proyectosApi.list().then((r) => setProjects(r.data.results || r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-brand-gray">Cargando proyectos...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-dark">POT Analytics & Tracker</h1>
        <p className="text-brand-gray text-sm mt-1">Sistema de análisis de pruebas de hincabilidad y carga lateral</p>
      </div>

      <div className="grid gap-4">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`}
            className="bg-white rounded border border-gray-200 p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-brand/10 p-2 rounded">
                <Building2 className="w-5 h-5 text-brand" />
              </div>
              <div>
                <div className="font-semibold text-brand-dark">{p.nombre}</div>
                <div className="text-sm text-brand-gray">{p.cliente} · {p.ubicacion}</div>
                <div className="text-xs text-brand-gray/70 mt-0.5">Inicio: {p.fecha_inicio}</div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-brand-gray" />
          </Link>
        ))}

        {projects.length === 0 && (
          <div className="text-center py-12 text-brand-gray">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No hay proyectos registrados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
