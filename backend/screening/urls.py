from django.urls import path

from . import views

urlpatterns = [
    path('sessions/', views.SessionListCreateView.as_view()),
    path('sessions/<uuid:session_id>/', views.SessionDetailView.as_view()),
    path('sessions/<uuid:session_id>/answers/', views.SessionAnswersView.as_view()),
]
