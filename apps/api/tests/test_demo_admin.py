from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from starlette.requests import Request
from google.oauth2 import id_token

from app.db import Base
from app.main import GOOGLE_ADMIN_EMAIL, admin_add_demo_data, admin_demo_status, admin_remove_demo_data, google_login, settings
from app.models import HealthLog, User
from app.schemas import GoogleLoginRequest


def test_demo_batch_only_removes_tagged_accounts():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        admin = User(email="admin@example.com", role="admin", auth_provider="google")
        real = User(email="real@example.com", role="user")
        db.add_all([admin, real])
        db.commit()

        result = admin_add_demo_data(db=db, user=admin)
        assert result["count"] == 500
        assert admin_demo_status(db=db, user=admin)["count"] == 500
        assert db.scalar(select(func.count(HealthLog.id))) == 500

        removed = admin_remove_demo_data(db=db, user=admin)
        assert removed["removed"] == 500
        assert admin_demo_status(db=db, user=admin)["count"] == 0
        assert db.get(User, real.id) is not None
        assert db.get(User, admin.id) is not None
        assert db.scalar(select(func.count(HealthLog.id))) == 0


def test_verified_google_admin_is_promoted_and_password_removed(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine, expire_on_commit=False) as db:
        existing = User(email=GOOGLE_ADMIN_EMAIL, password_hash="legacy-password-hash", role="user")
        db.add(existing)
        db.commit()
        monkeypatch.setattr(settings, "google_client_id", "test-client-id")
        monkeypatch.setattr(id_token, "verify_oauth2_token", lambda *_: {
            "email": GOOGLE_ADMIN_EMAIL, "email_verified": True, "sub": "google-subject-1",
            "given_name": "Minh", "family_name": "Phạm",
        })
        request = Request({"type": "http", "method": "POST", "path": "/api/v1/auth/google", "headers": []})
        response = google_login(GoogleLoginRequest(credential="test-token", redirect="/profile"), request, db)
        db.refresh(existing)
        assert existing.role == "admin"
        assert existing.auth_provider == "google"
        assert existing.password_hash is None
        assert b'"redirect":"/admin"' in response.body
