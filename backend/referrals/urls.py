from django.urls import path

from . import views

urlpatterns = [
    path('services/', views.ServiceListView.as_view()),
    path('referrals/', views.ReferralListView.as_view()),
    path('referrals/suggest/', views.SuggestView.as_view()),
    path('referrals/<uuid:referral_id>/', views.ReferralDetailView.as_view()),
]
