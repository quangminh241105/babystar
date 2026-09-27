"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "../../components/AppShell";
import GoogleButton from "../../components/GoogleButton";
import { apiFetch, APIError } from "../../lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({ fullname: "", email: "", phone_number: "", password: "", password2: "" }); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  function update(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const body = await apiFetch<{ redirect: string }>("/auth/register", { method: "POST", body: JSON.stringify({ ...form, email: form.email || null, phone_number: form.phone_number || null }) }); window.location.href = body.redirect; } catch (e) { setError(e instanceof APIError ? e.message : "Unable to create account"); } finally { setBusy(false); } }
  return <AppShell><div className="form-card card"><div className="eyebrow">Begin gently</div><h1 style={{ fontSize: "2.5rem" }}>Create your space</h1><p className="muted">Use an email or phone number. You can complete your pregnancy profile later.</p>{error && <p className="error">{error}</p>}<form onSubmit={submit}><div className="field"><label htmlFor="fullname">Full name</label><input id="fullname" value={form.fullname} onChange={(e) => update("fullname", e.target.value)} required /></div><div className="form-grid"><div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div><div className="field"><label htmlFor="phone_number">Phone number</label><input id="phone_number" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} /></div></div><div className="form-grid"><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} /></div><div className="field"><label htmlFor="password2">Confirm password</label><input id="password2" type="password" value={form.password2} onChange={(e) => update("password2", e.target.value)} required minLength={6} /></div></div><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create account"}</button></form><div className="oauth-divider"><span>or</span></div><GoogleButton redirect="/profile" /><p className="muted" style={{ marginTop: 20 }}>Already registered? <Link href="/login" style={{ color: "var(--pink)" }}>Sign in</Link></p></div></AppShell>;
}
