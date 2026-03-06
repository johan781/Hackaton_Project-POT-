from django.contrib import admin
from .models import Hincado, TramoHincado


class TramoInline(admin.TabularInline):
    model = TramoHincado
    extra = 1
    fields = ['numero_tramo', 'prof_inicio_m', 'prof_fin_m', 'tiempo_avance_min', 'clasificacion']
    readonly_fields = ['clasificacion']


@admin.register(Hincado)
class HincadoAdmin(admin.ModelAdmin):
    list_display = ['punto_id', 'proyecto', 'fecha', 'profundidad_total_m', 'clasificacion_general']
    list_filter = ['proyecto', 'fecha']
    search_fields = ['punto_id', 'proyecto__nombre']
    inlines = [TramoInline]


@admin.register(TramoHincado)
class TramoHincadoAdmin(admin.ModelAdmin):
    list_display = ['hincado', 'numero_tramo', 'prof_inicio_m', 'prof_fin_m', 'tiempo_avance_min', 'clasificacion']
    list_filter = ['clasificacion', 'hincado__proyecto']
