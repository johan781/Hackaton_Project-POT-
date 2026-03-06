from django.db import models


class Proyecto(models.Model):
    nombre = models.CharField(max_length=200)
    cliente = models.CharField(max_length=200, blank=True)
    ubicacion = models.CharField(max_length=500)
    fecha_inicio = models.DateField()
    descripcion = models.TextField(blank=True)
    analysis_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_inicio']
        verbose_name = 'Proyecto'
        verbose_name_plural = 'Proyectos'

    def __str__(self):
        return self.nombre
