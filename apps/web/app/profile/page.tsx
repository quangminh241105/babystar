"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import RequireUser from "../../components/RequireUser";
import { apiFetch, User } from "../../lib/api";

export default function ProfilePage() { return <AppShell><RequireUser><Profile /></RequireUser></AppShell>; }
function Profile() { const [user, setUser] = useState<User | null>(null); useEffect(() => { apiFetch<{ user: User }>("/profile").then((body) => setUser(body.user)); }, []); if (!user) return <Loading />; return <><div className="page-heading"><div><div className="eyebrow">Your space</div><h1>Profile</h1><p>Keep the details behind your guidance current and in your control.</p></div><Link href="/profile/edit" className="btn btn-primary">Edit profile</Link></div><div className="card-grid"><div className="card"><div className="eyebrow">Personal</div><h3>{user.full_name || "Add your name"}</h3><p>{user.email || user.phone_number || "No contact method yet"}</p><p className="muted">Language: {user.language || "en"} · Role: {user.role}</p></div><div className="card"><div className="eyebrow">Pregnancy</div><h3>{user.pregnancy_context?.week ? `Week ${user.pregnancy_context.week}` : "Not set up yet"}</h3><p>Due date: {user.pregnancy_profile?.due_date || "Add a due date or last menstrual period"}</p><p>Trimester: {user.pregnancy_context?.trimester || "—"}</p></div><div className="card"><div className="eyebrow">Privacy</div><h3>You choose what is shared</h3><p>Partner permissions apply on the server to every shared health record and report.</p><Link href="/link-account" className="btn btn-secondary">Manage sharing</Link></div></div></>; }

