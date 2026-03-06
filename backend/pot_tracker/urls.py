from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.projects.urls')),
    path('api/', include('apps.driving.urls')),
    path('api/', include('apps.load_tests.urls')),
    path('api/', include('apps.analyzer.urls')),
]
