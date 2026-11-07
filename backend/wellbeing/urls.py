from django.urls import path

from . import views

urlpatterns = [
    path('mood/', views.MoodView.as_view()),
    path('mood/today/', views.TodayView.as_view()),
    path('journal/', views.JournalListCreateView.as_view()),
    path('journal/prompt/', views.JournalPromptView.as_view()),
    path('journal/<uuid:entry_id>/', views.JournalDetailView.as_view()),
]
