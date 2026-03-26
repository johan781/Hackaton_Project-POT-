"""
AI Fallback Extractor — Claude API

Se activa automáticamente cuando el parser de reglas no encuentra puntos.
Requiere ANTHROPIC_API_KEY en el .env del backend.

Si la key no está configurada, simplemente no hace nada y el sistema
devuelve el resultado vacío del parser de reglas (no falla).
"""
from __future__ import annotations

import json
import os
import re

# Máximo de caracteres de texto PDF a enviar (evita tokens excesivos)
_MAX_TEXT_CHARS = 18_000

_SYSTEM_PROMPT = """Eres un extractor especializado en informes de ensayos Pull-Out Test (POT) geotécnicos.
Tu única tarea es extraer datos estructurados del texto de un informe y devolverlos en JSON estricto.

SCHEMA de salida (devuelve SOLO el JSON, sin texto adicional, sin markdown):
{
  "proyecto": {
    "nombre": "string o null",
    "cliente": "string o null",
    "ubicacion": "string o null",
    "fecha": "DD/MM/YYYY o null"
  },
  "puntos": [
    {
      "punto_id": "string identificador del punto (ej: POT-1, POT-A-1, P-01)",
      "profundidad_m": número o null,
      "tipo_perfil": "string o null (ej: IPE 200, HEA 160)",
      "coordenadas": "string o null",
      "fecha_ensayo": "string o null",
      "ensayos": [
        {
          "tipo": "tension_vertical | compresion_vertical | carga_lateral",
          "puntos": [
            {"desplazamiento_mm": número, "fuerza_kg": número}
          ]
        }
      ]
    }
  ]
}

REGLAS CRÍTICAS:
- "tipo" solo puede ser: tension_vertical, compresion_vertical, carga_lateral
  · tension_vertical: tracción, tensión, vertical pull, arranque vertical
  · compresion_vertical: compresión, vertical push, empuje vertical
  · carga_lateral: lateral, horizontal, cortante, shear
- "fuerza_kg" SIEMPRE en kilogramos-fuerza (kgf). Si el documento da kN, multiplica por 101.9716
- "desplazamiento_mm" SIEMPRE en milímetros
- Incluye TODOS los pares (desplazamiento, fuerza) de la fase de carga (no descarga)
- Si hay múltiples puntos/pilotes en el documento, extrae TODOS
- Si un valor no existe en el documento, usa null
- Devuelve SOLO el JSON válido, sin explicaciones"""


def _extract_with_ai(pdf_text: str) -> dict | None:
    """
    Envía el texto del PDF a Claude y devuelve el resultado parseado.
    Retorna None si la API key no está configurada o si ocurre algún error.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        import anthropic
    except ImportError:
        return None

    # Truncar texto si es muy largo
    text = pdf_text[:_MAX_TEXT_CHARS]
    if len(pdf_text) > _MAX_TEXT_CHARS:
        text += f"\n\n[... texto truncado, {len(pdf_text) - _MAX_TEXT_CHARS} caracteres adicionales ...]"

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Extrae los datos del siguiente informe POT:\n\n{text}",
                }
            ],
        )
        raw = message.content[0].text.strip()

        # Limpiar posibles bloques markdown ```json ... ```
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        result = json.loads(raw)
        return result

    except Exception as exc:
        print(f"[AI Extractor] Error calling Claude API: {exc}")
        return None


def _normalize_ai_result(raw: dict) -> dict:
    """
    Convierte la respuesta de Claude al mismo esquema que usa el parser de reglas,
    calculando carga_maxima_kgf y desplazamiento_maximo_mm en cada ensayo.
    """
    KGF_TO_KN = 0.00980665
    TIPO_LABELS = {
        "tension_vertical":    "Prueba de Tensión Vertical",
        "compresion_vertical": "Prueba de Compresión Vertical",
        "carga_lateral":       "Prueba de Carga Lateral",
    }

    proyecto = raw.get("proyecto") or {}
    puntos_raw = raw.get("puntos") or []

    puntos = []
    for p in puntos_raw:
        ensayos = []
        for e in (p.get("ensayos") or []):
            pts = [
                {"desplazamiento_mm": float(pt["desplazamiento_mm"]),
                 "fuerza_kg": float(pt["fuerza_kg"])}
                for pt in (e.get("puntos") or [])
                if pt.get("desplazamiento_mm") is not None
                and pt.get("fuerza_kg") is not None
                and float(pt["fuerza_kg"]) > 0
            ]
            if not pts:
                continue
            tipo = e.get("tipo", "tension_vertical")
            ensayos.append({
                "tipo": tipo,
                "nombre": TIPO_LABELS.get(tipo, tipo),
                "carga_maxima_kgf": max(pt["fuerza_kg"] for pt in pts),
                "desplazamiento_maximo_mm": max(pt["desplazamiento_mm"] for pt in pts),
                "puntos": pts,
            })
        if not ensayos:
            continue
        puntos.append({
            "punto_id":      p.get("punto_id") or "POT-AI",
            "profundidad_m": p.get("profundidad_m"),
            "tipo_perfil":   p.get("tipo_perfil"),
            "coordenadas":   p.get("coordenadas"),
            "fecha_ensayo":  p.get("fecha_ensayo"),
            "observaciones": None,
            "ensayos":       ensayos,
        })

    return {
        "proyecto": {
            "nombre":   proyecto.get("nombre") or "Proyecto POT",
            "cliente":  proyecto.get("cliente") or "",
            "ubicacion": proyecto.get("ubicacion") or "",
            "fecha":    proyecto.get("fecha") or "",
        },
        "puntos": puntos,
    }


def try_ai_extraction(pdf_text: str) -> dict | None:
    """
    Punto de entrada principal. Devuelve el resultado normalizado
    o None si no se pudo extraer nada.
    """
    raw = _extract_with_ai(pdf_text)
    if not raw:
        return None

    result = _normalize_ai_result(raw)
    if not result.get("puntos"):
        return None

    result["_ai_used"] = True
    return result
