"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Loading from "../../components/Loading";
import RequireUser from "../../components/RequireUser";
import PageHeader from "../../components/PageHeader";
import { useLocale } from "../../components/LocaleProvider";
import { apiFetch, APIError } from "../../lib/api";

type AdminUser = { id: number; name: string; email: string | null; role: string; is_active: boolean };

export default function AdminPage() { return <AppShell><RequireUser admin><Admin /></RequireUser></AppShell>; }

function Admin() {
  const { locale, t } = useLocale();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [demoCount, setDemoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [userBody, demoBody] = await Promise.all([
      apiFetch<{ users: AdminUser[] }>("/admin/users"),
      apiFetch<{ count: number }>("/admin/demo-data"),
    ]);
    setUsers(userBody.users);
    setDemoCount(demoBody.count);
  }

  useEffect(() => { load().catch(() => setMessage(locale === "vi" ? "Không tải được dữ liệu quản trị." : "Unable to load admin data.")); }, []);

  async function changeDemo(method: "POST" | "DELETE") {
    if (method === "DELETE" && !window.confirm(locale === "vi" ? "Xóa toàn bộ dữ liệu mẫu? Tài khoản thật sẽ được giữ nguyên." : "Remove all demo users and their sample records? Real accounts will remain.")) return;
    setBusy(true); setMessage("");
    try {
      const result = await apiFetch<{ count?: number; removed?: number }>("/admin/demo-data", { method });
      await load();
      setMessage(method === "POST" ? (locale === "vi" ? `Đã tạo ${result.count} tài khoản mẫu tại Việt Nam.` : `Created ${result.count} Vietnam demo accounts.`) : (locale === "vi" ? `Đã xóa ${result.removed} tài khoản mẫu.` : `Removed ${result.removed} demo accounts.`));
    } catch (error) {
      setMessage(error instanceof APIError ? error.message : (locale === "vi" ? "Thao tác thất bại." : "Action failed."));
    } finally { setBusy(false); }
  }

  if (!users) return <Loading />;
  return <>
    <PageHeader eyebrow={t("Administration")} title={t("BabyStar operations")} description={t("Manage account access and content from one place.")} action={<Link href="/admin/quizzes" className="btn btn-primary">{t("Manage quizzes")}</Link>} />
    <div className="stats"><div className="stat"><span className="stat-label">{t("Users")}</span><strong className="stat-value">{users.length}</strong></div><div className="stat"><span className="stat-label">{t("Active")}</span><strong className="stat-value">{users.filter((item) => item.is_active).length}</strong></div><div className="stat"><span className="stat-label">{t("Demo data")}</span><strong className="stat-value">{demoCount}</strong></div></div>
    <section className="card demo-panel"><div><div className="eyebrow">{t("Demo data")} / VIETNAM</div><h2>{locale === "vi" ? "Dữ liệu minh họa" : "Sample records"}</h2><p>{locale === "vi" ? "Tạo 500 tài khoản mẫu với tên, địa điểm và nhật ký sức khỏe tại Việt Nam. Dữ liệu mẫu được đánh dấu riêng và không thể đăng nhập." : "Create 500 distinct sample accounts with Vietnamese names, cities and health logs. Demo accounts cannot sign in and are kept separate from real users."}</p></div><div className="actions"><button className="btn btn-primary" disabled={busy || demoCount > 0} onClick={() => changeDemo("POST")}>{t("Generate 500")}</button><button className="btn btn-danger" disabled={busy || demoCount === 0} onClick={() => changeDemo("DELETE")}>{t("Remove demo data")}</button></div>{message && <p role="status" className="notice">{message}</p>}</section>
    <section className="card" style={{ marginTop: 18 }}><h3>{t("Users")}</h3><div className="list">{users.map((item) => <div className="list-item" key={item.id}><div><strong>{item.name || item.email || "—"}</strong><div className="muted">{item.email || "—"} · {item.role}</div></div>{item.email !== "phamlequangminh2411@gmail.com" && <button className="btn btn-secondary" onClick={() => apiFetch(`/admin/users/${item.id}/active?active=${!item.is_active}`, { method: "PUT" }).then(load)}>{t(item.is_active ? "Deactivate" : "Activate")}</button>}</div>)}</div></section>
  </>;
}
