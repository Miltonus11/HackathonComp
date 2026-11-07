from datetime import date, datetime, timezone as dt_timezone
from unittest import mock

from django.test import SimpleTestCase

from wellbeing import clock, trends


def utc(*args):
    return datetime(*args, tzinfo=dt_timezone.utc)


class PhilippineDayTests(SimpleTestCase):
    def today_at(self, when):
        with mock.patch('wellbeing.clock.timezone.now', return_value=when):
            return clock.today_ph()

    def test_morning_utc_is_same_day(self):
        self.assertEqual(self.today_at(utc(2026, 11, 7, 3, 0)), date(2026, 11, 7))

    def test_just_before_manila_midnight(self):
        self.assertEqual(self.today_at(utc(2026, 11, 7, 15, 59)), date(2026, 11, 7))

    def test_manila_midnight_rolls_to_next_day(self):
        self.assertEqual(self.today_at(utc(2026, 11, 7, 16, 0)), date(2026, 11, 8))

    def test_late_utc_evening_is_already_tomorrow_in_manila(self):
        self.assertEqual(self.today_at(utc(2026, 12, 31, 20, 0)), date(2027, 1, 1))


class BaselineTests(SimpleTestCase):
    def test_none_until_enough_entries(self):
        self.assertIsNone(trends.baseline([]))
        self.assertIsNone(trends.baseline([5, 6]))

    def test_mean_rounded_to_one_decimal(self):
        self.assertEqual(trends.baseline([5, 6, 8]), 6.3)
        self.assertEqual(trends.baseline([7, 7, 7]), 7.0)

    def test_minimum_is_three_entries(self):
        self.assertEqual(trends.MIN_ENTRIES_FOR_BASELINE, 3)
        self.assertIsNotNone(trends.baseline([1, 1, 1]))


class TrendLabelTests(SimpleTestCase):
    def test_none_without_a_baseline(self):
        self.assertIsNone(trends.trend_label(5, None))

    def test_labels(self):
        self.assertEqual(trends.trend_label(4, 6.5), 'LOWER_THAN_USUAL')
        self.assertEqual(trends.trend_label(8, 6.0), 'HIGHER_THAN_USUAL')
        self.assertEqual(trends.trend_label(6, 6.5), 'ABOUT_USUAL')
        self.assertEqual(trends.trend_label(5, 6.5), 'ABOUT_USUAL')   # a gap under 2 is normal variation

    def test_boundaries_are_inclusive_at_two_points(self):
        self.assertEqual(trends.trend_label(4, 6.0), 'LOWER_THAN_USUAL')
        self.assertEqual(trends.trend_label(8, 6.0), 'HIGHER_THAN_USUAL')
