from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Timestamped(Base):
    __abstract__ = True
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class User(Timestamped):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True)
    phone_number: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(512))
    auth_provider: Mapped[str] = mapped_column(String(32), default="email")
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(32), default="user", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    first_name: Mapped[str] = mapped_column(String(80), default="")
    last_name: Mapped[str] = mapped_column(String(80), default="")
    profile_image_url: Mapped[str | None] = mapped_column(String(1000))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    current_weight_kg: Mapped[float | None] = mapped_column()
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    language: Mapped[str] = mapped_column(String(10), default="en")
    invitation_code: Mapped[str | None] = mapped_column(String(16), unique=True, index=True)
    invitation_code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    lock_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    password_reset_token: Mapped[str | None] = mapped_column(String(64), index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    pregnancy_profile: Mapped["PregnancyProfile | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    notification_preferences: Mapped["NotificationPreferences | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class PregnancyProfile(Timestamped):
    __tablename__ = "pregnancy_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    last_menstrual_period: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    height_cm: Mapped[float | None] = mapped_column()
    pre_pregnancy_weight_kg: Mapped[float | None] = mapped_column()
    blood_type: Mapped[str | None] = mapped_column(String(8))
    allergies: Mapped[list] = mapped_column(JSON, default=list)
    medical_conditions: Mapped[list] = mapped_column(JSON, default=list)
    is_high_risk: Mapped[bool] = mapped_column(Boolean, default=False)
    gravida: Mapped[int] = mapped_column(Integer, default=1)
    para: Mapped[int] = mapped_column(Integer, default=0)
    primary_physician: Mapped[str | None] = mapped_column(String(160))
    hospital_name: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(24), default="active")

    user: Mapped[User] = relationship(back_populates="pregnancy_profile")


class NotificationPreferences(Timestamped):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    email: Mapped[bool] = mapped_column(Boolean, default=True)
    push: Mapped[bool] = mapped_column(Boolean, default=True)
    sms: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    weekly_report_ready: Mapped[bool] = mapped_column(Boolean, default=True)
    appointment_reminders: Mapped[bool] = mapped_column(Boolean, default=True)
    partner_updates: Mapped[bool] = mapped_column(Boolean, default=True)
    health_alerts: Mapped[bool] = mapped_column(Boolean, default=True)
    tips_and_articles: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped[User] = relationship(back_populates="notification_preferences")


class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HealthLog(Timestamped):
    __tablename__ = "health_logs"
    __table_args__ = (UniqueConstraint("user_id", "log_date", "deleted_at", name="uq_active_health_log_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    log_date: Mapped[date] = mapped_column(Date, index=True)
    pregnancy_week: Mapped[int | None] = mapped_column(Integer)
    trimester: Mapped[int | None] = mapped_column(Integer)
    weight_kg: Mapped[float | None] = mapped_column()
    heart_rate_bpm: Mapped[int | None] = mapped_column(Integer)
    blood_pressure: Mapped[dict] = mapped_column(JSON, default=dict)
    blood_sugar: Mapped[dict] = mapped_column(JSON, default=dict)
    mood_log: Mapped[list] = mapped_column(JSON, default=list)
    energy_level: Mapped[int | None] = mapped_column(Integer)
    stress_level: Mapped[int | None] = mapped_column(Integer)
    sleep: Mapped[dict] = mapped_column(JSON, default=dict)
    hours_slept: Mapped[float | None] = mapped_column()
    symptoms: Mapped[list] = mapped_column(JSON, default=list)
    exercises: Mapped[list] = mapped_column(JSON, default=list)
    food_intake: Mapped[list] = mapped_column(JSON, default=list)
    hydration: Mapped[dict] = mapped_column(JSON, default=dict)
    caffeine_intake_mg: Mapped[float | None] = mapped_column()
    fetal_movement: Mapped[dict] = mapped_column(JSON, default=dict)
    doctor_visit: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    completion_percentage: Mapped[int] = mapped_column(Integer, default=0)
    sections_completed: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_analyzed: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_flags: Mapped[list] = mapped_column(JSON, default=list)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class WeeklyReport(Timestamped):
    __tablename__ = "weekly_reports"
    __table_args__ = (UniqueConstraint("user_id", "week_number", name="uq_user_pregnancy_week_report"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week_number: Mapped[int] = mapped_column(Integer)
    trimester: Mapped[int | None] = mapped_column(Integer)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    vitals_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    activities: Mapped[dict] = mapped_column(JSON, default=dict)
    contractions: Mapped[dict] = mapped_column(JSON, default=dict)
    comparison: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="complete")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WeeklyAdvice(Timestamped):
    __tablename__ = "weekly_advice"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    week_number: Mapped[int] = mapped_column(Integer)
    advice: Mapped[dict] = mapped_column(JSON, default=dict)


class DietPlan(Timestamped):
    __tablename__ = "diet_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pregnancy_week: Mapped[int | None] = mapped_column(Integer)
    trimester: Mapped[int | None] = mapped_column(Integer)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_by: Mapped[str] = mapped_column(String(24), default="rules")


class ExercisePlan(Timestamped):
    __tablename__ = "exercise_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pregnancy_week: Mapped[int | None] = mapped_column(Integer)
    trimester: Mapped[int | None] = mapped_column(Integer)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plan: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_by: Mapped[str] = mapped_column(String(24), default="rules")


class Association(Timestamped):
    __tablename__ = "user_associations"
    __table_args__ = (UniqueConstraint("owner_id", "member_id", name="uq_user_association"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(32), default="partner")
    status: Mapped[str] = mapped_column(String(24), default="pending")
    permissions: Mapped[dict] = mapped_column(JSON, default=lambda: {"view_health_logs": True, "view_weekly_reports": True, "view_medical_info": False, "receive_alerts": False, "add_notes": False})
    custom_label: Mapped[str | None] = mapped_column(String(80))
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Notification(Timestamped):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(64), default="system")
    category: Mapped[str] = mapped_column(String(32), default="system")
    priority: Mapped[str] = mapped_column(String(16), default="normal")
    action_url: Mapped[str | None] = mapped_column(String(500))
    action_label: Mapped[str | None] = mapped_column(String(80))
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Conversation(Timestamped):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), default="New Conversation")
    topic: Mapped[str] = mapped_column(String(48), default="general")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(24), default="active")
    context_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    messages: Mapped[list["ConversationMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="ConversationMessage.created_at")


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Quiz(Timestamped):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    questions: Mapped[list["QuizQuestion"]] = relationship(back_populates="quiz", cascade="all, delete-orphan", order_by="QuizQuestion.position")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    question_text: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON, default=list)
    correct_answer: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    quiz: Mapped[Quiz] = relationship(back_populates="questions")


class QuizAttempt(Timestamped):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    score: Mapped[int] = mapped_column(Integer, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="in_progress")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
