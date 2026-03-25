#!/bin/sh
set -e

echo "▶ Aplicando migraciones..."
python manage.py migrate --noinput

echo "▶ Recopilando archivos estáticos..."
python manage.py collectstatic --noinput

echo "▶ Iniciando gunicorn..."
exec gunicorn pot_tracker.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
