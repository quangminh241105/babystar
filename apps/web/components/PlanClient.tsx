"use client";

import { useEffect, useState } from "react";
import PageHeader from "./PageHeader";
import { apiFetch, APIError } from "../lib/api";

export default function PlanClient({ kind }: { kind: "nutrition" | "exercise" }) {
  const [plan, setPlan] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = kind === "nutrition" ? "Nutrition planner" : "Exercise planner";
  const endpoint = kind === "nutrition" ? "/plans/nutrition" : "/plans/exercise";
  useEffect(() => { apiFetch<{ plan: any }>(`${endpoint}/current`).then((body) => setPlan(body.plan)); }, [endpoint]);
  async function generate() {
    setBusy(true); setError("");
    try { const body = await apiFetch<{ plan: any }>(`${endpoint}/generate`, { method: "POST" }); setPlan(body.plan); }
    catch (e) { setError(e instanceof APIError ? e.message : "Unable to generate a plan"); }
    finally { setBusy(false); }
  }
  return <><PageHeader eyebrow="Personalized support" title={title} description="A starting point based on your context and recent check-ins." action={<button className="btn btn-primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : plan ? "Refresh plan" : "Generate plan"}</button>} />{error && <p className="error">{error}</p>}{!plan ? <div className="card"><h3>No plan yet</h3><p>Generate a gentle plan to get started. Always adapt activity and nutrition with your healthcare professional.</p></div> : <div className="card"><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{JSON.stringify(plan, null, 2)}</pre><p className="notice">This plan is educational and is not a medical prescription.</p></div>}</>;
}

