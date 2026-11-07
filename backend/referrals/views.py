from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from screening.models import AssessmentSession

from . import presenters, services
from .models import Referral, Service

_STATUS = {'consent_required': status.HTTP_403_FORBIDDEN}


def _error(exc):
    return Response({'code': exc.code, 'detail': exc.message}, status=_STATUS.get(exc.code, status.HTTP_400_BAD_REQUEST))


class SuggestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()


class ReferralUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Referral.Status.choices, required=False)
    shared_with_professional = serializers.BooleanField(required=False)


class SuggestView(APIView):
    def post(self, request):
        serializer = SuggestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = get_object_or_404(AssessmentSession, pk=serializer.validated_data['session_id'], user=request.user)
        try:
            suggested = services.suggest(request.user, session)
        except services.ReferralError as exc:
            return _error(exc)
        return Response({'referrals': [presenters.referral(r, reasons) for r, reasons in suggested]})


class ServiceListView(APIView):
    """Browsable directory. Services with no sector rows are open to everyone; city-wide ones match any barangay."""

    def get(self, request):
        p = request.query_params
        qs = Service.objects.filter(is_active=True).select_related('barangay').prefetch_related('languages', 'sectors')
        if p.get('service_type'):
            qs = qs.filter(service_type=p['service_type'])
        if p.get('cost_type'):
            qs = qs.filter(cost_type=p['cost_type'])
        if p.get('crisis', '').lower() == 'true':
            qs = qs.filter(is_crisis_service=True)
        if p.get('barangay'):
            if not p['barangay'].isdigit():
                return Response({'detail': 'barangay must be an id.'}, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(Q(barangay_id=int(p['barangay'])) | Q(barangay__isnull=True))
        if p.get('language'):
            qs = qs.filter(languages__language_code=p['language'])
        if p.get('sector'):
            qs = qs.filter(Q(sectors__sector=p['sector']) | Q(sectors__isnull=True))
        return Response([presenters.service(s) for s in qs.distinct().order_by('name')])


class ReferralListView(APIView):
    def get(self, request):
        qs = Referral.objects.filter(user=request.user).select_related('service__barangay').prefetch_related(
            'service__languages', 'service__sectors')
        return Response([presenters.referral(r) for r in qs])


class ReferralDetailView(APIView):
    def patch(self, request, referral_id):
        referral = get_object_or_404(
            Referral.objects.select_related('service__barangay'), pk=referral_id, user=request.user)
        serializer = ReferralUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            services.update_referral(request.user, referral, **serializer.validated_data)
        except services.ReferralError as exc:
            return _error(exc)
        return Response(presenters.referral(referral))
