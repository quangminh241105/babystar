"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import GoogleButton from "../components/GoogleButton";
import { useLocale } from "../components/LocaleProvider";
import { apiFetch, User } from "../lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { apiFetch<{ user: User }>("/auth/me").then((body) => setUser(body.user)).catch(() => undefined); }, []);
  return <AppShell>{user ? <Dashboard user={user} /> : <Landing />}</AppShell>;
}

function Landing() {
  const { locale, t } = useLocale();
  return <>
    <section className="hero">
      <div>
        <div className="eyebrow">{t("A gentler way to track pregnancy")}</div>
        <h1>{t("Your pregnancy, held with care.")}</h1>
        <p className="lead">{t("BabyStar brings your health notes, weekly insights, movement, nutrition, and support into one calm space built for the journey ahead.")}</p>
        <div className="actions"><Link href="/register" className="btn btn-primary">{t("Start your journey")}</Link><Link href="/login" className="btn btn-secondary">{t("I already have an account")}</Link></div>
        <div className="startup-google"><span className="eyebrow">{locale === "vi" ? "Hoặc tiếp tục bằng Google" : "Or continue with Google"}</span><GoogleButton redirect="/profile" /></div>
      </div>
      <div className="hero-card"><div className="baby-orbit" /><div className="hero-note"><strong>{t("Week by week")}</strong><span>{t("Personalized, practical, reassuring.")}</span></div></div>
    </section>
    <section><div className="eyebrow">{t("One thoughtful home")}</div><h2>{t("Everything you need to feel more in tune.")}</h2><div className="feature-grid">
      <div className="feature"><div className="pill">{t("Track")}</div><h3>{t("Daily health logs")}</h3><p>{locale === "vi" ? "Ghi lại triệu chứng, tâm trạng, giấc ngủ, nước uống và vận động theo từng ngày." : "Capture symptoms, mood, sleep, hydration, movement, meals, exercise, and vitals without losing the story of your day."}</p></div>
      <div className="feature"><div className="pill">{t("Understand")}</div><h3>{t("Weekly reports")}</h3><p>{locale === "vi" ? "Nhìn rõ xu hướng sức khỏe hằng tuần để trao đổi với đội ngũ chăm sóc." : "See patterns in your week and bring clearer questions to the people caring for you."}</p></div>
      <div className="feature"><div className="pill">{t("Support")}</div><h3>{t("A companion when you need one")}</h3><p>{locale === "vi" ? "Nhận thông tin hỗ trợ trong thai kỳ và chia sẻ tiến trình với người thân khi bạn muốn." : "Get gentle, pregnancy-aware guidance and share selected progress with a partner."}</p></div>
    </div></section>
  </>;
}

function Dashboard({ user }: { user: User }) {
  const { locale, t } = useLocale();
  const vi = locale === "vi";
  const context = user.pregnancy_context;
  return <>
    <section className="hero">
      <div><div className="eyebrow">{vi ? `Chào ${user.first_name || "bạn"}` : `Good to see you, ${user.first_name || "there"}`}</div><h1>{vi ? "Kiểm tra sức khỏe hôm nay." : "Your little daily check-in."}</h1><p className="lead">{vi ? "Dành vài phút ghi lại cảm nhận để thấy sự thay đổi theo thời gian." : "A few minutes of noticing how you feel can help you see the bigger picture over time."}</p><div className="actions"><Link href="/health-log" className="btn btn-primary">{vi ? "Ghi nhật ký" : "Log today"}</Link><Link href="/weekly-report" className="btn btn-secondary">{vi ? "Xem báo cáo" : "View report"}</Link></div></div>
      <div className="hero-card"><div className="hero-note"><strong>{context?.week ? `${vi ? "Tuần" : "Week"} ${context.week}` : vi ? "Hoàn thiện hồ sơ" : "Your profile awaits"}</strong><span>{context?.days_until_due ? `${context.days_until_due} ${vi ? "ngày đến ngày dự sinh" : "days until your due date"}` : vi ? "Thêm thông tin thai kỳ để nhận gợi ý phù hợp." : "Add your pregnancy details for personalized guidance."}</span></div></div>
    </section>
    <div className="stats"><div className="stat stat-pink"><span className="stat-label">{vi ? "Tuần thai" : "Pregnancy week"}</span><strong className="stat-value">{context?.week || "—"}</strong></div><div className="stat stat-lilac"><span className="stat-label">{vi ? "Tam cá nguyệt" : "Trimester"}</span><strong className="stat-value">{context?.trimester || "—"}</strong></div><div className="stat stat-mint"><span className="stat-label">{vi ? "Ngày dự sinh" : "Due date"}</span><strong className="stat-value" style={{ fontSize: "1.25rem" }}>{user.pregnancy_profile?.due_date || "—"}</strong></div><div className="stat"><span className="stat-label">{vi ? "Bước tiếp theo" : "Next step"}</span><strong className="stat-value" style={{ fontSize: "1.25rem" }}>{vi ? "Ghi nhật ký" : "Check in"}</strong></div></div>
    <div className="card-grid"><div className="card"><div className="eyebrow">{t("Health")}</div><h3>{vi ? "Hôm nay bạn thế nào?" : "How are you feeling today?"}</h3><p>{vi ? "Ghi lại những điều quan trọng với bạn." : "Log what matters to you. You can always come back and fill in more later."}</p><Link href="/health-log" className="btn btn-secondary">{vi ? "Mở nhật ký" : "Open health log"}</Link></div><div className="card"><div className="eyebrow">{vi ? "Cá nhân hóa" : "Personalized"}</div><h3>{vi ? "Dinh dưỡng và vận động" : "Nutrition and movement"}</h3><p>{vi ? "Tạo kế hoạch dựa trên tình trạng thai kỳ và nhật ký gần đây." : "Generate a gentle plan using your pregnancy context and recent check-ins."}</p><div className="actions"><Link href="/diet-plan" className="btn btn-secondary">{t("Nutrition")}</Link><Link href="/exercise-plan" className="btn btn-secondary">{t("Exercise")}</Link></div></div><div className="card"><div className="eyebrow">{vi ? "Đồng hành" : "Together"}</div><h3>{vi ? "Mời người thân hỗ trợ" : "Invite your support person"}</h3><p>{vi ? "Bạn chủ động chọn thông tin muốn chia sẻ." : "Choose what to share and keep your boundaries in your hands."}</p><Link href="/link-account" className="btn btn-secondary">{vi ? "Quản lý chia sẻ" : "Manage sharing"}</Link></div></div>
  </>;
}
