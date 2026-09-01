from django.urls import path

from .views import RulebookDetailView, RulebookListCreateView

urlpatterns = [
    path('rulebooks/', RulebookListCreateView.as_view()),
    path('rulebooks/<int:document_id>/', RulebookDetailView.as_view()),
]
