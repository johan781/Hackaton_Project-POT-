from django.contrib import admin
from .models import EnsayoCarga, CicloCarga, PuntoCarga


class PuntoInline(admin.TabularInline):
    model = PuntoCarga
    extra = 1
    fields = ['fase', 'carga_kgf', 'desplazamiento_mm', 'tiempo_min']


class CicloInline(admin.TabularInline):
    model = CicloCarga
    extra = 0
    show_change_link = True


@admin.register(EnsayoCarga)
class EnsayoCargaAdmin(admin.ModelAdmin):
    list_display = ['hincado', 'fecha_ensayo', 'operador', 'norma', 'cumple_criterio']
    list_filter = ['cumple_criterio', 'hincado__proyecto']
    search_fields = ['hincado__punto_id', 'hincado__proyecto__nombre']
    inlines = [CicloInline]


@admin.register(CicloCarga)
class CicloCargaAdmin(admin.ModelAdmin):
    list_display = ['ensayo', 'numero_ciclo']
    inlines = [PuntoInline]


@admin.register(PuntoCarga)
class PuntoCargaAdmin(admin.ModelAdmin):
    list_display = ['ciclo', 'fase', 'carga_kgf', 'desplazamiento_mm', 'tiempo_min']
    list_filter = ['fase']
