"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_KEY = "babystar-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
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
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
