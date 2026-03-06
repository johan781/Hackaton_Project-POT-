# Workflows — POT Analytics & Tracker Designer

## /init-project
Scaffold completo del monorepo desde cero.

```bash
# 1. Estructura de directorios
mkdir -p backend/apps frontend .agent/rules .agent/skills/pot-parser .agent/workflows

# 2. Backend — virtualenv + Django
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install django djangorestframework django-cors-headers python-dotenv
django-admin startproject pot_tracker .
python manage.py startapp projects apps/projects
python manage.py startapp driving apps/driving
python manage.py startapp load_tests apps/load_tests

# 3. Frontend — Vite + React
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios recharts @tanstack/react-table react-router-dom lucide-react jspdf html2canvas
npm install -D tailwindcss @tailwindcss/vite

# 4. Migraciones iniciales
cd ../backend
python manage.py makemigrations projects driving load_tests
python manage.py migrate
python manage.py createsuperuser --username admin --email admin@pot.local

# 5. Cargar fixtures de prueba
python manage.py loaddata fixtures/initial_data.json
```

---

## /add-test
Agrega un nuevo punto de ensayo (endpoint + modelo + fixture).

```bash
# Parámetros: PUNTO_ID (ej: PV-05), PROYECTO_ID (ej: 1)
PUNTO_ID=$1
PROYECTO_ID=$2

# 1. Crear fixture base para el nuevo punto
python manage.py shell -c "
from apps.projects.models import Proyecto
from apps.driving.models import Hincado
p = Proyecto.objects.get(id=${PROYECTO_ID})
h = Hincado.objects.create(
    proyecto=p,
    punto_id='${PUNTO_ID}',
    fecha='$(date +%Y-%m-%d)',
    profundidad_total_m=3.0
)
print(f'Hincado creado: {h.id}')
"

# 2. El endpoint DRF ya existe en /api/hincados/ — POST con:
# {
#   "proyecto": PROYECTO_ID,
#   "punto_id": "PV-05",
#   "fecha": "2025-01-15",
#   "profundidad_total_m": 3.0
# }
```

---

## /run-dev
Levanta ambos servidores en modo desarrollo.

```bash
# Terminal 1 — Backend
cd backend && .venv\Scripts\activate && python manage.py runserver
# → http://localhost:8000/api/
# → http://localhost:8000/admin/

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:5173  (con proxy a :8000)
```

---

## /check-criterios
Verifica cumplimiento de criterios POT para todos los ensayos de un proyecto.

```bash
# Endpoint: GET /api/projects/{id}/resumen/
# Respuesta esperada:
# {
#   "proyecto": "Planta Solar Norte - Sector A",
#   "total_puntos": 10,
#   "puntos_cumplen": 8,
#   "puntos_requieren_rediseno": 2,
#   "detalle": [
#     {"punto_id": "PV-01", "estado": "cumple", "disp_max": 18.2, "disp_resid": 3.1},
#     {"punto_id": "PV-03", "estado": "requiere_rediseno", "disp_max": 28.5, "disp_resid": 12.0}
#   ]
# }
curl http://localhost:8000/api/projects/1/resumen/
```

---

## /export-report
Genera reporte ejecutivo en PDF para un proyecto.

```bash
# Desde el frontend: navegar a /projects/{id}/report
# Hacer clic en "Exportar PDF"
# El reporte incluye:
#   - Tabla resumen de cumplimiento por punto
#   - Gráficas de carga vs desplazamiento
#   - Clasificación de terreno
#   - Estadísticas globales del proyecto
```
