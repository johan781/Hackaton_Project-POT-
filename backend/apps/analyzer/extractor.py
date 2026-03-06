"""
POT File Extractor — uses Claude claude-sonnet-4-6 vision to parse scanned PDFs,
plain text, and Excel files containing Pull Out Test data.
"""
import base64
import json
import io
import os

import anthropic
import fitz  # PyMuPDF

KGF_TO_KN = 0.00980665

EXTRACTION_PROMPT = """
You are an expert geotechnical data extraction system for Pull Out Tests (POT) on solar farm pile foundations.

DOCUMENT FORMAT:
The document may be either:
A) A field data report with test tables per pile point (PDF/scanned format)
B) A raw machine output Excel file with (Desplazamiento [mm], Fuerza [kg]) column pairs

WHAT TO EXTRACT:
For each test point (pile / ensayo), extract up to 3 types of tests:
- tension_vertical   → "Prueba de Tensión Vertical" (axial pull-out / tracción)
- compresion_vertical → "Prueba de Compresión Vertical" (axial push-in)
- carga_lateral      → "Prueba de Carga Lateral" (lateral shear / corte lateral)

Each test is a MONOTONIC load-displacement curve: just (displacement, force) pairs measured at increasing load steps.
Do NOT look for hysteresis loops or loading/unloading phases — the data is simply a list of readings at each load step.

RETURN THIS EXACT JSON STRUCTURE:
{
  "proyecto": {
    "nombre": "project name (e.g. EL CARITO, SAN MARTIN)",
    "cliente": "client or company name",
    "ubicacion": "city, department or coordinates",
    "fecha": "date string (e.g. 03/08/2025)"
  },
  "puntos": [
    {
      "punto_id": "PLT-01 or Ensayo 1 IPE 160 — exact identifier from document",
      "profundidad_m": 2.5,
      "tipo_perfil": "C100/50 or IPE160 or W8X10 — profile type if visible",
      "coordenadas": "coordinates string if available, else null",
      "fecha_ensayo": "date if available per point, else null",
      "observaciones": "any handwritten notes or comments",
      "ensayos": [
        {
          "tipo": "tension_vertical",
          "nombre": "Prueba de Tensión Vertical",
          "carga_maxima_kgf": 694.0,
          "desplazamiento_maximo_mm": 25.8,
          "puntos": [
            {"desplazamiento_mm": 0.0, "fuerza_kg": 0.0},
            {"desplazamiento_mm": 0.49, "fuerza_kg": 365.0},
            {"desplazamiento_mm": 3.57, "fuerza_kg": 535.0}
          ]
        },
        {
          "tipo": "compresion_vertical",
          "nombre": "Prueba de Compresión Vertical",
          "carga_maxima_kgf": 600.0,
          "desplazamiento_maximo_mm": 18.3,
          "puntos": [
            {"desplazamiento_mm": 0.0, "fuerza_kg": 0.0}
          ]
        },
        {
          "tipo": "carga_lateral",
          "nombre": "Prueba de Carga Lateral",
          "carga_maxima_kgf": 560.0,
          "desplazamiento_maximo_mm": 23.26,
          "puntos": [
            {"desplazamiento_mm": 0.0, "fuerza_kg": 0.0}
          ]
        }
      ]
    }
  ]
}

EXTRACTION RULES:
1. Extract EVERY data row for each test — do not skip any reading
2. carga_maxima_kgf = the maximum force value found in that test's data
3. desplazamiento_maximo_mm = the maximum displacement found in that test's data
4. If a test type is marked N.A. or has no data, OMIT it from the ensayos array
5. For Excel files: each column pair labeled "Desplazamiento [mm]" and "Fuerza [kg]" is one test series; the label above tells the test type
6. For PDFs: read the force and displacement columns from each escalon row; "Fuerza Aplicada (kgf)" or "(kN)" is the force, "Desplazamiento (mm)" is the displacement — if force is in kN, convert to kgf by multiplying by 101.972 so the "puntos" always use kgf
7. Each "Ensayo N" in an Excel file becomes one entry in "puntos"
8. If you cannot read a value, use null
9. Return ONLY the JSON — no markdown fences, no explanation
"""


def pdf_to_base64_images(file_bytes: bytes, dpi: int = 150) -> list[str]:
    """Convert PDF pages to base64-encoded PNG images."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        images.append(base64.standard_b64encode(img_bytes).decode("utf-8"))
    doc.close()
    return images


def xlsx_to_text(file_bytes: bytes) -> str:
    """Extract text content from Excel file in a structured format for Claude."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    lines = []
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        lines.append(f"=== Sheet: {sheet_name} ===")
        for row in ws.iter_rows(values_only=True):
            row_data = []
            for c in row:
                if c is None:
                    row_data.append("")
                elif isinstance(c, float):
                    row_data.append(f"{c:.4f}".rstrip("0").rstrip("."))
                else:
                    row_data.append(str(c))
            if any(v for v in row_data):
                lines.append("\t".join(row_data))
    return "\n".join(lines)


def analyze_file(file_bytes: bytes, filename: str, api_key: str) -> dict:
    """
    Main entry point. Accepts raw file bytes and returns structured POT analysis.
    """
    client = anthropic.Anthropic(api_key=api_key)
    ext = filename.lower().rsplit(".", 1)[-1]

    messages = []
    debug_input = ""
    images = []

    if ext == "pdf":
        images = pdf_to_base64_images(file_bytes)
        debug_input = f"PDF with {len(images)} pages converted to images"
        content = []
        content.append({"type": "text", "text": EXTRACTION_PROMPT})
        for i, img_b64 in enumerate(images):
            content.append({"type": "text", "text": f"--- Page {i + 1} of {len(images)} ---"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": img_b64},
            })
        messages.append({"role": "user", "content": content})

    elif ext in ("xlsx", "xls"):
        text_content = xlsx_to_text(file_bytes)
        debug_input = text_content
        messages.append({
            "role": "user",
            "content": EXTRACTION_PROMPT + "\n\nExcel content:\n" + text_content,
        })

    elif ext == "txt":
        text_content = file_bytes.decode("utf-8", errors="replace")
        debug_input = text_content
        messages.append({
            "role": "user",
            "content": EXTRACTION_PROMPT + "\n\nText content:\n" + text_content,
        })
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=messages,
    )

    raw_text = response.content[0].text.strip()

    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        raw_text = raw_text.rsplit("```", 1)[0]

    data = json.loads(raw_text)

    # Inject debug info
    data["_debug"] = {
        "filename": filename,
        "ext": ext,
        "input_preview": debug_input[:3000] if isinstance(debug_input, str) else debug_input,
        "claude_raw_response": response.content[0].text.strip(),
        "pages_or_size": f"{len(images)} páginas" if ext == "pdf" else f"{len(file_bytes)} bytes",
    }

    return _enrich(data)


def _enrich(data: dict) -> dict:
    """Add computed kN fields and compliance logic."""
    for punto in data.get("puntos", []):
        punto_ok = True
        for ensayo in punto.get("ensayos", []):
            kgf_max = ensayo.get("carga_maxima_kgf") or 0
            disp_max = ensayo.get("desplazamiento_maximo_mm") or 0

            ensayo["carga_maxima_kn"] = round(kgf_max * KGF_TO_KN, 3)
            ensayo["cumple_criterio"] = disp_max < 25.0

            # Add kN to each data point + stiffness at that point
            for pt in ensayo.get("puntos", []):
                kg = pt.get("fuerza_kg") or 0
                disp = pt.get("desplazamiento_mm") or 0
                pt["fuerza_kn"] = round(kg * KGF_TO_KN, 4)
                pt["rigidez_kn_mm"] = round(pt["fuerza_kn"] / disp, 4) if disp else None

            if not ensayo["cumple_criterio"]:
                punto_ok = False

        punto["cumple_criterio"] = punto_ok
        punto["estado"] = "cumple" if punto_ok else "requiere_rediseno"

    return data
