from __future__ import annotations

import secrets
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from .config import get_settings
from .db import SessionLocal, get_db, init_db
from .models import (
    Association,
    Conversation,
    ConversationMessage,
    DietPlan,
    ExercisePlan,
    HealthLog,
    Notification,
    NotificationPreferences,
    PregnancyProfile,
    Quiz,
    QuizAttempt,
    QuizQuestion,
    User,
    UserSession,
    WeeklyAdvice,
    WeeklyReport,
)
from .schemas import (
    AnswerRequest,
    ChangePasswordRequest,
    ChatMessageRequest,
    ConnectPartnerRequest,
    GoogleLoginRequest,
    HealthLogPayload,
    LoginRequest,
    PermissionsRequest,
    ProfileUpdateRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    RenameConversationRequest,
)
from .security import (
    attach_session_cookie,
    clear_session_cookie,
    create_session,
    get_current_user,
    hash_password,
    require_admin,
    is_expired,
    token_digest,
    verify_password,
)
from .services import (
    build_weekly_report,
    completion_for_log,
    generate_chat_reply,
    generate_exercise_plan,
    generate_nutrition_plan,
    pregnancy_context,
    week_range,
    weekly_advice,
)

settings = get_settings()
api = APIRouter(prefix="/api/v1")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalized_phone(value: str | None) -> str | None:
    if not value:
        return None
    return "".join(ch for ch in value if ch.isdigit() or ch == "+")


def profile_dict(profile: PregnancyProfile | None) -> dict[str, Any] | None:
    if not profile:
        return None
    return {
        "last_menstrual_period": profile.last_menstrual_period,
        "due_date": profile.due_date,
        "delivery_date": profile.delivery_date,
        "height_cm": profile.height_cm,
        "pre_pregnancy_weight_kg": profile.pre_pregnancy_weight_kg,
        "blood_type": profile.blood_type,
        "allergies": profile.allergies or [],
        "medical_conditions": profile.medical_conditions or [],
        "is_high_risk": profile.is_high_risk,
        "gravida": profile.gravida,
        "para": profile.para,
        "primary_physician": profile.primary_physician,
        "hospital_name": profile.hospital_name,
        "status": profile.status,
    }


def user_dict(user: User) -> dict[str, Any]:
    context = pregnancy_context(user.pregnancy_profile)
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": " ".join(x for x in (user.first_name, user.last_name) if x),
        "email": user.email,
        "phone_number": user.phone_number,
        "profile_image_url": user.profile_image_url,
        "role": user.role,
        "is_active": user.is_active,
        "is_email_verified": user.is_email_verified,
        "timezone": user.timezone,
        "language": user.language,
        "pregnancy_profile": profile_dict(user.pregnancy_profile),
        "pregnancy_context": context,
        "notification_preferences": {
            key: getattr(user.notification_preferences, key)
            for key in ("email", "push", "sms", "daily_reminders", "weekly_report_ready", "appointment_reminders", "partner_updates", "health_alerts", "tips_and_articles")
        } if user.notification_preferences else None,
    }


def notification_dict(item: Notification) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "message": item.message,
        "type": item.type,
        "category": item.category,
        "priority": item.priority,
        "action_url": item.action_url,
        "action_label": item.action_label,
        "metadata": item.metadata_json or {},
        "read": item.read_at is not None,
        "created_at": item.created_at,
    }


def log_dict(log: HealthLog) -> dict[str, Any]:
    result = {column.name: getattr(log, column.name) for column in HealthLog.__table__.columns if column.name not in {"deleted_at"}}
    result["created_at"] = log.created_at
    result["updated_at"] = log.updated_at
    return result


def report_dict(report: WeeklyReport) -> dict[str, Any]:
    return {
        "id": report.id,
        "week_number": report.week_number,
        "trimester": report.trimester,
        "start_date": report.start_date,
        "end_date": report.end_date,
        "summary": report.summary or {},
        "vitals_summary": report.vitals_summary or {},
        "activities": report.activities or {},
        "contractions": report.contractions or {},
        "comparison": report.comparison or {},
        "status": report.status,
    }


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        self.connections[user_id].discard(websocket)
        if not self.connections[user_id]:
            self.connections.pop(user_id, None)

    async def send(self, user_id: int, payload: dict[str, Any]) -> None:
        for websocket in list(self.connections.get(user_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(user_id, websocket)


manager = ConnectionManager()


def ensure_profile(db: Session, user: User) -> PregnancyProfile:
    if not user.pregnancy_profile:
        user.pregnancy_profile = PregnancyProfile(user_id=user.id)
        db.flush()
    return user.pregnancy_profile


def create_notification(db: Session, user_id: int, title: str, message: str, *, category: str = "system", action_url: str | None = None, priority: str = "normal", metadata: dict | None = None) -> Notification:
    notification = Notification(user_id=user_id, title=title, message=message, category=category, action_url=action_url, priority=priority, metadata_json=metadata or {})
    db.add(notification)
    db.flush()
    return notification


def active_logs(db: Session, user_id: int, start: date | None = None, end: date | None = None) -> list[HealthLog]:
    conditions = [HealthLog.user_id == user_id, HealthLog.deleted_at.is_(None)]
    if start:
        conditions.append(HealthLog.log_date >= start)
    if end:
        conditions.append(HealthLog.log_date <= end)
    return list(db.scalars(select(HealthLog).where(*conditions).order_by(HealthLog.log_date)).all())


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "babystar-api"}


@api.post("/auth/register")
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    email = payload.email.strip().lower() if payload.email else None
    phone = normalized_phone(payload.phone_number)
    if not email and not phone:
        raise HTTPException(400, "Email or phone number is required")
    if payload.password != payload.password2:
        raise HTTPException(400, "Passwords do not match")
    if email and db.scalar(select(User).where(User.email == email)):
        raise HTTPException(400, "Email already in use")
    if phone and db.scalar(select(User).where(User.phone_number == phone)):
        raise HTTPException(400, "Phone number already in use")
    parts = payload.fullname.strip().split()
    user = User(first_name=parts[0], last_name=" ".join(parts[1:]), email=email, phone_number=phone, password_hash=hash_password(payload.password), terms_accepted_at=now_utc())
    db.add(user)
    db.flush()
    user.pregnancy_profile = PregnancyProfile(user_id=user.id)
    user.notification_preferences = NotificationPreferences(user_id=user.id)
    create_notification(db, user.id, "Welcome to BabyStar", "Complete your pregnancy profile to receive personalized guidance.", category="system", action_url="/profile/edit", priority="high")
    db.commit()
    token = create_session(db, user, request)
    response = JSONResponse({"success": True, "redirect": "/profile", "user": user_dict(user)})
    attach_session_cookie(response, token)
    return response


@api.post("/auth/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    value = payload.email_or_phone.strip()
    user = db.scalar(select(User).where(or_(User.email == value.lower(), User.phone_number == normalized_phone(value))))
    if not user or not verify_password(payload.password, user.password_hash):
        if user:
            user.login_attempts += 1
            if user.login_attempts >= 5:
                user.lock_until = now_utc() + timedelta(hours=2)
            db.commit()
        raise HTTPException(400, "Invalid credentials")
    if user.lock_until and not is_expired(user.lock_until):
        raise HTTPException(423, "Account temporarily locked")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")
    user.login_attempts = 0
    user.lock_until = None
    user.last_login_at = now_utc()
    db.commit()
    token = create_session(db, user, request)
    redirect = payload.redirect if payload.redirect and payload.redirect.startswith("/") else "/"
    if user.role == "admin":
        redirect = "/admin"
    response = JSONResponse({"success": True, "redirect": redirect, "user": user_dict(user)})
    attach_session_cookie(response, token)
    return response


@api.post("/auth/google")
def google_login(payload: GoogleLoginRequest, request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    if not settings.google_client_id:
        raise HTTPException(501, "Google login is not configured")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        claims = id_token.verify_oauth2_token(payload.credential, google_requests.Request(), settings.google_client_id)
    except Exception as exc:
        raise HTTPException(401, "Invalid Google credential") from exc
    email = claims.get("email", "").lower()
    if not email or claims.get("email_verified") is not True:
        raise HTTPException(401, "Google account email is not verified")
    user = db.scalar(select(User).where(or_(User.google_id == claims.get("sub"), User.email == email)))
    if not user:
        user = User(email=email, google_id=claims.get("sub"), auth_provider="google", is_email_verified=True, first_name=claims.get("given_name", ""), last_name=claims.get("family_name", ""), profile_image_url=claims.get("picture"))
        db.add(user)
        db.flush()
        user.pregnancy_profile = PregnancyProfile(user_id=user.id)
        user.notification_preferences = NotificationPreferences(user_id=user.id)
    else:
        user.google_id = user.google_id or claims.get("sub")
        user.is_email_verified = True
        user.profile_image_url = user.profile_image_url or claims.get("picture")
    db.commit()
    token = create_session(db, user, request)
    redirect = payload.redirect if payload.redirect and payload.redirect.startswith("/") else "/"
    response = JSONResponse({"success": True, "redirect": redirect, "user": user_dict(user)})
    attach_session_cookie(response, token)
    return response


@api.get("/auth/google/config")
def google_config(response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return {"success": True, "configured": bool(settings.google_client_id), "client_id": settings.google_client_id}


@api.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict[str, bool]:
    token = request.cookies.get(settings.session_cookie)
    if token:
        session = db.scalar(select(UserSession).where(UserSession.token_hash == token_digest(token)))
        if session:
            db.delete(session)
            db.commit()
    clear_session_cookie(response)
    return {"success": True}


@api.get("/auth/me")
def me(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"success": True, "user": user_dict(user)}


@api.get("/profile")
def get_profile(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"success": True, "user": user_dict(user)}


@api.put("/profile")
def update_profile(payload: ProfileUpdateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    values = payload.model_dump(exclude_unset=True)
    profile_payload = values.pop("pregnancy_profile", None)
    preferences_payload = values.pop("notification_preferences", None)
    if "phone_number" in values:
        values["phone_number"] = normalized_phone(values["phone_number"])
    if "email" in values and values["email"]:
        values["email"] = values["email"].lower().strip()
    for key, value in values.items():
        setattr(user, key, value)
    if profile_payload is not None:
        profile = ensure_profile(db, user)
        for key, value in profile_payload.items():
            setattr(profile, key, value)
    if preferences_payload is not None:
        if not user.notification_preferences:
            user.notification_preferences = NotificationPreferences(user_id=user.id)
        for key, value in preferences_payload.items():
            setattr(user.notification_preferences, key, value)
    db.commit()
    return {"success": True, "user": user_dict(user)}


@api.put("/auth/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    if user.password_hash and not verify_password(payload.current_password or "", user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"success": True}


@api.get("/auth/has-password")
def has_password(user: User = Depends(get_current_user)) -> dict[str, bool]:
    return {"success": True, "has_password": bool(user.password_hash)}


@api.post("/auth/forgot-password")
def forgot_password(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower(), User.deleted_at.is_(None)))
    result: dict[str, Any] = {"success": True, "message": "If an account exists, password reset instructions will be sent."}
    if user:
        raw_token = secrets.token_urlsafe(32)
        user.password_reset_token = token_digest(raw_token)
        user.password_reset_expires = now_utc() + timedelta(hours=1)
        db.commit()
        if settings.environment != "production":
            result["debug_token"] = raw_token
    return result


@api.post("/auth/reset-password")
def reset_password(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict[str, bool]:
    user = db.scalar(select(User).where(User.password_reset_token == token_digest(payload.token), User.deleted_at.is_(None)))
    if not user or not user.password_reset_expires or is_expired(user.password_reset_expires):
        raise HTTPException(400, "Reset token is invalid or expired")
    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.login_attempts = 0
    user.lock_until = None
    db.commit()
    return {"success": True}


@api.delete("/profile/pregnancy")
def delete_pregnancy(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    profile = ensure_profile(db, user)
    for key in ("last_menstrual_period", "due_date", "delivery_date", "height_cm", "pre_pregnancy_weight_kg", "blood_type", "primary_physician", "hospital_name"):
        setattr(profile, key, None)
    profile.allergies = []
    profile.medical_conditions = []
    profile.status = "active"
    db.commit()
    return {"success": True}


@api.get("/profile/export")
def export_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": user_dict(user), "health_logs": [log_dict(log) for log in active_logs(db, user.id)], "exported_at": now_utc()}


@api.delete("/profile")
def delete_profile(request: Request, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    user.deleted_at = now_utc()
    user.is_active = False
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    clear_session_cookie(response)
    return {"success": True}


def save_health_log(db: Session, user: User, payload: HealthLogPayload, existing: HealthLog | None = None) -> HealthLog:
    values = payload.model_dump(exclude_unset=True)
    log_date = values.pop("log_date", None) or date.today()
    profile = ensure_profile(db, user)
    context = pregnancy_context(profile)
    sections, percentage, complete = completion_for_log(values)
    if existing:
        log = existing
        for key, value in values.items():
            setattr(log, key, value)
    else:
        if db.scalar(select(HealthLog).where(HealthLog.user_id == user.id, HealthLog.log_date == log_date, HealthLog.deleted_at.is_(None))):
            raise HTTPException(409, "A health log already exists for this date")
        log = HealthLog(user_id=user.id, log_date=log_date, **values)
        db.add(log)
    log.pregnancy_week = context["week"]
    log.trimester = context["trimester"]
    log.sections_completed = sections
    log.completion_percentage = percentage
    log.is_complete = complete
    if not log.sleep:
        log.sleep = {}
    if not log.hydration:
        log.hydration = {}
    db.commit()
    db.refresh(log)
    return log


@api.get("/health-logs/today")
def health_log_today(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    log = db.scalar(select(HealthLog).where(HealthLog.user_id == user.id, HealthLog.log_date == date.today(), HealthLog.deleted_at.is_(None)))
    return {"success": True, "log": log_dict(log) if log else None}


@api.get("/health-logs/history/{days}")
def health_log_history(days: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    start = date.today() - timedelta(days=max(1, min(days, 365)))
    return {"success": True, "logs": [log_dict(log) for log in active_logs(db, user.id, start=start)]}


@api.get("/health-logs/date/{log_date}")
def health_log_by_date(log_date: date, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    log = db.scalar(select(HealthLog).where(HealthLog.user_id == user.id, HealthLog.log_date == log_date, HealthLog.deleted_at.is_(None)))
    if not log:
        raise HTTPException(404, "Health log not found")
    return {"success": True, "log": log_dict(log)}


@api.get("/health-logs/week/{week_number}")
def health_log_by_week(week_number: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"success": True, "logs": [log_dict(log) for log in active_logs(db, user.id) if log.pregnancy_week == week_number]}


@api.post("/health-logs")
def create_health_log(payload: HealthLogPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    log = save_health_log(db, user, payload)
    return {"success": True, "log": log_dict(log)}


@api.put("/health-logs/{log_id}")
def update_health_log(log_id: int, payload: HealthLogPayload, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    log = db.scalar(select(HealthLog).where(HealthLog.id == log_id, HealthLog.user_id == user.id, HealthLog.deleted_at.is_(None)))
    if not log:
        raise HTTPException(404, "Health log not found")
    return {"success": True, "log": log_dict(save_health_log(db, user, payload, log))}


@api.delete("/health-logs/{log_id}")
def delete_health_log(log_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    log = db.scalar(select(HealthLog).where(HealthLog.id == log_id, HealthLog.user_id == user.id, HealthLog.deleted_at.is_(None)))
    if not log:
        raise HTTPException(404, "Health log not found")
    log.deleted_at = now_utc()
    db.commit()
    return {"success": True}


def get_or_create_report(db: Session, user: User, offset: int = 0) -> WeeklyReport | None:
    start, end = week_range(offset)
    logs = active_logs(db, user.id, start, end)
    context = pregnancy_context(user.pregnancy_profile)
    if not logs:
        return None
    week_number = next((log.pregnancy_week for log in reversed(logs) if log.pregnancy_week), context["week"] or 1)
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.user_id == user.id, WeeklyReport.week_number == week_number, WeeklyReport.deleted_at.is_(None)))
    calculated = build_weekly_report(logs, week_number, context["trimester"])
    if not report:
        report = WeeklyReport(user_id=user.id, week_number=week_number, trimester=context["trimester"], start_date=start, end_date=end)
        db.add(report)
    report.summary = calculated["summary"]
    report.vitals_summary = calculated["vitals_summary"]
    report.activities = calculated["activities"]
    report.contractions = calculated["contractions"]
    report.status = "complete"
    db.commit()
    db.refresh(report)
    return report


@api.get("/reports/weekly/current")
def current_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    report = get_or_create_report(db, user)
    return {"success": True, "report": report_dict(report) if report else None, "user_context": user_dict(user)["pregnancy_context"]}


@api.get("/reports/weekly/week/{offset}")
def report_by_offset(offset: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    report = get_or_create_report(db, user, max(0, offset))
    if not report:
        raise HTTPException(404, "No health data for this week")
    return {"success": True, "report": report_dict(report)}


@api.get("/reports/weekly/history")
def report_history(weeks: int = 4, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    items = []
    for offset in range(max(1, min(weeks, 12))):
        start, end = week_range(offset)
        logs = active_logs(db, user.id, start, end)
        items.append({"week_offset": offset, "start_date": start, "end_date": end, "days_logged": len(logs), "has_data": bool(logs)})
    return {"success": True, "reports": items}


@api.get("/reports/weekly/trends")
def report_trends(weeks: int = 4, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    reports = db.scalars(select(WeeklyReport).where(WeeklyReport.user_id == user.id, WeeklyReport.deleted_at.is_(None)).order_by(WeeklyReport.week_number.desc()).limit(max(1, min(weeks, 12)))).all()
    return {"success": True, "trends": [report_dict(report) for report in reversed(reports)]}


@api.get("/reports/advice")
def current_advice(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    report = get_or_create_report(db, user)
    context = pregnancy_context(user.pregnancy_profile)
    report_data = report_dict(report) if report else {"summary": {"key_symptoms": []}}
    advice = db.scalar(select(WeeklyAdvice).where(WeeklyAdvice.user_id == user.id, WeeklyAdvice.week_number == (context["week"] or 1)).order_by(WeeklyAdvice.created_at.desc()))
    if not advice:
        advice = WeeklyAdvice(user_id=user.id, week_number=context["week"] or 1, advice=weekly_advice(context, report_data))
        db.add(advice)
        db.commit()
    return {"success": True, "advice": advice.advice}


@api.get("/plans/nutrition/current")
def current_nutrition(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plan = db.scalar(select(DietPlan).where(DietPlan.user_id == user.id, DietPlan.is_active.is_(True)).order_by(DietPlan.created_at.desc()))
    return {"success": True, "plan": plan.plan if plan else None, "plan_id": plan.id if plan else None}


@api.post("/plans/nutrition/generate")
async def create_nutrition(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    context = pregnancy_context(user.pregnancy_profile)
    logs = active_logs(db, user.id, date.today() - timedelta(days=7))
    plan_data, provider = await generate_nutrition_plan(user, logs, context)
    db.query(DietPlan).filter(DietPlan.user_id == user.id, DietPlan.is_active.is_(True)).update({"is_active": False})
    plan = DietPlan(user_id=user.id, pregnancy_week=context["week"], trimester=context["trimester"], valid_from=date.today(), valid_until=date.today() + timedelta(days=7), plan=plan_data, generated_by=provider)
    db.add(plan)
    db.commit()
    return {"success": True, "plan": plan_data, "plan_id": plan.id, "generated_by": provider}


@api.get("/plans/nutrition/history")
def nutrition_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plans = db.scalars(select(DietPlan).where(DietPlan.user_id == user.id).order_by(DietPlan.created_at.desc()).limit(20)).all()
    return {"success": True, "plans": [{"id": p.id, "pregnancy_week": p.pregnancy_week, "valid_from": p.valid_from, "valid_until": p.valid_until, "is_active": p.is_active, "plan": p.plan} for p in plans]}


@api.get("/plans/nutrition/weekly-plan")
def weekly_nutrition(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    return current_nutrition(db=db, user=user)


@api.get("/plans/nutrition/{plan_id}")
def nutrition_by_id(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plan = db.scalar(select(DietPlan).where(DietPlan.id == plan_id, DietPlan.user_id == user.id))
    if not plan:
        raise HTTPException(404, "Nutrition plan not found")
    return {"success": True, "plan": plan.plan, "plan_id": plan.id}


@api.get("/plans/exercise/current")
def current_exercise(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plan = db.scalar(select(ExercisePlan).where(ExercisePlan.user_id == user.id, ExercisePlan.is_active.is_(True)).order_by(ExercisePlan.created_at.desc()))
    return {"success": True, "plan": plan.plan if plan else None, "plan_id": plan.id if plan else None}


@api.post("/plans/exercise/generate")
async def create_exercise(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    context = pregnancy_context(user.pregnancy_profile)
    logs = active_logs(db, user.id, date.today() - timedelta(days=7))
    plan_data, provider = await generate_exercise_plan(user, logs, context)
    db.query(ExercisePlan).filter(ExercisePlan.user_id == user.id, ExercisePlan.is_active.is_(True)).update({"is_active": False})
    plan = ExercisePlan(user_id=user.id, pregnancy_week=context["week"], trimester=context["trimester"], valid_from=date.today(), valid_until=date.today() + timedelta(days=7), plan=plan_data, generated_by=provider)
    db.add(plan)
    db.commit()
    return {"success": True, "plan": plan_data, "plan_id": plan.id, "generated_by": provider}


@api.get("/plans/exercise/history")
def exercise_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plans = db.scalars(select(ExercisePlan).where(ExercisePlan.user_id == user.id).order_by(ExercisePlan.created_at.desc()).limit(20)).all()
    return {"success": True, "plans": [{"id": p.id, "pregnancy_week": p.pregnancy_week, "valid_from": p.valid_from, "valid_until": p.valid_until, "is_active": p.is_active, "plan": p.plan} for p in plans]}


@api.get("/plans/exercise/weekly-plan")
def weekly_exercise(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    return current_exercise(db=db, user=user)


@api.get("/plans/exercise/{plan_id}")
def exercise_by_id(plan_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    plan = db.scalar(select(ExercisePlan).where(ExercisePlan.id == plan_id, ExercisePlan.user_id == user.id))
    if not plan:
        raise HTTPException(404, "Exercise plan not found")
    return {"success": True, "plan": plan.plan, "plan_id": plan.id}


@api.get("/nutrition/search-foods")
def search_foods(q: str = "", limit: int = 10, user: User = Depends(get_current_user)) -> dict[str, Any]:
    catalog = ["oats", "spinach", "lentils", "salmon", "eggs", "yoghurt", "chicken", "broccoli", "beans", "wholegrain bread", "avocado", "banana"]
    results = [{"food": item} for item in catalog if q.lower() in item.lower()][: max(1, min(limit, 50))]
    return {"success": True, "foods": results}


@api.get("/nutrition/quick-advice")
def quick_nutrition_advice(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    context = pregnancy_context(user.pregnancy_profile)
    return {"success": True, "advice": "Choose regular meals with protein, fibre, and colourful produce, and discuss supplements with your healthcare professional.", "pregnancy_week": context["week"]}


@api.get("/exercise/search")
def search_exercises(q: str = "", limit: int = 20, user: User = Depends(get_current_user)) -> dict[str, Any]:
    exercises = [{"exercise_name": name, "category": category, "trimester": "1,2,3"} for name, category in (("Walking", "Cardio"), ("Swimming", "Cardio"), ("Prenatal yoga", "Flexibility"), ("Stationary cycling", "Cardio"), ("Pelvic floor exercises", "Strength"))]
    return {"success": True, "exercises": [item for item in exercises if q.lower() in item["exercise_name"].lower()][: max(1, min(limit, 50))]}


@api.get("/exercise/data")
def exercise_data(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return search_exercises(q="", limit=50, user=user)


@api.get("/exercise/avoid")
def avoid_exercises(user: User = Depends(get_current_user)) -> dict[str, Any]:
    return {"success": True, "exercises": [{"exercise_type": "Contact sports", "reason": "Risk of abdominal impact."}, {"exercise_type": "Fall-risk activities", "reason": "Risk of falling and injury."}, {"exercise_type": "Sky diving", "reason": "High risk activity."}]}


@api.get("/notifications")
def notifications(limit: int = 30, unread_only: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    conditions = [Notification.user_id == user.id, Notification.dismissed_at.is_(None)]
    if unread_only:
        conditions.append(Notification.read_at.is_(None))
    items = db.scalars(select(Notification).where(*conditions).order_by(Notification.created_at.desc()).limit(max(1, min(limit, 100)))).all()
    unread = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.read_at.is_(None), Notification.dismissed_at.is_(None))) or 0
    return {"success": True, "notifications": [notification_dict(item) for item in items], "unread_count": unread}


@api.post("/notifications/{notification_id}/read")
def read_notification(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not item:
        raise HTTPException(404, "Notification not found")
    item.read_at = now_utc()
    db.commit()
    return {"success": True}


@api.post("/notifications/mark-all-read")
def mark_all_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    db.query(Notification).filter(Notification.user_id == user.id, Notification.read_at.is_(None)).update({"read_at": now_utc()})
    db.commit()
    return {"success": True}


@api.post("/notifications/{notification_id}/dismiss")
def dismiss_notification(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not item:
        raise HTTPException(404, "Notification not found")
    item.dismissed_at = now_utc()
    db.commit()
    return {"success": True}


def association_dict(association: Association, db: Session) -> dict[str, Any]:
    owner = db.get(User, association.owner_id)
    member = db.get(User, association.member_id)
    return {
        "id": association.id,
        "owner": {"id": owner.id, "name": owner.first_name} if owner else None,
        "member": {"id": member.id, "name": member.first_name} if member else None,
        "relationship": association.relationship_type,
        "status": association.status,
        "permissions": association.permissions or {},
        "custom_label": association.custom_label,
        "created_at": association.created_at,
    }


@api.get("/partners")
def list_partners(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    items = db.scalars(select(Association).where(or_(Association.owner_id == user.id, Association.member_id == user.id)).order_by(Association.created_at.desc())).all()
    return {"success": True, "associations": [association_dict(item, db) for item in items]}


@api.get("/partners/invitation-code")
def invitation_code(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    if not user.invitation_code or not user.invitation_code_expires_at or user.invitation_code_expires_at <= now_utc():
        user.invitation_code = secrets.token_hex(4).upper()
        user.invitation_code_expires_at = now_utc() + timedelta(minutes=5)
        db.commit()
    return {"success": True, "invitation_code": user.invitation_code, "expires_at": user.invitation_code_expires_at}


@api.post("/partners/connect")
def connect_partner(payload: ConnectPartnerRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    owner = db.scalar(select(User).where(User.invitation_code == payload.invitation_code.upper(), User.invitation_code_expires_at > now_utc()))
    if not owner or owner.id == user.id:
        raise HTTPException(400, "Invitation code is invalid or expired")
    existing = db.scalar(select(Association).where(Association.owner_id == owner.id, Association.member_id == user.id))
    if existing:
        raise HTTPException(400, "Users are already linked")
    association = Association(owner_id=owner.id, member_id=user.id, relationship_type=payload.relationship, custom_label=payload.custom_label, expires_at=now_utc() + timedelta(days=7))
    db.add(association)
    create_notification(db, owner.id, "New partner request", f"{user.first_name or 'A user'} requested access to your BabyStar progress.", category="social", action_url="/link-account", priority="high")
    db.commit()
    return {"success": True, "association": association_dict(association, db)}


@api.post("/partners/{association_id}/accept")
def accept_partner(association_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    association = db.scalar(select(Association).where(Association.id == association_id, Association.owner_id == user.id))
    if not association:
        raise HTTPException(404, "Association not found")
    association.status = "accepted"
    association.responded_at = now_utc()
    db.commit()
    return {"success": True, "association": association_dict(association, db)}


@api.post("/partners/{association_id}/reject")
def reject_partner(association_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    association = db.scalar(select(Association).where(Association.id == association_id, Association.owner_id == user.id))
    if not association:
        raise HTTPException(404, "Association not found")
    association.status = "rejected"
    association.responded_at = now_utc()
    db.commit()
    return {"success": True}


@api.put("/partners/{association_id}/permissions")
def update_permissions(association_id: int, payload: PermissionsRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    association = db.scalar(select(Association).where(Association.id == association_id, Association.owner_id == user.id, Association.status == "accepted"))
    if not association:
        raise HTTPException(404, "Association not found")
    permissions = dict(association.permissions or {})
    permissions.update({key: value for key, value in payload.model_dump(exclude_unset=True).items() if value is not None})
    association.permissions = permissions
    db.commit()
    return {"success": True, "permissions": permissions}


@api.delete("/partners/{association_id}")
def remove_partner(association_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    association = db.scalar(select(Association).where(Association.id == association_id, or_(Association.owner_id == user.id, Association.member_id == user.id)))
    if not association:
        raise HTTPException(404, "Association not found")
    db.delete(association)
    db.commit()
    return {"success": True}


@api.get("/partners/{partner_id}/health-logs")
def shared_health_logs(partner_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    association = db.scalar(select(Association).where(Association.status == "accepted", or_(and_(Association.owner_id == user.id, Association.member_id == partner_id), and_(Association.member_id == user.id, Association.owner_id == partner_id))))
    if not association:
        raise HTTPException(403, "Partner access is not active")
    if association.owner_id == user.id and not (association.permissions or {}).get("view_health_logs", True):
        raise HTTPException(403, "Health-log access is disabled")
    return {"success": True, "logs": [log_dict(log) for log in active_logs(db, partner_id)]}


@api.get("/chat/conversations")
def conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    items = db.scalars(select(Conversation).where(Conversation.user_id == user.id, Conversation.deleted_at.is_(None)).order_by(Conversation.created_at.desc())).all()
    return {"success": True, "conversations": [{"id": item.id, "title": item.title, "topic": item.topic, "is_pinned": item.is_pinned, "last_message_at": item.last_message_at, "message_count": len(item.messages)} for item in items]}


@api.get("/chat/conversations/{conversation_id}")
def conversation_detail(conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    item = db.scalars(select(Conversation).options(joinedload(Conversation.messages)).where(Conversation.id == conversation_id, Conversation.user_id == user.id, Conversation.deleted_at.is_(None))).unique().first()
    if not item:
        raise HTTPException(404, "Conversation not found")
    return {"success": True, "conversation": {"id": item.id, "title": item.title, "topic": item.topic, "messages": [{"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at} for m in item.messages if not m.deleted_at]}}


@api.post("/chat/message")
async def chat_message(payload: ChatMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    conversation = db.get(Conversation, payload.conversation_id) if payload.conversation_id else None
    if conversation and (conversation.user_id != user.id or conversation.deleted_at):
        raise HTTPException(404, "Conversation not found")
    if not conversation:
        conversation = Conversation(user_id=user.id, context_snapshot=pregnancy_context(user.pregnancy_profile))
        db.add(conversation)
        db.flush()
    previous = [{"role": message.role, "content": message.content} for message in conversation.messages[-10:]]
    conversation.messages.append(ConversationMessage(role="user", content=payload.text))
    reply = await generate_chat_reply(payload.text, previous)
    conversation.messages.append(ConversationMessage(role="assistant", content=reply))
    conversation.title = conversation.title if conversation.title != "New Conversation" else payload.text[:47]
    conversation.last_message_at = now_utc()
    db.commit()
    return {"success": True, "assistant": reply, "conversation_id": conversation.id, "is_new_conversation": len(previous) == 0}


@api.put("/chat/conversations/{conversation_id}/rename")
def rename_conversation(conversation_id: int, payload: RenameConversationRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    item = db.scalar(select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id, Conversation.deleted_at.is_(None)))
    if not item:
        raise HTTPException(404, "Conversation not found")
    item.title = payload.title
    db.commit()
    return {"success": True}


@api.put("/chat/conversations/{conversation_id}/pin")
def pin_conversation(conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    item = db.scalar(select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id, Conversation.deleted_at.is_(None)))
    if not item:
        raise HTTPException(404, "Conversation not found")
    item.is_pinned = not item.is_pinned
    db.commit()
    return {"success": True, "is_pinned": item.is_pinned}


@api.delete("/chat/conversations/{conversation_id}")
def delete_conversation(conversation_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, bool]:
    item = db.scalar(select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id, Conversation.deleted_at.is_(None)))
    if not item:
        raise HTTPException(404, "Conversation not found")
    item.deleted_at = now_utc()
    db.commit()
    return {"success": True}


@api.get("/quizzes")
def list_quizzes(category: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    conditions = [Quiz.is_active.is_(True)]
    if category:
        conditions.append(Quiz.category == category)
    items = db.scalars(select(Quiz).options(joinedload(Quiz.questions)).where(*conditions).order_by(Quiz.created_at.desc())).unique().all()
    return {"success": True, "quizzes": [{"id": q.id, "title": q.title, "description": q.description, "category": q.category, "question_count": len(q.questions)} for q in items]}


@api.post("/quizzes/{quiz_id}/start")
def start_quiz(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    quiz = db.scalars(select(Quiz).options(joinedload(Quiz.questions)).where(Quiz.id == quiz_id, Quiz.is_active.is_(True))).unique().first()
    if not quiz:
        raise HTTPException(404, "Quiz not found")
    attempt = QuizAttempt(user_id=user.id, quiz_id=quiz.id, total_questions=len(quiz.questions))
    db.add(attempt)
    db.commit()
    return {"success": True, "attempt_id": attempt.id, "quiz": {"id": quiz.id, "title": quiz.title, "questions": [{"id": q.id, "question_text": q.question_text, "options": q.options, "position": q.position} for q in quiz.questions]}}


@api.post("/quizzes/{quiz_id}/attempts/{attempt_id}/answer")
def answer_quiz(quiz_id: int, attempt_id: int, payload: AnswerRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    attempt = db.scalar(select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user.id))
    question = db.scalar(select(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id, QuizQuestion.position == payload.question_index))
    if not attempt or not question:
        raise HTTPException(404, "Quiz attempt or question not found")
    answers = [item for item in (attempt.answers or []) if item.get("question_index") != payload.question_index]
    correct = payload.selected_answer == question.correct_answer
    answers.append({"question_index": payload.question_index, "selected_answer": payload.selected_answer, "is_correct": correct})
    attempt.answers = answers
    attempt.current_question_index = payload.question_index + 1
    attempt.score = sum(1 for item in answers if item["is_correct"])
    if len(answers) >= attempt.total_questions:
        attempt.status = "completed"
        attempt.completed_at = now_utc()
    db.commit()
    return {"success": True, "is_correct": correct, "explanation": question.explanation, "completed": attempt.status == "completed", "score": attempt.score}


@api.get("/quizzes/{quiz_id}/results")
def quiz_results(quiz_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    attempts = db.scalars(select(QuizAttempt).where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user.id).order_by(QuizAttempt.created_at.desc())).all()
    return {"success": True, "attempts": [{"id": item.id, "score": item.score, "total_questions": item.total_questions, "status": item.status, "completed_at": item.completed_at} for item in attempts]}


@api.get("/admin/users")
def admin_users(db: Session = Depends(get_db), user: User = Depends(require_admin)) -> dict[str, Any]:
    users = db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())).all()
    return {"success": True, "users": [{"id": item.id, "name": f"{item.first_name} {item.last_name}".strip(), "email": item.email, "role": item.role, "is_active": item.is_active, "created_at": item.created_at} for item in users]}


@api.put("/admin/users/{user_id}/active")
def admin_set_active(user_id: int, active: bool, db: Session = Depends(get_db), user: User = Depends(require_admin)) -> dict[str, bool]:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.is_active = active
    db.commit()
    return {"success": True}


@api.get("/admin/quizzes")
def admin_quizzes(db: Session = Depends(get_db), user: User = Depends(require_admin)) -> dict[str, Any]:
    quizzes = db.scalars(select(Quiz).options(joinedload(Quiz.questions)).order_by(Quiz.created_at.desc())).unique().all()
    return {"success": True, "quizzes": [{"id": quiz.id, "title": quiz.title, "category": quiz.category, "is_active": quiz.is_active, "question_count": len(quiz.questions)} for quiz in quizzes]}


@api.get("/nearby-healthcare")
async def nearby_healthcare(lat: float, lon: float, radius: float = 20, user: User = Depends(get_current_user)) -> dict[str, Any]:
    if not settings.geoapify_api_key:
        return {"success": True, "places": [], "message": "Healthcare search is not configured."}
    radius_m = min(max(radius, 1), 200) * 1000
    params = {"categories": "healthcare.hospital,healthcare.clinic_or_praxis,healthcare.pharmacy", "filter": f"circle:{lon},{lat},{radius_m}", "bias": f"proximity:{lon},{lat}", "limit": 50, "apiKey": settings.geoapify_api_key}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.geoapify.com/v2/places", params=params)
    if response.status_code >= 400:
        raise HTTPException(502, "Healthcare provider lookup failed")
    data = response.json()
    return {"success": True, "places": data.get("features", []), "count": len(data.get("features", []))}


@api.get("/streak")
def streak(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, Any]:
    dates = sorted({log.log_date for log in active_logs(db, user.id)}, reverse=True)
    current = date.today()
    count = 0
    for log_date in dates:
        if log_date == current:
            count += 1
            current -= timedelta(days=1)
        elif log_date < current:
            break
    return {"current_streak": count, "logged_today": date.today() in dates, "show_popup": count > 2}


@api.get("/reports/weekly/{report_id}/pdf")
def report_pdf(report_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    report = db.scalar(select(WeeklyReport).where(WeeklyReport.id == report_id, WeeklyReport.user_id == user.id))
    if not report:
        raise HTTPException(404, "Report not found")
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_title("BabyStar Weekly Report")
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "BabyStar Weekly Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 8, f"Pregnancy week {report.week_number}", new_x="LMARGIN", new_y="NEXT")
    content_width = pdf.w - pdf.l_margin - pdf.r_margin
    for heading, value in (("Summary", report.summary), ("Vitals", report.vitals_summary), ("Activities", report.activities)):
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, heading, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", size=10)
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(content_width, 6, str(value))
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(content_width, 6, "This information is educational and does not replace professional medical advice.")
    content = bytes(pdf.output())
    return Response(content=content, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="babystar-report-{report.week_number}.pdf"'})


@api.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin and origin.rstrip("/") not in settings.cors_origins:
        await websocket.close(code=1008)
        return
    token = websocket.cookies.get(settings.session_cookie)
    if not token:
        await websocket.close(code=1008)
        return
    with SessionLocal() as db:
        session = db.scalar(select(UserSession).where(UserSession.token_hash == token_digest(token)))
        if not session or is_expired(session.expires_at):
            await websocket.close(code=1008)
            return
        user_id = session.user_id
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)


app = FastAPI(title=settings.app_name, version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.middleware("http")
async def enforce_allowed_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in settings.cors_origins:
        return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
    return await call_next(request)


app.include_router(api)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "BabyStar API", "docs": "/docs"}
