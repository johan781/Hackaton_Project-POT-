# SKILL: POT Parser — Procesamiento de Ensayos de Carga

## Descripción
Habilidad para procesar, validar y analizar datos de ensayos de carga lateral (POT) en postes de seguidores solares. Maneja estructuras de datos cíclicas y genera esquemas de visualización.

---

## Estructura de Datos Cíclicos

Cada ensayo de carga sigue la secuencia:

```
EnsayoCarga
  └── CicloCarga (1..N ciclos)
        └── PuntoCarga[]
              ├── FASE: CARGA      → carga incrementa 0 → P_max
              ├── FASE: MANT       → carga constante, se mide desplazamiento en el tiempo
              └── FASE: DESC       → carga decrementa P_max → 0
```

### Reglas de validación de ciclos:
1. Cada ciclo DEBE iniciar con al menos 1 punto de fase CARGA
2. La fase MANT es opcional (algunos ensayos no tienen mantenimiento)
3. Cada ciclo DEBE terminar con al menos 1 punto de fase DESC
4. El último punto DESC de cada ciclo debería tener carga_kgf ≈ 0

---

## Esquemas de Visualización

### Gráfica 1: Carga vs Desplazamiento (Histéresis)
```
Eje Y: Carga (kN)     ← convertir desde Kgf: P_kN = P_kgf × 0.00980665
Eje X: Desplazamiento (mm)

Colores por fase:
  CARGA → azul   (#3B82F6)
  MANT  → verde  (#10B981)
  DESC  → rojo   (#EF4444)

Múltiples ciclos → misma gráfica con opacidad decreciente por ciclo
Marcar con ✕ el punto de desplazamiento máximo
Marcar con ○ el punto residual (descarga a ~0 kN)
```

### Gráfica 2: Profundidad vs Tiempo de Hincado
```
Eje Y: Profundidad acumulada (m)   ← suma de prof_fin_m por tramo
Eje X: Tiempo acumulado (min)

Tipo: BarChart horizontal por tramo
Colores según clasificación:
  Suave    → #22C55E (verde)
  Medio    → #EAB308 (amarillo)
  Duro     → #F97316 (naranja)
  Rechazo  → #EF4444 (rojo)

Tooltip: mostrar punto_id, numero_tramo, tiempo_avance_min, clasificacion
```

---

## Lógica de Clasificación de Hincabilidad

```python
def clasificar_tramo(tiempo_avance_min: float) -> str:
    if tiempo_avance_min < 1.0:
        return "Suave"
    elif tiempo_avance_min < 3.0:
        return "Medio"
    elif tiempo_avance_min < 5.0:
        return "Duro"
    else:
        return "Rechazo"

def clasificar_hincado(tramos: list) -> str:
    clasificaciones = [t.clasificacion for t in tramos]
    if "Rechazo" in clasificaciones:
        return "Rechazo"
    elif clasificaciones.count("Duro") > len(clasificaciones) * 0.5:
        return "Duro"
    elif "Duro" in clasificaciones:
        return "Mixto-Duro"
    elif "Medio" in clasificaciones:
        return "Mixto-Medio"
    return "Suave"
```

---

## Análisis de Cumplimiento POT

```python
def evaluar_cumplimiento(ciclos: list) -> dict:
    """
    Calcula métricas clave de cumplimiento para un ensayo de carga.
    Retorna dict con:
      - desplazamiento_maximo_mm
      - desplazamiento_residual_mm
      - carga_maxima_kn
      - rigidez_media_kn_mm
      - cumple_total (bool)
      - cumple_residual (bool)
    """
    # Último ciclo = ciclo de mayor carga (ciclo de rotura o máximo)
    ultimo_ciclo = ciclos[-1]
    puntos_carga = [p for p in ultimo_ciclo.puntos if p.fase == "CARGA"]
    puntos_desc  = [p for p in ultimo_ciclo.puntos if p.fase == "DESC"]

    disp_max   = max(p.desplazamiento_mm for p in puntos_carga)
    disp_resid = min(p.desplazamiento_mm for p in puntos_desc)
    carga_max  = max(p.carga_kgf * 0.00980665 for p in puntos_carga)

    return {
        "desplazamiento_maximo_mm":  disp_max,
        "desplazamiento_residual_mm": disp_resid,
        "carga_maxima_kn":           carga_max,
        "cumple_total":              disp_max   < 25.0,
        "cumple_residual":           disp_resid < 10.0,
    }
```

---

## Formato de Importación Masiva (Excel-like)

Columnas esperadas para carga de PuntoCarga:
```
| ciclo | fase  | carga_kgf | desplazamiento_mm | tiempo_min |
|-------|-------|-----------|-------------------|------------|
| 1     | CARGA | 0         | 0.00              | 0          |
| 1     | CARGA | 100       | 1.23              | 2          |
| 1     | MANT  | 100       | 1.45              | 5          |
| 1     | DESC  | 50        | 1.10              | 7          |
| 1     | DESC  | 0         | 0.34              | 9          |
```

Validaciones al importar:
- `carga_kgf` >= 0
- `desplazamiento_mm` >= 0
- `fase` en ["CARGA", "MANT", "DESC"]
- Ordenar por `tiempo_min` dentro de cada ciclo
