# POT Engineering Standards — Criterios de Ingeniería

## Criterios de Aceptación (Prueba de Carga Lateral)

| Parámetro               | Límite         | Acción si se supera       |
|-------------------------|----------------|---------------------------|
| Desplazamiento total    | < 25 mm        | Requiere rediseño hincado |
| Desplazamiento residual | < 10 mm        | Requiere rediseño hincado |

> Fuente: Tau Sigma — Informe de Ensayos de Hincabilidad y Carga Lateral en Seguidores Solares.

---

## Conversiones y Fórmulas

### Conversión de fuerza
```
1 Kgf = 0.00980665 kN
F(kN) = F(Kgf) × 0.00980665
```

### Rigidez lateral (Stiffness)
```
K = P / δ

Donde:
  K = Rigidez lateral [kN/mm]
  P = Carga aplicada [kN]
  δ = Desplazamiento medido [mm]
```

### Desplazamiento residual
```
δ_residual = δ_max_carga - δ_al_descarga_a_0kgf
```

---

## Clasificación de Terreno por Hincabilidad

Criterio basado en el tiempo de avance por tramo de hincado:

| Tiempo de avance     | Clasificación | Color indicador |
|----------------------|---------------|-----------------|
| < 1 min/tramo        | Suave         | Verde claro     |
| 1 – 3 min/tramo      | Medio         | Amarillo        |
| 3 – 5 min/tramo      | Duro          | Naranja         |
| > 5 min/tramo        | Rechazo       | Rojo            |

---

## Indicadores de Cumplimiento (Semáforo)

- **VERDE** (`cumple`): desplazamiento_total < 25 mm AND desplazamiento_residual < 10 mm
- **ROJO** (`requiere_rediseno`): cualquier criterio superado
- **GRIS** (`no_evaluado`): sin datos de ensayo de carga

---

## Normas de Referencia
- ASTM D3966 — Lateral Load Tests on Driven Piles
- ASTM D1143 — Axial Compressive Force Tests on Piles
- NTP 339.159 (Perú) — Ensayos de carga en pilotes
