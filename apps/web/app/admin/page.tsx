"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import RequireUser from "../../components/RequireUser";
import PageHeader from "../../components/PageHeader";
import { apiFetch } from "../../lib/api";

export default function AdminPage() { return <AppShell><RequireUser admin><Admin /></RequireUser></AppShell>; }
function Admin() { const [users, setUsers] = useState<any[] | null>(null); useEffect(() => { apiFetch<{ users: any[] }>("/admin/users").then((body) => setUsers(body.users)); }, []); if (!users) return <Loading />; return <><PageHeader eyebrow="Administration" title="BabyStar operations" description="Manage account access and content from one place." action={<Link href="/admin/quizzes" className="btn btn-primary">Manage quizzes</Link>} /><div className="stats"><div className="stat stat-pink"><span className="stat-label">Users</span><strong className="stat-value">{users.length}</strong></div><div className="stat stat-mint"><span className="stat-label">Active</span><strong className="stat-value">{users.filter((user) => user.is_active).length}</strong></div></div><div className="card"><h3>Users</h3><div className="list">{users.map((user) => <div className="list-item" key={user.id}><div><strong>{user.name || "Unnamed user"}</strong><div className="muted">{user.email || "Phone account"} · {user.role}</div></div><button className="btn btn-secondary" onClick={() => apiFetch(`/admin/users/${user.id}/active?active=${!user.is_active}`, { method: "PUT" }).then(() => setUsers((items) => items ? items.map((item) => item.id === user.id ? { ...item, is_active: !item.is_active } : item) : null))}>{user.is_active ? "Deactivate" : "Activate"}</button></div>)}</div></div></>; }
