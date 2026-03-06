from django.db import models
from apps.driving.models import Hincado

KGF_TO_KN = 0.00980665

FASE_CHOICES = [
    ('CARGA', 'Carga'),
    ('MANT', 'Mantenimiento'),
    ('DESC', 'Descarga'),
]

LIMITE_DISP_TOTAL_MM = 25.0
LIMITE_DISP_RESIDUAL_MM = 10.0


class EnsayoCarga(models.Model):
    hincado = models.ForeignKey(Hincado, on_delete=models.CASCADE, related_name='ensayos')
    fecha_ensayo = models.DateField()
    operador = models.CharField(max_length=100, blank=True)
    norma = models.CharField(max_length=100, default='ASTM D3966')
    cumple_criterio = models.BooleanField(null=True, blank=True)

    class Meta:
        ordering = ['hincado', 'fecha_ensayo']
        verbose_name = 'Ensayo de Carga'
        verbose_name_plural = 'Ensayos de Carga'

    def __str__(self):
        return f'Ensayo {self.hincado} — {self.fecha_ensayo}'

    def evaluar_cumplimiento(self):
        ciclos = self.ciclos.prefetch_related('puntos').all()
        if not ciclos.exists():
            return None
        ultimo = ciclos.last()
        puntos = list(ultimo.puntos.all())
        if not puntos:
            return None

        puntos_carga = [p for p in puntos if p.fase == 'CARGA']
        puntos_desc = [p for p in puntos if p.fase == 'DESC']

        if not puntos_carga:
            return None

        disp_max = max(p.desplazamiento_mm for p in puntos_carga)
        disp_resid = min((p.desplazamiento_mm for p in puntos_desc), default=0.0)

        cumple = disp_max < LIMITE_DISP_TOTAL_MM and disp_resid < LIMITE_DISP_RESIDUAL_MM
        self.cumple_criterio = cumple
        self.save(update_fields=['cumple_criterio'])
        return {
            'desplazamiento_maximo_mm': round(disp_max, 2),
            'desplazamiento_residual_mm': round(disp_resid, 2),
            'carga_maxima_kn': round(max(p.carga_kgf * KGF_TO_KN for p in puntos_carga), 3),
            'cumple_total': disp_max < LIMITE_DISP_TOTAL_MM,
            'cumple_residual': disp_resid < LIMITE_DISP_RESIDUAL_MM,
            'cumple': cumple,
        }


class CicloCarga(models.Model):
    ensayo = models.ForeignKey(EnsayoCarga, on_delete=models.CASCADE, related_name='ciclos')
    numero_ciclo = models.PositiveIntegerField()

    class Meta:
        ordering = ['ensayo', 'numero_ciclo']
        unique_together = [['ensayo', 'numero_ciclo']]
        verbose_name = 'Ciclo de Carga'
        verbose_name_plural = 'Ciclos de Carga'

    def __str__(self):
        return f'{self.ensayo} — Ciclo {self.numero_ciclo}'


class PuntoCarga(models.Model):
    ciclo = models.ForeignKey(CicloCarga, on_delete=models.CASCADE, related_name='puntos')
    fase = models.CharField(max_length=5, choices=FASE_CHOICES)
    carga_kgf = models.FloatField()
    desplazamiento_mm = models.FloatField()
    tiempo_min = models.FloatField()

    class Meta:
        ordering = ['ciclo', 'tiempo_min']
        verbose_name = 'Punto de Carga'
        verbose_name_plural = 'Puntos de Carga'

    def __str__(self):
        return f'{self.ciclo} [{self.fase}] {self.carga_kgf} kgf / {self.desplazamiento_mm} mm'

    @property
    def carga_kn(self):
        return round(self.carga_kgf * KGF_TO_KN, 4)

    @property
    def rigidez_lateral(self):
        if self.desplazamiento_mm and self.desplazamiento_mm != 0:
            return round(self.carga_kn / self.desplazamiento_mm, 4)
        return None
