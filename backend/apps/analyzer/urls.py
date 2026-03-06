from django.urls import path
from .views import AnalyzeFileView, SaveAnalysisView

urlpatterns = [
    path('analyze/', AnalyzeFileView.as_view(), name='analyze-file'),
    path('analyze/save/', SaveAnalysisView.as_view(), name='save-analysis'),
]
