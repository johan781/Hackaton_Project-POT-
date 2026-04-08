"""
AI Analysis Agent — Multimodal Extractor
Uses Vision (Claude 3.5 Sonnet / Gemini 1.5) to analyze POT reports.
"""
from __future__ import annotations

import json
import os
import re
import io
import base64
from datetime import date
from PIL import Image

# Metadata and System Prompt
_SYSTEM_PROMPT = """Eres el **POT Agent**, un experto en geotecnia y análisis de ensayos Pull-Out Test (POT).
Tu tarea es analizar visualmente y mediante texto los informes de ensayos de carga lateral/vertical en postes.

### SCHEMA DE SALIDA (JSON ESTRICTO):
{
  "agente_analisis": "Resumen detallado de hallazgos. Si no encontraste datos, explica por qué.",
  "proyecto": {
    "nombre": "string o null (Busca 'Proyecto', 'Obra', 'Nombre del Proyecto')",
    "cliente": "string o null (Busca 'Cliente', 'Solicitante')",
    "ubicacion": "string o null (Busca 'Ubicación', 'Lugar', 'Coordenadas')",
    "fecha": "DD/MM/YYYY o null (Busca 'Fecha de Ensayo' o 'Fecha')"
  },
  "puntos": [
    {
      "punto_id": "ID del punto (ej: POT-01, POSTE 5). Búscalo cerca de 'Punto:', 'ID:', 'Poste No.'",
      "profundidad_m": número o null,
      "tipo_perfil": "string o null",
      "coordenadas": "string o null",
      "fecha_ensayo": "string o null",
      "ensayos": [
        {
          "tipo": "tension_vertical | compresion_vertical | carga_lateral (Nota: Si el reporte dice 'Tracción', úsalo como 'tension_vertical')",
          "puntos": [
            {"desplazamiento_mm": número, "fuerza_kg": número}
          ]
        }
      ]
    }
  ]
}

### REGLAS DE NEGOCIO CRÍTICAS:
1. **Detección Extrema de Tablas**: Busca tablas con encabezados como "Carga", "Fuerza", "Load", "KN", "KGF", "Desplazamiento", "Disp", "Lectura", "Settlement", "Deformation", "Escalón", "Step". 
   **NOTA**: Algunos formatos tienen 3 columnas de resultados pegadas: [Prueba de Compresión | Prueba de Tracción | Prueba de Lateral]. Debes extraer las tres de forma independiente.
2. **Normalización de Unidades**: 
   - Fuerza: Si está en kN, multiplícalo por 101.9716 para obtener kgf. 
   - Desplazamiento: Siempre en mm.
3. **Múltiples Ensayos**: Un solo punto de hincado (ej: POT A-2) puede tener ensayos de Compresión, Tracción y Lateral SIMULTÁNEAMENTE. Extráelos todos en el array "ensayos".
4. **Fase de CARGA**: Extrae solo los incrementos de carga. Si ves que la fuerza baja drásticamente o el desplazamiento se reduce, es fase de descarga; detente ahí.
5. **No Alucines**: Si el documento NO tiene tablas numéricas de carga, deja el array "puntos" vacío pero explica en "agente_analisis" qué viste.
6. **Prioridad Visual**: Si el texto extraído es confuso, confía en lo que ves en las imágenes de las tablas.
7. **COMPLETITUD MANDATORIA**: DEBES extraer TODOS los puntos de ensayo encontrados y TODOS los tipos de prueba realizados en cada uno.
8. **MUESTREO DE FILAS**: Para evitar que el JSON se corte, si una tabla individual tiene más de 12 filas de datos, extrae solo 8 puntos representativos (el primero, el último, y 6 intermedios bien distribuidos). NUNCA omitas un punto completo, solo reduce las filas internas si es necesario.

Devuelve SOLO el JSON válido."""

def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 80) -> list[str]:
    """Selecciona páginas relevantes (metadatos + tablas) para no saturar la IA."""
    images_b64 = []
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        
        # Palabras clave que indican una tabla de resultados
        table_keywords = ["tabla", "resultado", "ensayo", "pot", "carga", "fuerza", "desplazamiento", "curva", "incremento", "resumen", "anexo", "tracción", "traccion"]
        
        relevant_indices = set()
        
        # 1. Siempre incluir las primeras 10 páginas (contexto extendido)
        for i in range(min(total_pages, 10)):
            relevant_indices.add(i)
            
        # 2. Buscar páginas con palabras clave en todo el documento
        for i in range(10, total_pages):
            text = doc[i].get_text().lower()
            # Si la página tiene "pot" y "carga" o "tabla", es muy probable que sea un ensayo
            if ("pot" in text and "carga" in text) or ("tabla" in text and "desplazamiento" in text):
                relevant_indices.add(i)
                
        # 3. Siempre incluir las últimas 5 páginas (suelen tener tablas resumen o anexos)
        if total_pages > 15:
            for i in range(max(0, total_pages - 5), total_pages):
                relevant_indices.add(i)
            
        # Ordenar y limitar si aún es demasiado grande
        sorted_indices = sorted(list(relevant_indices))
        if len(sorted_indices) > max_pages:
            print(f"[POT Agent] Demasiadas páginas ({len(sorted_indices)}), podando a {max_pages}")
            sorted_indices = sorted_indices[:max_pages]
            
        print(f"[POT Agent] Smart Selection (v2): Enviando páginas {sorted_indices}")
        
        for i in sorted_indices:
            page = doc[i]
            # Matrix(1.2, 1.2) ahorra más espacio para documentos de 100 pags
            pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2))
            img_data = pix.tobytes("jpeg")
            images_b64.append(base64.b64encode(img_data).decode("utf-8"))
            
        doc.close()
    except Exception as e:
        print(f"[POT Agent] Error in Smart Selection: {e}")
    return images_b64

def _call_claude_vision(pdf_text: str, images_b64: list[str]) -> str | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        
        content = []
        content.append({"type": "text", "text": f"Texto extraído del PDF:\n{pdf_text[:10000]}"})
        
        for img_b64 in images_b64:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": img_b64
                }
            })
            
        content.append({"type": "text", "text": "Analiza este informe POT y devuelve los datos estructurados siguiendo el sistema estricto."})

        message = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=8192,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
        return message.content[0].text
    except Exception as e:
        print(f"[POT Agent] Claude Error: {e}")
        return None

def _call_gemini_vision(pdf_text: str, images_b64: list[str]) -> str | None:
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        
        contents = [
            types.Part.from_text(text=f"Texto extraído del documento:\n{pdf_text[:100000]}")
        ]
        
        for img_b64 in images_b64:
            contents.append(
                types.Part.from_bytes(
                    data=base64.b64decode(img_b64),
                    mime_type='image/png'
                )
            )
        
        contents.append(
            types.Part.from_text(text="Analiza el informe POT y devuelve el JSON según el esquema solicitado.")
        )
        
        # Intentar modelos en orden de disponibilidad verificado en tu cuenta
        models_to_try = [
            'gemini-flash-latest',       # El alias más estable para 1.5-flash
            'gemini-1.5-flash',          # Estándar
            'gemini-2.5-flash',          # Siguiente generación disponible en tu cuenta
            'gemini-2.0-flash-lite',     # Modelo ligero (menos probable que tenga cuota 0)
            'gemini-2.0-flash'           # Última opción (dio 429 quota 0 antes)
        ]
        last_err = None

        for model_name in models_to_try:
            print(f"[POT Agent] Intentando con modelo: {model_name}...")
            try:
                response = client.models.generate_content(
                    model=model_name,
                    config=types.GenerateContentConfig(
                        system_instruction=_SYSTEM_PROMPT,
                        max_output_tokens=8192,
                    ),
                    contents=contents
                )
                if response and response.text:
                    print(f"[POT Agent] ¡Respuesta recibida correctamente de {model_name}!")
                    return response.text
                else:
                    print(f"[POT Agent] El modelo {model_name} devolvió una respuesta vacía.")
            except Exception as e:
                last_err = e
                print(f"[POT Agent] Error con {model_name}: {e}")
                # Si es 404 (no existe) o 429 (quota 0), intentamos con el siguiente
                if "404" in str(e) or "429" in str(e):
                    continue
                else:
                    # Otros errores (como falta de API Key o error de red) podrían ser fatales
                    break
        
        # Si llegamos aquí, falló. Imprimir diagnóstico.
        print(f"[POT Agent] Gemini Error final tras reintentos: {last_err}")
        return None
    except Exception as e:
        print(f"[POT Agent] Gemini (genai) Critical Error: {e}")
        return None

def _extract_json_from_text(text: str) -> dict | None:
    """Extrae y carga un JSON de un bloque de texto, manejando markdown y ruido."""
    try:
        # Buscar el primer '{' y el último '}'
        start = text.find('{')
        end = text.rfind('}')
        if start == -1 or end == -1:
            print("[POT Agent] No se encontró el inicio '{' o fin '}' en la respuesta.")
            return None
        
        json_str = text[start:end+1]
        return json.loads(json_str)
    except Exception as e:
        print(f"[POT Agent] JSON extraction error: {e}")
        return None

def _normalize_ai_result(raw: dict) -> dict:
    TIPO_LABELS = {
        "tension_vertical":    "Prueba de Tensión Vertical",
        "compresion_vertical": "Prueba de Compresión Vertical",
        "carga_lateral":       "Prueba de Carga Lateral",
    }
    KGF_TO_KN = 0.00980665
    KN_TO_KGF = 101.9716

    proyecto = raw.get("proyecto") or {}
    puntos_raw = raw.get("puntos") or []

    puntos = []
    for p in puntos_raw:
        ensayos = []
        for e in (p.get("ensayos") or []):
            raw_pts = e.get("puntos") or []
            pts = []
            for pt in raw_pts:
                # Flexibilidad total en nombres de llaves y unidades
                # Intentar obtener fuerza
                f_val = pt.get("fuerza_kg") or pt.get("fuerza") or pt.get("carga") or pt.get("load") or pt.get("kgf")
                f_kn = pt.get("fuerza_kn") or pt.get("kn") or pt.get("load_kn")
                
                # Intentar obtener desplazamiento
                d_val = pt.get("desplazamiento_mm") or pt.get("desplazamiento") or pt.get("disp") or pt.get("lectura") or pt.get("mm")
                
                try:
                    if d_val is None: continue
                    d = float(d_val)
                    
                    # Calcular fuerza en kgf y kN
                    if f_kn is not None:
                        kn = float(f_kn)
                        kg = kn * KN_TO_KGF
                    elif f_val is not None:
                        kg = float(f_val)
                        kn = kg * KGF_TO_KN
                    else:
                        continue
                        
                    pts.append({
                        "desplazamiento_mm": round(d, 3),
                        "fuerza_kg": round(kg, 2),
                        "fuerza_kn": round(kn, 3),
                        "rigidez_kn_mm": round(kn / d, 3) if d > 0 else 0
                    })
                except (ValueError, TypeError):
                    continue

            if not pts: continue
            
            tipo_raw = e.get("tipo", "carga_lateral").lower()
            tipo = "tension_vertical" if "trac" in tipo_raw or "tens" in tipo_raw else tipo_raw
            if tipo not in TIPO_LABELS: 
                # Fallback por si acaso
                if "compr" in tipo: tipo = "compresion_vertical"
                elif "lat" in tipo: tipo = "carga_lateral"
                else: tipo = "carga_lateral"
            
            max_kg = max(pt["fuerza_kg"] for pt in pts)
            max_kn = max(pt["fuerza_kn"] for pt in pts)
            max_disp = max(pt["desplazamiento_mm"] for pt in pts)
            
            ensayos.append({
                "tipo": tipo,
                "nombre": TIPO_LABELS.get(tipo, tipo),
                "carga_maxima_kgf": round(max_kg, 2),
                "carga_maxima_kn": round(max_kn, 3),
                "desplazamiento_maximo_mm": round(max_disp, 3),
                "puntos": pts,
            })
        
        if ensayos:
            puntos.append({
                "punto_id": p.get("punto_id") or f"POT-AI-{len(puntos)+1}",
                "profundidad_m": p.get("profundidad_m"),
                "tipo_perfil": p.get("tipo_perfil"),
                "coordenadas": p.get("coordenadas"),
                "fecha_ensayo": p.get("fecha_ensayo"),
                "observaciones": p.get("observaciones"),
                "ensayos": ensayos,
            })

    return {
        "agente_analisis": raw.get("agente_analisis", "Análisis completado por el agente."),
        "proyecto": {
            "nombre":   proyecto.get("nombre") or "Proyecto POT",
            "cliente":  proyecto.get("cliente") or "",
            "ubicacion": proyecto.get("ubicacion") or "",
            "fecha":    proyecto.get("fecha") or str(date.today()),
        },
        "puntos": puntos,
    }

def try_ai_extraction(pdf_bytes: bytes, pdf_text: str = "") -> dict | None:
    """Intenta extracción usando gemini primero (gratis) and then fallback."""
    google_key = os.getenv("GOOGLE_API_KEY", "").strip()
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    
    if not google_key and not anthropic_key:
        return {
            "agente_analisis": "⚠️ El agente de IA está desactivado (Falta API Key).",
            "puntos": []
        }

    print("[POT Agent] Generando imágenes del PDF...")
    images = _pdf_to_images(pdf_bytes)
    print(f"[POT Agent] {len(images)} imágenes generadas.")
    
    raw_response = None

    if google_key:
        print("[POT Agent] Llamando a Gemini Vision...")
        raw_response = _call_gemini_vision(pdf_text, images)
    
    if not raw_response and anthropic_key:
        print("[POT Agent] Gemini falló o no tiene key, llamando a Claude Vision...")
        raw_response = _call_claude_vision(pdf_text, images)
        
    if not raw_response:
        print("[POT Agent] El Agente no devolvió ninguna respuesta (vacío o error de API).")
        return None

    # DIAGNÓSTICO: Imprimir respuesta cruda en la terminal
    print("\n" + "="*50)
    print("--- RAW AI RESPONSE (START) ---")
    print(raw_response)
    print("--- RAW AI RESPONSE (END) ---")
    print("="*50 + "\n")

    data = _extract_json_from_text(raw_response)
    if not data:
        print("[POT Agent] No se pudo encontrar un JSON válido en la respuesta de la IA.")
        return None

    try:
        print("[POT Agent] Normalizando datos del Agente...")
        result = _normalize_ai_result(data)
        result["_ai_used"] = True
        print(f"[POT Agent] Análisis finalizado: {len(result.get('puntos', []))} puntos encontrados.")
        return result
    except Exception as e:
        print(f"[POT Agent] Error normalizando el resultado de la IA: {e}")
        return None

