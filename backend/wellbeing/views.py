from datetime import timedelta

from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import trends
from .clock import today_ph
from .models import MoodEntry

MAX_HISTORY_DAYS = 365
DEFAULT_HISTORY_DAYS = 30


class MoodLogSerializer(serializers.Serializer):
    mood_score = serializers.IntegerField(min_value=1, max_value=10)
    reason_code = serializers.ChoiceField(choices=MoodEntry.Reason.choices, required=False,
                                          allow_null=True, allow_blank=True)

    def validate_reason_code(self, value):
        return value or None


def _entry(e):
    return {'id': str(e.id), 'entry_date': e.entry_date.isoformat(), 'mood_score': e.mood_score,
            'reason_code': e.reason_code, 'logged_at': e.logged_at}


def _already_logged():
    return Response({'code': 'already_logged', 'detail': "Today's mood is already logged."},
                    status=status.HTTP_409_CONFLICT)


class TodayView(APIView):
    def get(self, request):
        today = today_ph()
        entry = MoodEntry.objects.filter(user=request.user, entry_date=today).first()
        return Response({'date': today.isoformat(), 'logged': entry is not None,
                         'entry': _entry(entry) if entry else None})


class MoodView(APIView):
    def post(self, request):
        serializer = MoodLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        today = today_ph()  # the client never chooses the date
        if MoodEntry.objects.filter(user=request.user, entry_date=today).exists():
            return _already_logged()
        try:
            with transaction.atomic():
                entry = MoodEntry.objects.create(
                    user=request.user, entry_date=today, mood_score=serializer.validated_data['mood_score'],
                    reason_code=serializer.validated_data.get('reason_code'))
        except IntegrityError:  # two requests raced past the check above
            return _already_logged()
        return Response(_entry(entry), status=status.HTTP_201_CREATED)

    def get(self, request):
        raw = request.query_params.get('days', str(DEFAULT_HISTORY_DAYS))
        if not raw.isdigit() or not 1 <= int(raw) <= MAX_HISTORY_DAYS:
            return Response({'detail': f'days must be a whole number from 1 to {MAX_HISTORY_DAYS}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        today = today_ph()
        mine = MoodEntry.objects.filter(user=request.user)
        entries = mine.filter(entry_date__gte=today - timedelta(days=int(raw) - 1)).order_by('-entry_date')
        # The baseline always uses the same fixed window, so it doesn't change with the ?days= view.
        recent = mine.filter(entry_date__gte=today - timedelta(days=trends.BASELINE_WINDOW_DAYS - 1))
        return Response({
            'entries': [{'entry_date': e.entry_date.isoformat(), 'mood_score': e.mood_score,
                         'reason_code': e.reason_code} for e in entries],
            'baseline': trends.baseline(recent.values_list('mood_score', flat=True)),
        })
