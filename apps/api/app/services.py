from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any

from .ai import GeminiAdapter
from .config import get_settings
from .models import HealthLog, PregnancyProfile, User


def pregnancy_context(profile: PregnancyProfile | None, today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    if not profile:
        return {"week": None, "days": None, "trimester": None, "days_until_due": None}
    week = None
    days = None
    if profile.last_menstrual_period and profile.last_menstrual_period <= today:
        total_days = (today - profile.last_menstrual_period).days
        week = min(42, max(1, total_days // 7 or 1))
        days = total_days % 7
    elif profile.due_date:
        gestational_days = 280 - (profile.due_date - today).days
        week = min(42, max(1, (gestational_days + 6) // 7))
        days = max(0, gestational_days % 7)
    trimester = 1 if week and week <= 12 else 2 if week and week <= 27 else 3 if week else None
    days_until_due = max(0, (profile.due_date - today).days) if profile.due_date else None
    return {"week": week, "days": days, "trimester": trimester, "days_until_due": days_until_due}


def completion_for_log(payload: dict[str, Any]) -> tuple[dict[str, bool], int, bool]:
    sections = {
        "vitals": any(payload.get(k) is not None for k in ("weight_kg", "heart_rate_bpm")) or bool(payload.get("blood_pressure")),
        "mood": bool(payload.get("mood_log")) or payload.get("energy_level") is not None or payload.get("stress_level") is not None,
        "sleep": bool(payload.get("sleep")) or payload.get("hours_slept") is not None,
        "symptoms": bool(payload.get("symptoms")),
        "exercise": bool(payload.get("exercises")),
        "nutrition": bool(payload.get("food_intake")) or bool(payload.get("hydration")),
        "fetal_movement": bool(payload.get("fetal_movement")),
    }
    percentage = round(sum(sections.values()) / len(sections) * 100)
    return sections, percentage, percentage >= 80


def week_range(offset: int = 0) -> tuple[date, date]:
    today = date.today() - timedelta(days=offset * 7)
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def build_weekly_report(logs: list[HealthLog], week_number: int | None, trimester: int | None) -> dict[str, Any]:
    symptoms: list[str] = []
    mood: list[str] = []
    weights: list[float] = []
    energy: list[int] = []
    stress: list[int] = []
    sleep: list[float] = []
    water: list[float] = []
    exercise_minutes = 0
    exercise_types: dict[str, dict[str, int]] = {}
    for log in logs:
        symptoms.extend(item.get("symptom", "other") for item in (log.symptoms or []))
        mood.extend(item.get("mood") for item in (log.mood_log or []) if item.get("mood"))
        if log.weight_kg is not None:
            weights.append(log.weight_kg)
        if log.energy_level is not None:
            energy.append(log.energy_level)
        if log.stress_level is not None:
            stress.append(log.stress_level)
        hours = (log.sleep or {}).get("total_hours") or log.hours_slept
        if hours is not None:
            sleep.append(hours)
        water.append(float((log.hydration or {}).get("water_liters", 0) or 0))
        for exercise in log.exercises or []:
            minutes = int(exercise.get("duration_minutes", 0) or 0)
            exercise_minutes += minutes
            kind = exercise.get("type", "other")
            current = exercise_types.setdefault(kind, {"total_minutes": 0, "sessions_count": 0})
            current["total_minutes"] += minutes
            current["sessions_count"] += 1
    symptom_counts = Counter(symptoms)
    mood_counts = Counter(mood)
    return {
        "summary": {
            "overall_status": "Good" if not symptom_counts else "Stable",
            "status_score": 7 if not symptom_counts else 5,
            "key_symptoms": [name for name, _ in symptom_counts.most_common(5)],
            "most_frequent_symptoms": [{"symptom": name, "frequency": count} for name, count in symptom_counts.most_common(5)],
            "avg_energy_level": round(sum(energy) / len(energy), 1) if energy else None,
            "avg_stress_level": round(sum(stress) / len(stress), 1) if stress else None,
            "dominant_moods": [{"mood": name, "frequency": count} for name, count in mood_counts.most_common(3)],
            "days_logged": len(logs),
            "log_completion_rate": round(len(logs) / 7 * 100),
            "concerns_detected": [],
            "positive_highlights": ["You kept tracking your pregnancy this week."] if logs else [],
        },
        "vitals_summary": {
            "avg_weight_kg": round(sum(weights) / len(weights), 1) if weights else None,
            "weight_change_kg": round(weights[-1] - weights[0], 1) if len(weights) > 1 else None,
            "avg_heart_rate_bpm": round(sum(l.heart_rate_bpm for l in logs if l.heart_rate_bpm) / len([l for l in logs if l.heart_rate_bpm])) if any(l.heart_rate_bpm for l in logs) else None,
        },
        "activities": {
            "total_exercise_minutes": exercise_minutes,
            "exercise_days_count": sum(bool(l.exercises) for l in logs),
            "exercises_by_type": [{"type": key, **value} for key, value in exercise_types.items()],
            "avg_sleep_hours": round(sum(sleep) / len(sleep), 1) if sleep else None,
            "avg_water_intake_liters": round(sum(water) / len(water), 1) if water else 0,
            "total_water_intake_liters": round(sum(water), 1),
            "exercise_goal_met": exercise_minutes >= 150,
            "hydration_goal_met": (sum(water) / len(water) if water else 0) >= 2,
        },
        "contractions": {"total_contractions": 0, "avg_duration_seconds": None, "avg_interval_minutes": None},
        "daily_data": [
            {"date": log.log_date.isoformat(), "weight": log.weight_kg, "sleep": (log.sleep or {}).get("total_hours") or log.hours_slept, "energy": log.energy_level, "water": (log.hydration or {}).get("water_liters", 0), "exercise_minutes": sum(int(x.get("duration_minutes", 0) or 0) for x in log.exercises or []), "symptom_count": len(log.symptoms or [])}
            for log in logs
        ],
        "pregnancy_week": week_number,
        "trimester": trimester,
        "health_log_ids": [log.id for log in logs],
    }


def default_nutrition_plan(context: dict[str, Any]) -> dict[str, Any]:
    return {
        "daily_targets": {"calories": 2200, "protein_grams": 75, "calcium_mg": 1000, "iron_mg": 27, "folic_acid_mcg": 600, "fiber_grams": 28},
        "weekly_meals": [{"day": day, "breakfast": {"food": "Oats with fruit and yoghurt", "portion": "1 bowl"}, "lunch": {"food": "Lean protein, whole grains and vegetables", "portion": "1 plate"}, "dinner": {"food": "Cooked vegetables, protein and healthy carbohydrate", "portion": "1 plate"}, "snacks": [{"food": "Fruit and nuts", "portion": "1 serving"}]} for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")],
        "nutrient_focus": [{"nutrient": "Iron", "reason": "Supports maternal blood volume and oxygen delivery."}, {"nutrient": "Folate", "reason": "Important for healthy fetal development."}],
        "foods_to_avoid": ["Raw or undercooked meat and eggs", "Unpasteurized dairy products", "High-mercury fish"],
        "general_advice": ["Drink water regularly.", "Choose a variety of foods and discuss supplements with your clinician."],
        "pregnancy_week": context.get("week"),
    }


def default_exercise_plan(context: dict[str, Any]) -> dict[str, Any]:
    days = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
    return {
        "weekly_goal": {"total_minutes": 150, "days_per_week": 5, "intensity": "moderate"},
        "daily_exercise_plan": [{"day": day, "rest_day": day in ("Wednesday", "Sunday"), "exercises": [] if day in ("Wednesday", "Sunday") else [{"name": "Comfortable walking", "duration_minutes": 30, "intensity": "moderate", "safety_notes": "Stop if you feel pain, dizziness, bleeding, or shortness of breath."}]} for day in days],
        "safety_guidelines": ["Stay hydrated and listen to your body.", "Ask your healthcare professional before changing activity, especially with a high-risk pregnancy."],
        "pregnancy_week": context.get("week"),
    }


async def generate_nutrition_plan(user: User, logs: list[HealthLog], context: dict[str, Any]) -> tuple[dict[str, Any], str]:
    fallback = default_nutrition_plan(context)
    key = get_settings().gemini_api_key_nutrition_suggestions
    if not key:
        return fallback, "rules"
    prompt = f"Create a safe pregnancy nutrition plan as JSON. Pregnancy context: {context}. Recent health logs: {len(logs)}. Return daily_targets, weekly_meals, nutrient_focus, foods_to_avoid, general_advice. Include a medical disclaimer."
    plan = await GeminiAdapter(key).generate_json(prompt, fallback)
    return plan, "gemini"


async def generate_exercise_plan(user: User, logs: list[HealthLog], context: dict[str, Any]) -> tuple[dict[str, Any], str]:
    fallback = default_exercise_plan(context)
    key = get_settings().gemini_api_key_exercise_suggestions
    if not key:
        return fallback, "rules"
    prompt = f"Create a safe pregnancy exercise plan as JSON. Pregnancy context: {context}. Recent health logs: {len(logs)}. Return weekly_goal, daily_exercise_plan, safety_guidelines and a medical disclaimer."
    plan = await GeminiAdapter(key).generate_json(prompt, fallback)
    return plan, "gemini"


async def generate_chat_reply(text: str, context_messages: list[dict[str, str]]) -> str:
    settings = get_settings()
    if len(text) > settings.max_chat_prompt_chars:
        raise ValueError("Prompt too long")
    context = "\n".join(f"{item['role']}: {item['content']}" for item in context_messages[-10:])
    fallback = "I’m here to support your pregnancy journey. For urgent or severe symptoms, contact your healthcare professional or local emergency service."
    if not settings.gemini_api_key:
        return fallback
    prompt = f"You are BabyStar, a warm pregnancy companion. Never diagnose or prescribe. Encourage professional care for medical concerns. Recent conversation:\n{context}\nUser: {text}\nAnswer in two concise paragraphs."
    try:
        return await GeminiAdapter(settings.gemini_api_key, settings.chatbot_model).generate(prompt)
    except Exception:
        return fallback


def weekly_advice(context: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    symptoms = report.get("summary", {}).get("key_symptoms", [])
    return {
        "pregnancy_week": context.get("week"),
        "trimester": context.get("trimester"),
        "guidance": {
            "fetal_development": "Your baby continues to grow and develop this week.",
            "self_care": "Rest, hydrate, and make time for gentle movement when comfortable.",
            "nutrition_tip": "Include protein, iron-rich foods, and a variety of fruits and vegetables.",
            "activity_tip": "Aim for regular moderate activity if your clinician has approved it.",
            "risk_management": "Contact your healthcare professional about persistent or severe symptoms.",
        },
        "symptoms": symptoms,
        "disclaimer": "This information is educational and does not replace professional medical advice.",
    }

