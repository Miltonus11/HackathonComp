from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import flow, presenters, services
from .models import AssessmentSession
from .serializers import AnswerSerializer, ChoiceSerializer

_STATUS = {
    'consent_required': status.HTTP_403_FORBIDDEN,
    'profile_required': status.HTTP_403_FORBIDDEN,
    'session_complete': status.HTTP_409_CONFLICT,
}


def _flow_error(exc):
    return Response({'code': exc.code, 'detail': exc.message}, status=_STATUS.get(exc.code, status.HTTP_400_BAD_REQUEST))


def _own_session(request, session_id):
    return get_object_or_404(AssessmentSession, pk=session_id, user=request.user)


class SessionListCreateView(APIView):
    def get(self, request):
        sessions = AssessmentSession.objects.filter(user=request.user).order_by('-started_at')
        return Response([presenters.session_summary(s) for s in sessions])

    def post(self, request):
        trigger = (AssessmentSession.TriggerSource.USER_INITIATED
                   if AssessmentSession.objects.filter(user=request.user).exists()
                   else AssessmentSession.TriggerSource.INITIAL)
        try:
            started = services.start_session(request.user, trigger_source=trigger)
        except services.FlowError as exc:
            return _flow_error(exc)
        return Response({
            'session_id': str(started.session.id),
            'next': presenters.next_form(request.user, started.next_instrument),
        }, status=status.HTTP_201_CREATED)


class SessionDetailView(APIView):
    def get(self, request, session_id):
        session = _own_session(request, session_id)
        return Response(presenters.session_detail(request.user, session))


class SessionAnswersView(APIView):
    """Submit one instrument's answers. The server scores it and says what comes next."""

    def post(self, request, session_id):
        session = _own_session(request, session_id)
        serializer = AnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            step = services.submit_instrument(
                session, serializer.validated_data['instrument'], serializer.responses_dict())
        except services.FlowError as exc:
            return _flow_error(exc)
        return Response({
            'crisis': services.crisis_payload(request.user) if step.crisis else None,
            'result': presenters.result(request.user, step.assessment),
            'next': presenters.next_form(request.user, step.next_instrument),
            'choice': flow.CHOICE_MOOD_QUESTIONS if step.choice_pending else None,
            'completed': step.completed,
        })


class SessionChoiceView(APIView):
    """A not-good-WHO-5 person says whether they want the full PHQ-9 ("more questions about mood").

    Accept: the PHQ-9 form comes back as 'next'. Decline: the session is completed with just the
    WHO-5 and GAD-7 results.
    """

    def post(self, request, session_id):
        session = _own_session(request, session_id)
        serializer = ChoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            step = services.answer_phq9_choice(session, serializer.validated_data['accept'])
        except services.FlowError as exc:
            return _flow_error(exc)
        return Response({
            'next': presenters.next_form(request.user, step.next_instrument),
            'choice': None,
            'completed': step.completed,
        })
