from rest_framework.routers import DefaultRouter
from .views import EnsayoCargaViewSet, CicloCargaViewSet, PuntoCargaViewSet

router = DefaultRouter()
router.register(r'ensayos', EnsayoCargaViewSet, basename='ensayo')
router.register(r'ciclos', CicloCargaViewSet, basename='ciclo')
router.register(r'puntos', PuntoCargaViewSet, basename='punto')

urlpatterns = router.urls
