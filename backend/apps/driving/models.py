from django.db import models
from apps.projects.models import Proyecto

CLASIFICACION_CHOICES = [
    ('Suave', 'Suave (< 1 min/tramo)'),
    ('Medio', 'Medio (1-3 min/tramo)'),
    ('Duro', 'Duro (3-5 min/tramo)'),
    ('Rechazo', 'Rechazo (> 5 min/tramo)'),
]


def clasificar_tramo(tiempo_avance_min):
    if tiempo_avance_min < 1.0:
        return 'Suave'
    elif tiempo_avance_min < 3.0:
        return 'Medio'
    elif tiempo_avance_min < 5.0:
        return 'Duro'
    return 'Rechazo'


class Hincado(models.Model):
    proyecto = models.ForeignKey(Proyecto, on_delete=models.CASCADE, related_name='hincados')
    punto_id = models.CharField(max_length=20, help_text='Ej: PV-01, PV-02')
    fecha = models.DateField()
    profundidad_total_m = models.FloatField(help_text='Profundidad total de hincado en metros')
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['proyecto', 'punto_id']
        unique_together = [['proyecto', 'punto_id']]
        verbose_name = 'Hincado'
        verbose_name_plural = 'Hincados'

    def __str__(self):
        return f'{self.proyecto} — {self.punto_id}'

    def clasificacion_general(self):
        tramos = self.tramos.all()
        if not tramos.exists():
            return 'Sin datos'
        clases = [t.clasificacion for t in tramos]
        if 'Rechazo' in clases:
            return 'Rechazo'
        if clases.count('Duro') > len(clases) * 0.5:
            return 'Duro'
        if 'Duro' in clases:
            return 'Mixto-Duro'
        if 'Medio' in clases:
            return 'Mixto-Medio'
        return 'Suave'


class TramoHincado(models.Model):
    hincado = models.ForeignKey(Hincado, on_delete=models.CASCADE, related_name='tramos')
    numero_tramo = models.PositiveIntegerField()
    prof_inicio_m = models.FloatField()
    prof_fin_m = models.FloatField()
    tiempo_avance_min = models.FloatField()
    clasificacion = models.CharField(max_length=10, choices=CLASIFICACION_CHOICES, blank=True)

    class Meta:
        ordering = ['hincado', 'numero_tramo']
        verbose_name = 'Tramo de Hincado'
        verbose_name_plural = 'Tramos de Hincado'

    def save(self, *args, **kwargs):
        if not self.clasificacion:
            self.clasificacion = clasificar_tramo(self.tiempo_avance_min)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.hincado} — Tramo {self.numero_tramo} ({self.clasificacion})'
