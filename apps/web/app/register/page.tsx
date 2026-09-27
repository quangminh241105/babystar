"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "../../components/AppShell";
import GoogleButton from "../../components/GoogleButton";
import { useLocale } from "../../components/LocaleProvider";
import { apiFetch, APIError } from "../../lib/api";

export default function RegisterPage() {
  const { t, locale } = useLocale();
  const [form, setForm] = useState({ fullname: "", email: "", phone_number: "", password: "", password2: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function update(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const body = await apiFetch<{ redirect: string }>("/auth/register", { method: "POST", body: JSON.stringify(form) }); window.location.href = body.redirect || "/profile"; }
    catch (exception) { setError(exception instanceof APIError ? exception.message : "Unable to create account"); }
    finally { setBusy(false); }
  }
  return <AppShell><div className="form-card card"><div className="eyebrow">{t("Begin gently")}</div><h1 className="form-title">{t("Create your space")}</h1><p className="muted">{locale === "vi" ? "Dùng email hoặc số điện thoại. Bạn có thể hoàn thành hồ sơ thai kỳ sau." : "Use an email or phone number. You can complete your pregnancy profile later."}</p>{error && <p className="error" role="alert">{error}</p>}<form onSubmit={submit}><div className="field"><label htmlFor="fullname">{t("Full name")}</label><input id="fullname" autoComplete="name" value={form.fullname} onChange={(e) => update("fullname", e.target.value)} required /></div><div className="form-grid"><div className="field"><label htmlFor="email">{t("Email")}</label><input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div><div className="field"><label htmlFor="phone_number">{t("Phone number")}</label><input id="phone_number" autoComplete="tel" value={form.phone_number} onChange={(e) => update("phone_number", e.target.value)} /></div></div><div className="form-grid"><div className="field"><label htmlFor="new-password">{t("Password")}</label><input id="new-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={6} /></div><div className="field"><label htmlFor="confirm-password">{t("Confirm password")}</label><input id="confirm-password" type="password" autoComplete="new-password" value={form.password2} onChange={(e) => update("password2", e.target.value)} required /></div></div><button className="btn btn-primary" disabled={busy}>{t(busy ? "Creating…" : "Create account")}</button></form><div className="oauth-divider"><span>{t("or")}</span></div><GoogleButton redirect="/profile" /><p className="muted" style={{ marginTop: 20 }}>{t("Already registered?")} <Link href="/login" className="text-link">{t("Sign in")}</Link></p></div></AppShell>;
}
