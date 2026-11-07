from datetime import timedelta

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from safety.models import AuditLog

from . import journal, trends
from .clock import today_ph
from .models import JournalEntry, JournalPrompt, MoodEntry

MAX_HISTORY_DAYS = 365
DEFAULT_HISTORY_DAYS = 30
MAX_JOURNAL_CHARS = 5000
DEFAULT_JOURNAL_LIMIT = 50
MAX_JOURNAL_LIMIT = 200


# ----------------------------------------------------------------------------------------------- mood

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


# -------------------------------------------------------------------------------------------- journal

class StrictCharField(serializers.CharField):
    """CharField would quietly turn 123 into '123'; journal text must really be text."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail('invalid')
        return super().to_internal_value(data)


class JournalWriteSerializer(serializers.Serializer):
    body = StrictCharField(max_length=MAX_JOURNAL_CHARS)
    prompt_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_prompt_id(self, value):
        if value is None:
            return None
        prompt = JournalPrompt.objects.filter(
            pk=value, review_status=JournalPrompt.ReviewStatus.PUBLISHED, is_active=True).first()
        if prompt is None:
            raise serializers.ValidationError('Unknown prompt.')
        return prompt


def _journal_entry(e):
    return {
        'entry_id': str(e.id),
        'written_at': e.written_at,
        'prompt_text': e.prompt.prompt_text if e.prompt_id else None,
        'body': e.get_text(),
        'reflection': e.get_reflection(),
    }


class JournalPromptView(APIView):
    def get(self, request):
        return Response(journal.current_prompt(request.user))


class JournalListCreateView(APIView):
    def post(self, request):
        serializer = JournalWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data['body']
        saved = journal.save_entry(request.user, body, prompt=serializer.validated_data.get('prompt_id'))
        saved = journal.complete_with_ai(request.user, saved, body)  # after the save has committed
        return Response({
            'entry_id': str(saved.entry.id),
            'written_at': saved.entry.written_at,
            'reflection': saved.reflection,
            'ai_status': saved.ai_status,
            'crisis': saved.crisis,
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        raw = request.query_params.get('limit', str(DEFAULT_JOURNAL_LIMIT))
        if not raw.isdigit() or not 1 <= int(raw) <= MAX_JOURNAL_LIMIT:
            return Response({'detail': f'limit must be a whole number from 1 to {MAX_JOURNAL_LIMIT}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        entries = JournalEntry.objects.filter(user=request.user).select_related('prompt')[:int(raw)]
        return Response([_journal_entry(e) for e in entries])


class JournalDetailView(APIView):
    def _entry(self, request, entry_id):
        return get_object_or_404(JournalEntry.objects.select_related('prompt'), pk=entry_id, user=request.user)

    def get(self, request, entry_id):
        return Response(_journal_entry(self._entry(request, entry_id)))

    def delete(self, request, entry_id):
        entry = self._entry(request, entry_id)
        with transaction.atomic():
            AuditLog.objects.create(
                actor_type=AuditLog.ActorType.USER, actor_id=request.user.user_id, action='DELETE_JOURNAL',
                target_type='journal_entry', target_id=entry.id, result=AuditLog.Result.ALLOWED)
            entry.delete()  # hard delete: no recovery
        return Response(status=status.HTTP_204_NO_CONTENT)
