import os
import traceback
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from apps.projects.models import Proyecto
from apps.driving.models import Hincado
from apps.load_tests.models import EnsayoCarga
from .extractor import analyze_file


ALLOWED_EXTENSIONS = {"pdf", "txt", "xlsx", "xls"}
_PLACEHOLDER_KEY = "your-anthropic-api-key-here"


def _get_api_key():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or key == _PLACEHOLDER_KEY:
        return None
    return key


class AnalyzeFileView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "No file provided."}, status=400)

        ext = file.name.lower().rsplit(".", 1)[-1]
        if ext not in ALLOWED_EXTENSIONS:
            return Response({"error": f"Formato no soportado: .{ext}. Usa PDF, XLSX o TXT."}, status=400)

        api_key = _get_api_key()
        if not api_key:
            return Response({
                "error": "ANTHROPIC_API_KEY no configurada.",
                "fix": "Abre backend/.env y reemplaza 'your-anthropic-api-key-here' con tu clave de https://console.anthropic.com/"
            }, status=503)

        try:
            file_bytes = file.read()
            result = analyze_file(file_bytes, file.name, api_key)
            return Response(result)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)
        except Exception as e:
            tb = traceback.format_exc()
            print("[POT Analyzer] ERROR:\n", tb)
            return Response({"error": f"El análisis falló: {str(e)}", "traceback": tb}, status=500)


class SaveAnalysisView(APIView):
    def post(self, request):
        data = request.data
        proyecto_data = data.get("proyecto", {})
        puntos_data = data.get("puntos", [])

        if not proyecto_data.get("nombre"):
            return Response({"error": "El nombre del proyecto es requerido."}, status=400)

        # Store full analysis JSON (strip _debug to keep DB clean)
        stored_json = {k: v for k, v in data.items() if k != "_debug"}

        proyecto = Proyecto.objects.create(
            nombre=proyecto_data.get("nombre", "Sin nombre"),
            cliente=proyecto_data.get("cliente", ""),
            ubicacion=proyecto_data.get("ubicacion", ""),
            fecha_inicio=_parse_date(proyecto_data.get("fecha")),
            descripcion="Importado desde análisis de archivo POT.",
            analysis_json=stored_json,
        )

        # Persist hincados for relational queries
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
