"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, User } from "../lib/api";
import Loading from "./Loading";

export default function RequireUser({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { apiFetch<{ user: User }>("/auth/me").then((body) => { if (admin && body.user.role !== "admin") router.replace("/"); else setUser(body.user); }).catch(() => router.replace("/login")); }, [admin, router]);
  if (!user) return <Loading />;
  return <>{children}</>;
}

