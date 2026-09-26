from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PregnancyProfilePayload(APIModel):
    last_menstrual_period: date | None = None
    due_date: date | None = None
    delivery_date: date | None = None
    height_cm: float | None = Field(default=None, ge=50, le=300)
    pre_pregnancy_weight_kg: float | None = Field(default=None, ge=20, le=500)
    blood_type: str | None = None
    allergies: list[str] = Field(default_factory=list)
    medical_conditions: list[str] = Field(default_factory=list)
    is_high_risk: bool = False
    gravida: int = Field(default=1, ge=1)
    para: int = Field(default=0, ge=0)
    primary_physician: str | None = None
    hospital_name: str | None = None
    status: str = "active"


class NotificationPreferencesPayload(APIModel):
    email: bool = True
    push: bool = True
    sms: bool = False
    daily_reminders: bool = True
    weekly_report_ready: bool = True
    appointment_reminders: bool = True
    partner_updates: bool = True
    health_alerts: bool = True
    tips_and_articles: bool = False


class UserPayload(APIModel):
    first_name: str
    last_name: str
    email: str | None
    phone_number: str | None
    profile_image_url: str | None
    role: str
    is_active: bool
    pregnancy_profile: PregnancyProfilePayload | None
    notification_preferences: NotificationPreferencesPayload | None


class RegisterRequest(BaseModel):
    fullname: str = Field(min_length=2, max_length=160)
    email: str | None = None
    phone_number: str | None = None
    password: str = Field(min_length=6, max_length=200)
    password2: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str | None) -> str | None:
        return value.strip().lower() if value else None


class LoginRequest(BaseModel):
    email_or_phone: str
    password: str
    redirect: str | None = "/"


class GoogleLoginRequest(BaseModel):
    credential: str
    redirect: str | None = "/"


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone_number: str | None = None
    date_of_birth: date | None = None
    current_weight_kg: float | None = None
    timezone: str | None = None
    language: str | None = None
    pregnancy_profile: PregnancyProfilePayload | None = None
    notification_preferences: NotificationPreferencesPayload | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=6, max_length=200)


class HealthLogPayload(BaseModel):
    log_date: date | None = None
    weight_kg: float | None = Field(default=None, ge=20, le=300)
    heart_rate_bpm: int | None = Field(default=None, ge=40, le=200)
    blood_pressure: dict[str, Any] = Field(default_factory=dict)
    blood_sugar: dict[str, Any] = Field(default_factory=dict)
    mood_log: list[dict[str, Any]] = Field(default_factory=list)
    energy_level: int | None = Field(default=None, ge=1, le=5)
    stress_level: int | None = Field(default=None, ge=1, le=5)
    sleep: dict[str, Any] = Field(default_factory=dict)
    hours_slept: float | None = Field(default=None, ge=0, le=24)
    symptoms: list[dict[str, Any]] = Field(default_factory=list)
    exercises: list[dict[str, Any]] = Field(default_factory=list)
    food_intake: list[dict[str, Any]] = Field(default_factory=list)
    hydration: dict[str, Any] = Field(default_factory=dict)
    caffeine_intake_mg: float | None = Field(default=None, ge=0)
    fetal_movement: dict[str, Any] = Field(default_factory=dict)
    doctor_visit: dict[str, Any] = Field(default_factory=dict)
    notes: str | None = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=200)


class ChatMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    conversation_id: int | None = None


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ConnectPartnerRequest(BaseModel):
    invitation_code: str = Field(min_length=4, max_length=16)
    relationship: str = "partner"
    custom_label: str | None = None


class PermissionsRequest(BaseModel):
    view_health_logs: bool | None = None
    view_weekly_reports: bool | None = None
    view_medical_info: bool | None = None
    receive_alerts: bool | None = None
    add_notes: bool | None = None


class AnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    selected_answer: int = Field(ge=0, le=3)

