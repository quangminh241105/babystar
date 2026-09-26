"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { apiFetch, User } from "../lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { apiFetch<{ user: User }>("/auth/me").then((body) => setUser(body.user)).catch(() => undefined); }, []);
  return <AppShell>{user ? <Dashboard user={user} /> : <Landing />}</AppShell>;
}

function Landing() {
  return <>
    <section className="hero"><div><div className="eyebrow">A gentler way to track pregnancy</div><h1>Your pregnancy, held with care.</h1><p className="lead">BabyStar brings your health notes, weekly insights, movement, nutrition, and support into one calm space built for the journey ahead.</p><div className="actions"><Link href="/register" className="btn btn-primary">Start your journey</Link><Link href="/login" className="btn btn-secondary">I already have an account</Link></div></div><div className="hero-card"><div className="baby-orbit" /><div className="hero-note"><strong>Week by week</strong><span>Personalized, practical, reassuring.</span></div></div></section>
    <section><div className="eyebrow">One thoughtful home</div><h2>Everything you need to feel more in tune.</h2><div className="feature-grid"><div className="feature"><div className="pill">Track</div><h3>Daily health logs</h3><p>Capture symptoms, mood, sleep, hydration, movement, meals, exercise, and vitals without losing the story of your day.</p></div><div className="feature"><div className="pill">Understand</div><h3>Weekly reports</h3><p>See patterns in your week and bring clearer questions to the people caring for you.</p></div><div className="feature"><div className="pill">Support</div><h3>A companion when you need one</h3><p>Get gentle, pregnancy-aware guidance and share selected progress with a partner.</p></div></div></section>
  </>;
}

function Dashboard({ user }: { user: User }) {
  const context = user.pregnancy_context;
  return <><section className="hero" style={{ paddingTop: 20 }}><div><div className="eyebrow">Good to see you, {user.first_name || "there"}</div><h1>Your little daily check-in.</h1><p className="lead">A few minutes of noticing how you feel can help you see the bigger picture over time.</p><div className="actions"><Link href="/health-log" className="btn btn-primary">Log today</Link><Link href="/weekly-report" className="btn btn-secondary">View report</Link></div></div><div className="hero-card"><div className="hero-note"><strong>{context?.week ? `Week ${context.week}` : "Your profile awaits"}</strong><span>{context?.days_until_due ? `${context.days_until_due} days until your due date` : "Add your pregnancy details for personalized guidance."}</span></div></div></section><div className="stats"><div className="stat stat-pink"><span className="stat-label">Pregnancy week</span><strong className="stat-value">{context?.week || "—"}</strong></div><div className="stat stat-lilac"><span className="stat-label">Trimester</span><strong className="stat-value">{context?.trimester || "—"}</strong></div><div className="stat stat-mint"><span className="stat-label">Due date</span><strong className="stat-value" style={{ fontSize: "1.25rem" }}>{user.pregnancy_profile?.due_date || "Add profile"}</strong></div><div className="stat"><span className="stat-label">Next step</span><strong className="stat-value" style={{ fontSize: "1.25rem" }}>Check in</strong></div></div><div className="card-grid"><div className="card"><div className="eyebrow">Health</div><h3>How are you feeling today?</h3><p>Log what matters to you. You can always come back and fill in more later.</p><Link href="/health-log" className="btn btn-secondary">Open health log</Link></div><div className="card"><div className="eyebrow">Personalized</div><h3>Nutrition and movement</h3><p>Generate a gentle plan using your pregnancy context and recent check-ins.</p><div className="actions"><Link href="/diet-plan" className="btn btn-secondary">Nutrition</Link><Link href="/exercise-plan" className="btn btn-secondary">Exercise</Link></div></div><div className="card"><div className="eyebrow">Together</div><h3>Invite your support person</h3><p>Choose what to share and keep your boundaries in your hands.</p><Link href="/link-account" className="btn btn-secondary">Manage sharing</Link></div></div></>;
}

