from datetime import date, timedelta

from app.models import PregnancyProfile
from app.services import completion_for_log, pregnancy_context, week_range


def test_pregnancy_context_from_lmp():
    profile = PregnancyProfile(last_menstrual_period=date.today() - timedelta(days=70))
    context = pregnancy_context(profile)
    assert context["week"] == 10
    assert context["trimester"] == 1


def test_completion_is_deterministic():
    sections, percentage, complete = completion_for_log({"weight_kg": 60, "symptoms": [{"symptom": "fatigue"}]})
    assert sections["vitals"] is True
    assert sections["symptoms"] is True
    assert percentage == 29
    assert complete is False


def test_week_range_starts_on_monday():
    start, end = week_range()
    assert start.weekday() == 0
    assert (end - start).days == 6

