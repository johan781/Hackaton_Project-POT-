from rest_framework import serializers
from .models import Hincado, TramoHincado


class TramoHincadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TramoHincado
        fields = '__all__'


class HincadoSerializer(serializers.ModelSerializer):
    tramos = TramoHincadoSerializer(many=True, read_only=True)
    clasificacion_general = serializers.SerializerMethodField()

    class Meta:
        model = Hincado
        fields = '__all__'

    def get_clasificacion_general(self, obj):
        return obj.clasificacion_general()


class HincadoListSerializer(serializers.ModelSerializer):
    clasificacion_general = serializers.SerializerMethodField()

    class Meta:
        model = Hincado
        fields = ['id', 'punto_id', 'fecha', 'profundidad_total_m', 'proyecto', 'clasificacion_general']

    def get_clasificacion_general(self, obj):
        return obj.clasificacion_general()
