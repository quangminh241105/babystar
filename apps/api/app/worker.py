"""Single-purpose scheduler container for report and reminder jobs."""

import asyncio
from datetime import date, timedelta

from sqlalchemy import select

from .db import SessionLocal, init_db
from .main import active_logs, create_notification, get_or_create_report, now_utc
from .models import User


def run_weekly_reports() -> int:
    generated = 0
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.is_active.is_(True), User.deleted_at.is_(None))).all()
        for user in users:
            if get_or_create_report(db, user, 1):
                generated += 1
    return generated


def run_streak_reminders() -> int:
    sent = 0
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.is_active.is_(True), User.deleted_at.is_(None))).all()
        yesterday = date.today() - timedelta(days=1)
        for user in users:
            logs = active_logs(db, user.id)
            dates = {item.log_date for item in logs}
            if yesterday in dates and date.today() not in dates:
                create_notification(db, user.id, "Keep your streak going", "Log today to keep your health tracking streak alive.", category="health", action_url="/health-log", priority="high", metadata={"reminder_type": "streak_protection"})
                sent += 1
        db.commit()
    return sent


async def main() -> None:
    init_db()
    last_report_day = None
    last_reminder_day = None
    while True:
        today = date.today()
        now = now_utc()
        if now.weekday() == 6 and now.hour == 23 and now.minute == 59 and last_report_day != today:
            run_weekly_reports()
            last_report_day = today
        if now.hour == 18 and last_reminder_day != today:
            run_streak_reminders()
            last_reminder_day = today
        await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(main())

