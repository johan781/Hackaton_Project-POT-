import { useState } from 'react'
import { puntos as puntosApi, ciclos as ciclosApi } from '../api/client'

const FASES = ['CARGA', 'MANT', 'DESC']
const emptyRow = () => ({ ciclo: 1, fase: 'CARGA', carga_kgf: '', desplazamiento_mm: '', tiempo_min: '' })

export default function POTDataTable({ ensayoId, onSaved }) {
  const [rows, setRows] = useState([emptyRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const addRow = () => setRows((r) => [...r, emptyRow()])
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const byCiclo = {}
      rows.forEach((r) => {
        if (!byCiclo[r.ciclo]) byCiclo[r.ciclo] = []
        byCiclo[r.ciclo].push(r)
      })

      for (const [numCiclo, pts] of Object.entries(byCiclo)) {
        const cicloRes = await ciclosApi.create({ ensayo: ensayoId, numero_ciclo: parseInt(numCiclo) })
        const cicloId = cicloRes.data.id
        const payload = pts.map((p) => ({
          ciclo: cicloId,
          fase: p.fase,
          carga_kgf: parseFloat(p.carga_kgf),
          desplazamiento_mm: parseFloat(p.desplazamiento_mm),
          tiempo_min: parseFloat(p.tiempo_min),
        }))
        await puntosApi.createBulk(payload)
      }
      onSaved?.()
    } catch (e) {
      setError(e.response?.data || 'Error al guardar datos')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Ciclo</th>
              <th className="px-3 py-2 text-left">Fase</th>
              <th className="px-3 py-2 text-right">Carga (Kgf)</th>
              <th className="px-3 py-2 text-right">Desp. (mm)</th>
              <th className="px-3 py-2 text-right">Tiempo (min)</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-1">
                  <input type="number" min="1" value={row.ciclo}
                    onChange={(e) => update(i, 'ciclo', e.target.value)}
                    className="w-14 border rounded px-1 py-0.5 text-center text-sm" />
                </td>
                <td className="px-3 py-1">
                  <select value={row.fase} onChange={(e) => update(i, 'fase', e.target.value)}
                    className="border rounded px-1 py-0.5 text-sm">
                    {FASES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </td>
                {['carga_kgf', 'desplazamiento_mm', 'tiempo_min'].map((field) => (
                  <td key={field} className="px-3 py-1 text-right">
                    <input type="number" step="0.01" value={row[field]}
                      onChange={(e) => update(i, field, e.target.value)}
                      className="w-24 border rounded px-1 py-0.5 text-right text-sm" />
                  </td>
                ))}
                <td className="px-2 py-1">
                  <button onClick={() => removeRow(i)}
                    className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600 text-xs bg-red-50 p-2 rounded">{JSON.stringify(error)}</div>}

      <div className="flex gap-2">
        <button onClick={addRow}
          className="text-sm text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">
          + Agregar fila
        </button>
        <button onClick={handleSave} disabled={saving}
          className="text-sm bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar datos'}
        </button>
      </div>
    </div>
  )
}
