from django.urls import path
from .views import AnalyzeFileView, SaveAnalysisView, DebugPdfView

urlpatterns = [
    path('analyze/', AnalyzeFileView.as_view(), name='analyze-file'),
    path('analyze/save/', SaveAnalysisView.as_view(), name='save-analysis'),
    path('analyze/debug/', DebugPdfView.as_view(), name='debug-pdf'),
]
