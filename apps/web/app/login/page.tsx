"use client";

import Link from "next/link";
import { useState } from "react";
import AppShell from "../../components/AppShell";
import GoogleButton from "../../components/GoogleButton";
import { useLocale } from "../../components/LocaleProvider";
import { apiFetch, APIError } from "../../lib/api";

export default function LoginPage() {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = await apiFetch<{ redirect: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email_or_phone: value, password }) });
      window.location.href = body.redirect || "/";
    } catch (exception) { setError(exception instanceof APIError ? exception.message : "Unable to sign in"); }
    finally { setBusy(false); }
  }

  return <AppShell><div className="form-card card"><div className="eyebrow">{t("Welcome back")}</div><h1 className="form-title">{t("Sign in to BabyStar")}</h1><p className="muted">{t("Your notes and progress are waiting for you.")}</p>{error && <p className="error" role="alert">{error}</p>}<form onSubmit={submit}><div className="field"><label htmlFor="email_or_phone">{t("Email or phone")}</label><input id="email_or_phone" autoComplete="username" value={value} onChange={(e) => setValue(e.target.value)} required /></div><div className="field"><label htmlFor="password">{t("Password")}</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div><button className="btn btn-primary" disabled={busy}>{t(busy ? "Signing in…" : "Sign in")}</button></form><div className="oauth-divider"><span>{t("or")}</span></div><GoogleButton redirect="/profile" /><p className="muted" style={{ marginTop: 20 }}>{t("New to BabyStar?")} <Link href="/register" className="text-link">{t("Create an account")}</Link></p></div></AppShell>;
}
