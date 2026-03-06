from django.contrib import admin
from .models import Proyecto


@admin.register(Proyecto)
class ProyectoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'cliente', 'ubicacion', 'fecha_inicio', 'created_at']
    search_fields = ['nombre', 'cliente', 'ubicacion']
    list_filter = ['fecha_inicio']
