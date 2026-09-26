"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import PageHeader from "../../components/PageHeader";
import RequireUser from "../../components/RequireUser";
import { apiFetch } from "../../lib/api";

export default function NotificationsPage() { return <AppShell><RequireUser><Notifications /></RequireUser></AppShell>; }
function Notifications() { const [items, setItems] = useState<any[] | null>(null); useEffect(() => { load(); }, []); async function load() { const body = await apiFetch<{ notifications: any[] }>("/notifications"); setItems(body.notifications); } async function mark(id: number) { await apiFetch(`/notifications/${id}/read`, { method: "POST" }); load(); } if (!items) return <Loading />; return <><PageHeader eyebrow="Stay in the loop" title="Notifications" description="Reminders, progress updates, and partner activity." action={<button className="btn btn-secondary" onClick={() => apiFetch("/notifications/mark-all-read", { method: "POST" }).then(load)}>Mark all read</button>} /><div className="card">{items.length === 0 ? <p className="muted">You are all caught up.</p> : <div className="list">{items.map((item) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><p style={{ margin: "5px 0 0" }} className="muted">{item.message}</p></div>{!item.read && <button className="btn btn-secondary" onClick={() => mark(item.id)}>Read</button>}</div>)}</div>}</div></>; }

