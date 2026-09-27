"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, User } from "../lib/api";
import ThemeToggle from "./ThemeToggle";
import { useLocale } from "./LocaleProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const { locale, setLocale, t } = useLocale();
  useEffect(() => {
    apiFetch<{ user: User }>("/auth/me").then((body) => setUser(body.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, [pathname]);
  useEffect(() => setNavOpen(false), [pathname]);
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    router.push("/");
  }
  return (
    <>
      <header className="site-header">
        <nav className="nav">
          <Link href="/" className="brand"><span className="brand-mark">B</span><span>BabyStar</span></Link>
          {user && <div id="primary-navigation" className={`nav-links ${navOpen ? "is-open" : ""}`}>
            <Link href="/health-log">{t("Track")}</Link><Link href="/weekly-report">{t("Reports")}</Link><Link href="/diet-plan">{t("Plans")}</Link><Link href="/chatbot">{t("Assistant")}</Link><Link href="/link-account">{t("Partner")}</Link>{user.role === "admin" && <Link href="/admin">{t("Administration")}</Link>}
          </div>}
          <div className="nav-actions">
            <button className="locale-toggle" type="button" onClick={() => setLocale(locale === "en" ? "vi" : "en")} aria-label={locale === "en" ? "Switch to Vietnamese" : "Chuyển sang tiếng Anh"}>{locale === "en" ? "VI" : "EN"}</button>
            <ThemeToggle />
            <div className="nav-user">
              {loading ? <span className="muted">…</span> : user ? <><Link href="/notifications" aria-label={t("Notifications")}>◇</Link><Link href="/profile" className="avatar">{user.first_name?.[0] || "B"}</Link><span>{user.first_name || "Welcome"}</span><button className="btn btn-secondary" onClick={logout}>{t("Log out")}</button></> : <><Link href="/login" className="btn btn-secondary">{t("Log in")}</Link><Link href="/register" className="btn btn-primary">{t("Join BabyStar")}</Link></>}
            </div>
            {user && <button className="nav-toggle" type="button" aria-expanded={navOpen} aria-controls="primary-navigation" onClick={() => setNavOpen((open) => !open)}>{t(navOpen ? "Close" : "Menu")}</button>}
          </div>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">{t("BabyStar is an educational wellness companion, not a replacement for professional medical advice.")}</footer>
    </>
  );
}
