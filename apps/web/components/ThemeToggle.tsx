"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";

type Theme = "light" | "dark";
const THEME_KEY = "babystar-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const { locale } = useLocale();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const next = stored === "dark" || stored === "light" ? stored : preferred;
    setTheme(next);
    applyTheme(next);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={locale === "vi" ? `Chuyển sang giao diện ${theme === "dark" ? "sáng" : "tối"}` : `Use ${theme === "dark" ? "light" : "dark"} theme`}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      <span>{locale === "vi" ? theme === "dark" ? "Sáng" : "Tối" : theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
