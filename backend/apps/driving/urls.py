from rest_framework.routers import DefaultRouter
from .views import HincadoViewSet, TramoHincadoViewSet

router = DefaultRouter()
router.register(r'hincados', HincadoViewSet, basename='hincado')
router.register(r'tramos', TramoHincadoViewSet, basename='tramo')

urlpatterns = router.urls
