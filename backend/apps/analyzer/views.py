import io
import traceback
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from apps.projects.models import Proyecto
from apps.driving.models import Hincado
from apps.load_tests.models import EnsayoCarga
from .extractor import (
    analyze_file, _words_to_rows, _cluster_x, _rows_to_table,
    _parse_ensayo_table_b, _extract_metadata_text,
)


ALLOWED_EXTENSIONS = {"pdf", "txt", "xlsx", "xls"}


class AnalyzeFileView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided."}, status=400)

        ext = file.name.lower().rsplit(".", 1)[-1]
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"error": f"Formato no soportado: .{ext}. Usa PDF, XLSX o TXT."},
                status=400,
            )

        try:
            file_bytes = file.read()
            result = analyze_file(file_bytes, file.name)
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            tb = traceback.format_exc()
            print("[POT Parser] ERROR:\n", tb)
            return Response(
                {"error": f"El análisis falló: {str(e)}", "traceback": tb},
                status=500,
            )


class SaveAnalysisView(APIView):
    def post(self, request):
        data = request.data
        proyecto_data = data.get("proyecto", {})
        puntos_data = data.get("puntos", [])

        if not proyecto_data.get("nombre"):
            return Response({"error": "El nombre del proyecto es requerido."}, status=400)

        stored_json = {k: v for k, v in data.items() if k != "_debug"}

        proyecto = Proyecto.objects.create(
            nombre=proyecto_data.get("nombre", "Sin nombre"),
            cliente=proyecto_data.get("cliente", ""),
            ubicacion=proyecto_data.get("ubicacion", ""),
            fecha_inicio=_parse_date(proyecto_data.get("fecha")),
            descripcion="Importado desde análisis de archivo POT.",
            analysis_json=stored_json,
        )

        for punto_data in puntos_data:
            hincado = Hincado.objects.create(
                proyecto=proyecto,
                punto_id=punto_data.get("punto_id", "POT-?"),
                fecha=_parse_date(proyecto_data.get("fecha")),
                profundidad_total_m=punto_data.get("profundidad_m") or 0,
                observaciones=punto_data.get("observaciones") or "",
            )
            EnsayoCarga.objects.create(
                hincado=hincado,
                fecha_ensayo=_parse_date(proyecto_data.get("fecha")),
                norma="ASTM D3966",
                cumple_criterio=punto_data.get("cumple_criterio"),
            )

        return Response({"id": proyecto.id, "nombre": proyecto.nombre}, status=201)


class DebugPdfView(APIView):
    """
    POST un PDF → devuelve lo que pdfplumber y PyMuPDF extraen de cada página.
    Úsalo para diagnosticar por qué un PDF no se parsea correctamente.
    """
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file or not file.name.lower().endswith(".pdf"):
            return Response({"error": "Sube un archivo PDF."}, status=400)

        file_bytes = file.read()
        pages_info = []

        try:
            import pdfplumber
            import fitz

            fitz_doc = fitz.open(stream=file_bytes, filetype="pdf")

            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                for i, page in enumerate(pdf.pages[:5]):
                    # ── pdfplumber ──────────────────────────────────────
                    raw_text   = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                    plumber_words = page.extract_words(x_tolerance=3, y_tolerance=3,
                                                       keep_blank_chars=False)

                    # Reconstruir tabla con pdfplumber
                    pb_rows = pb_table = pb_escalonrows = []
                    if plumber_words:
                        pb_rows    = _words_to_rows(plumber_words, row_gap=8)
                        centers    = _cluster_x(pb_rows, merge_dist=20)
                        pb_table   = _rows_to_table(pb_rows, centers)
                        pb_escalonrows = [r for r in pb_table
                                          if r and __import__('re').match(r"^\s*\d+\s*%", r[0])]

                    # ── PyMuPDF ─────────────────────────────────────────
                    fitz_page  = fitz_doc[i]
                    fitz_raw   = fitz_page.get_text("words")  # (x0,y0,x1,y1,text,…)
                    fitz_words = [
                        {"x0": w[0], "top": w[1], "x1": w[2], "bottom": w[3], "text": w[4]}
                        for w in fitz_raw
                    ]

                    mupdf_rows = mupdf_table = mupdf_escalonrows = []
                    if fitz_words:
                        mupdf_rows   = _words_to_rows(fitz_words, row_gap=8)
                        centers2     = _cluster_x(mupdf_rows, merge_dist=20)
                        mupdf_table  = _rows_to_table(mupdf_rows, centers2)
                        mupdf_escalonrows = [r for r in mupdf_table
                                             if r and __import__('re').match(r"^\s*\d+\s*%", r[0])]

                    pages_info.append({
                        "page": i + 1,
                        "raw_text_preview": raw_text[:800],
                        "pdfplumber": {
                            "words_found": len(plumber_words),
                            "reconstructed_rows": len(pb_rows),
                            "escalon_rows_detected": len(pb_escalonrows),
                            "table_sample": pb_table[:8],
                            "escalon_sample": pb_escalonrows[:4],
                        },
                        "pymupdf": {
                            "words_found": len(fitz_words),
                            "reconstructed_rows": len(mupdf_rows),
                            "escalon_rows_detected": len(mupdf_escalonrows),
                            "table_sample": mupdf_table[:8],
                            "escalon_sample": mupdf_escalonrows[:4],
                        },
                        "metadata_detected": _extract_metadata_text(raw_text),
                    })

            fitz_doc.close()

        except Exception as e:
            return Response({"error": str(e), "traceback": traceback.format_exc()}, status=500)

        return Response({"pages": pages_info})


def _parse_date(date_str):
    from datetime import date, datetime
    if not date_str:
        return date.today()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except (ValueError, TypeError):
            pass
    return date.today()
