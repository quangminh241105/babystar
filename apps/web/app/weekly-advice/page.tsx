"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import PageHeader from "../../components/PageHeader";
import RequireUser from "../../components/RequireUser";
import { apiFetch } from "../../lib/api";

export default function WeeklyAdvicePage() { return <AppShell><RequireUser><Advice /></RequireUser></AppShell>; }
function Advice() { const [advice, setAdvice] = useState<any>(); useEffect(() => { apiFetch<{ advice: any }>("/reports/advice").then((body) => setAdvice(body.advice)); }, []); if (!advice) return <Loading />; const guidance = advice.guidance || {}; return <><PageHeader eyebrow={`Week ${advice.pregnancy_week || "—"}`} title="A little guidance for this week" description="Personalized context with room for your own judgment and care team." /><div className="card-grid">{Object.entries(guidance).map(([key, value]) => <div className="card" key={key}><div className="eyebrow">{key.replaceAll("_", " ")}</div><p className="prose">{String(value)}</p></div>)}</div><p className="notice" style={{ marginTop: 18 }}>{advice.disclaimer}</p></>; }

