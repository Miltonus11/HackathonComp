"""'Today' for daily features is the Philippine calendar day, decided by the server (never the phone)."""
from zoneinfo import ZoneInfo

from django.utils import timezone

PH_TZ = ZoneInfo('Asia/Manila')  # UTC+8, no daylight saving


def today_ph():
    return timezone.now().astimezone(PH_TZ).date()
