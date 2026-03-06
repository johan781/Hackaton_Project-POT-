from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Proyecto
from .serializers import ProyectoSerializer


class ProyectoViewSet(viewsets.ModelViewSet):
    queryset = Proyecto.objects.all()
    serializer_class = ProyectoSerializer

    @action(detail=True, methods=['get'], url_path='analysis')
    def analysis(self, request, pk=None):
        proyecto = self.get_object()
        if not proyecto.analysis_json:
            return Response({"error": "Este proyecto no tiene análisis guardado."}, status=404)
        return Response(proyecto.analysis_json)

    @action(detail=True, methods=['get'], url_path='resumen')
    def resumen(self, request, pk=None):
        proyecto = self.get_object()
        hincados = proyecto.hincados.prefetch_related('ensayos__ciclos__puntos').all()
        detalle = []
        cumplen = 0
        requieren_rediseno = 0
        no_evaluados = 0

        for h in hincados:
            ensayo = h.ensayos.last()
            if not ensayo:
                no_evaluados += 1
                detalle.append({
                    'punto_id': h.punto_id,
                    'estado': 'no_evaluado',
                    'disp_max': None,
                    'disp_resid': None,
                })
                continue

            resultado = ensayo.evaluar_cumplimiento()
            if resultado is None:
                no_evaluados += 1
                estado = 'no_evaluado'
            elif resultado['cumple']:
                cumplen += 1
                estado = 'cumple'
            else:
                requieren_rediseno += 1
                estado = 'requiere_rediseno'

            detalle.append({
                'punto_id': h.punto_id,
                'ensayo_id': ensayo.id,
                'estado': estado,
                'disp_max': resultado['desplazamiento_maximo_mm'] if resultado else None,
                'disp_resid': resultado['desplazamiento_residual_mm'] if resultado else None,
                'carga_max_kn': resultado['carga_maxima_kn'] if resultado else None,
            })

        return Response({
            'proyecto': proyecto.nombre,
            'total_puntos': hincados.count(),
            'puntos_cumplen': cumplen,
            'puntos_requieren_rediseno': requieren_rediseno,
            'puntos_no_evaluados': no_evaluados,
            'detalle': detalle,
        })
