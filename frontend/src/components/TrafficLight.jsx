export default function TrafficLight({ estado, size = 'md' }) {
  const sizes = { sm: 'w-3 h-3', md: 'w-5 h-5', lg: 'w-8 h-8' }
  const dot = sizes[size] || sizes.md

  const config = {
    cumple: { color: 'bg-green-500', label: 'Cumple', text: 'text-green-700' },
    requiere_rediseno: { color: 'bg-red-500', label: 'Requiere rediseño', text: 'text-red-700' },
    no_evaluado: { color: 'bg-gray-400', label: 'Sin evaluar', text: 'text-gray-500' },
  }

  const cfg = config[estado] || config.no_evaluado

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-sm ${cfg.text}`}>
      <span className={`${dot} rounded-full ${cfg.color} inline-block`} />
      {cfg.label}
    </span>
  )
}
