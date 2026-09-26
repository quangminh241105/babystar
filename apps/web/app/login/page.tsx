"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "../../components/AppShell";
import { apiFetch, APIError } from "../../lib/api";

export default function LoginPage() {
  const [value, setValue] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const body = await apiFetch<{ redirect: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email_or_phone: value, password }) }); window.location.href = body.redirect || "/"; } catch (e) { setError(e instanceof APIError ? e.message : "Unable to sign in"); } finally { setBusy(false); } }
  return <AppShell><div className="form-card card"><div className="eyebrow">Welcome back</div><h1 style={{ fontSize: "2.5rem" }}>Sign in to BabyStar</h1><p className="muted">Your notes and progress are waiting for you.</p>{error && <p className="error">{error}</p>}<form onSubmit={submit}><div className="field"><label htmlFor="email_or_phone">Email or phone</label><input id="email_or_phone" value={value} onChange={(e) => setValue(e.target.value)} required /></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div><button className="btn btn-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p className="muted" style={{ marginTop: 20 }}>New to BabyStar? <Link href="/register" style={{ color: "var(--pink)" }}>Create an account</Link></p></div></AppShell>;
}

