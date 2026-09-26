"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import RequireUser from "../../components/RequireUser";
import PageHeader from "../../components/PageHeader";
import { apiFetch, HealthLog } from "../../lib/api";

export default function PastHealthRecordsPage() { return <AppShell><RequireUser><Records /></RequireUser></AppShell>; }
function Records() { const [logs, setLogs] = useState<HealthLog[] | null>(null); useEffect(() => { apiFetch<{ logs: HealthLog[] }>("/health-logs/history/90").then((body) => setLogs(body.logs)); }, []); if (!logs) return <Loading />; return <><PageHeader eyebrow="Your timeline" title="Past health records" description="A private, chronological view of your check-ins." /><div className="card">{logs.length === 0 ? <p className="muted">No health logs yet. Your first check-in will appear here.</p> : <div className="list">{logs.map((log) => <div className="list-item" key={log.id}><div><strong>{log.log_date}</strong><div className="muted">{log.symptoms?.length || 0} symptoms · {log.exercises?.length || 0} exercise entries</div></div><span className="pill">{log.completion_percentage}% complete</span></div>)}</div>}</div></>; }

