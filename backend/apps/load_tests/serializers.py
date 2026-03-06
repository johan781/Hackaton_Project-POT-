from rest_framework import serializers
from .models import EnsayoCarga, CicloCarga, PuntoCarga


class PuntoCargaSerializer(serializers.ModelSerializer):
    carga_kn = serializers.ReadOnlyField()
    rigidez_lateral = serializers.ReadOnlyField()

    class Meta:
        model = PuntoCarga
        fields = '__all__'


class CicloCargaSerializer(serializers.ModelSerializer):
    puntos = PuntoCargaSerializer(many=True, read_only=True)

    class Meta:
        model = CicloCarga
        fields = '__all__'


class EnsayoCargaSerializer(serializers.ModelSerializer):
    ciclos = CicloCargaSerializer(many=True, read_only=True)

    class Meta:
        model = EnsayoCarga
        fields = '__all__'


class EnsayoCargaListSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnsayoCarga
        fields = ['id', 'hincado', 'fecha_ensayo', 'operador', 'norma', 'cumple_criterio']
