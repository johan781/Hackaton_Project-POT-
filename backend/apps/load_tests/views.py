from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import EnsayoCarga, CicloCarga, PuntoCarga
from .serializers import (
    EnsayoCargaSerializer, EnsayoCargaListSerializer,
    CicloCargaSerializer, PuntoCargaSerializer,
)


class EnsayoCargaViewSet(viewsets.ModelViewSet):
    queryset = EnsayoCarga.objects.select_related('hincado').prefetch_related('ciclos__puntos').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return EnsayoCargaListSerializer
        return EnsayoCargaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        hincado_id = self.request.query_params.get('hincado')
        if hincado_id:
            qs = qs.filter(hincado_id=hincado_id)
        return qs

    @action(detail=True, methods=['post'], url_path='evaluar')
    def evaluar(self, request, pk=None):
        ensayo = self.get_object()
        resultado = ensayo.evaluar_cumplimiento()
        if resultado is None:
            return Response({'detail': 'Sin datos suficientes para evaluar.'}, status=400)
        return Response(resultado)


class CicloCargaViewSet(viewsets.ModelViewSet):
    queryset = CicloCarga.objects.prefetch_related('puntos').all()
    serializer_class = CicloCargaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ensayo_id = self.request.query_params.get('ensayo')
        if ensayo_id:
            qs = qs.filter(ensayo_id=ensayo_id)
        return qs


class PuntoCargaViewSet(viewsets.ModelViewSet):
    queryset = PuntoCarga.objects.select_related('ciclo').all()
    serializer_class = PuntoCargaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ciclo_id = self.request.query_params.get('ciclo')
        if ciclo_id:
            qs = qs.filter(ciclo_id=ciclo_id)
        return qs

    def create(self, request, *args, **kwargs):
        many = isinstance(request.data, list)
        serializer = self.get_serializer(data=request.data, many=many)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)
