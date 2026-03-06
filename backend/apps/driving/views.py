from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Hincado, TramoHincado
from .serializers import HincadoSerializer, HincadoListSerializer, TramoHincadoSerializer


class HincadoViewSet(viewsets.ModelViewSet):
    queryset = Hincado.objects.select_related('proyecto').prefetch_related('tramos').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return HincadoListSerializer
        return HincadoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        proyecto_id = self.request.query_params.get('proyecto')
        if proyecto_id:
            qs = qs.filter(proyecto_id=proyecto_id)
        return qs

    @action(detail=True, methods=['get'], url_path='clasificacion')
    def clasificacion(self, request, pk=None):
        hincado = self.get_object()
        tramos = hincado.tramos.all()
        return Response({
            'punto_id': hincado.punto_id,
            'clasificacion_general': hincado.clasificacion_general(),
            'tramos': [
                {
                    'numero': t.numero_tramo,
                    'prof_inicio_m': t.prof_inicio_m,
                    'prof_fin_m': t.prof_fin_m,
                    'tiempo_avance_min': t.tiempo_avance_min,
                    'clasificacion': t.clasificacion,
                }
                for t in tramos
            ],
        })


class TramoHincadoViewSet(viewsets.ModelViewSet):
    queryset = TramoHincado.objects.select_related('hincado').all()
    serializer_class = TramoHincadoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        hincado_id = self.request.query_params.get('hincado')
        if hincado_id:
            qs = qs.filter(hincado_id=hincado_id)
        return qs
