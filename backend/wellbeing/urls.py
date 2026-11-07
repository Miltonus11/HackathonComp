from django.urls import path

from . import views

urlpatterns = [
    path('mood/', views.MoodView.as_view()),
    path('mood/today/', views.TodayView.as_view()),
]
