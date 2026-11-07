from django.urls import path

from . import views

urlpatterns = [
    path('barangays/', views.BarangayListView.as_view()),
    path('profile/', views.ProfileView.as_view()),
    path('consents/', views.ConsentView.as_view()),
]
