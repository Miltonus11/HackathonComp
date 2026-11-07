from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Barangay, Consent, UserProfile
from .serializers import BarangaySerializer, ConsentSerializer, ProfileSerializer


class BarangayListView(generics.ListAPIView):
    queryset = Barangay.objects.all()
    serializer_class = BarangaySerializer


class ProfileView(APIView):
    """The signed-in user's own profile. Barangay is the finest location stored."""

    def _profile(self, request):
        return UserProfile.objects.select_related('barangay').filter(user=request.user).first()

    def get(self, request):
        profile = self._profile(request)
        if not profile:
            return Response({'detail': 'Profile not created yet.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProfileSerializer(profile).data)

    def post(self, request):
        if self._profile(request):
            return Response({'detail': 'Profile already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        profile = self._profile(request)
        if not profile:
            return Response({'detail': 'Profile not created yet.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ConsentView(APIView):
    """GET current state per consent type; POST records a new decision (grant or withdraw)."""

    def get(self, request):
        return Response({
            t: Consent.has_active(request.user, t) for t in Consent.ConsentType.values
        })

    def post(self, request):
        serializer = ConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
