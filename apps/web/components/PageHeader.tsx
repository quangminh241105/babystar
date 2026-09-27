"use client";

import { useLocale } from "./LocaleProvider";

export default function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  const { t } = useLocale();
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{t(eyebrow)}</div>}<h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", marginBottom: 8 }}>{t(title)}</h1>{description && <p>{t(description)}</p>}</div>{action}</div>;
}
