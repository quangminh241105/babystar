"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, User } from "../lib/api";
import ThemeToggle from "./ThemeToggle";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
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
          <Link href="/" className="brand"><span className="brand-mark">♡</span><span>BabyStar</span></Link>
          {user && <div id="primary-navigation" className={`nav-links ${navOpen ? "is-open" : ""}`}>
            <Link href="/health-log">Track</Link><Link href="/weekly-report">Reports</Link><Link href="/diet-plan">Plans</Link><Link href="/chatbot">Assistant</Link><Link href="/link-account">Partner</Link>
          </div>}
          <div className="nav-actions">
            <ThemeToggle />
            <div className="nav-user">
              {loading ? <span className="muted">Loading…</span> : user ? <><Link href="/notifications">♡</Link><Link href="/profile" className="avatar">{user.first_name?.[0] || "B"}</Link><span>{user.first_name || "Welcome"}</span><button className="btn btn-secondary" onClick={logout}>Log out</button></> : <><Link href="/login" className="btn btn-secondary">Log in</Link><Link href="/register" className="btn btn-primary">Join BabyStar</Link></>}
            </div>
            {user && <button className="nav-toggle" type="button" aria-expanded={navOpen} aria-controls="primary-navigation" onClick={() => setNavOpen((open) => !open)}>{navOpen ? "Close" : "Menu"}</button>}
          </div>
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">BabyStar is an educational wellness companion, not a replacement for professional medical advice.</footer>
    </>
  );
}
