const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export class APIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new APIError(body.detail || body.error || "Something went wrong", response.status);
  return body as T;
}

export type User = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string | null;
  phone_number?: string | null;
  role: string;
  language?: string;
  timezone?: string;
  pregnancy_profile?: { last_menstrual_period?: string | null; due_date?: string | null; [key: string]: unknown } | null;
  pregnancy_context?: { week?: number | null; days?: number | null; trimester?: number | null; days_until_due?: number | null };
};

export type HealthLog = { id: number; log_date: string; completion_percentage: number; [key: string]: any };
export type Report = { id: number; week_number: number; summary: any; vitals_summary: any; activities: any; [key: string]: any };
