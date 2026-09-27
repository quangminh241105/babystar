import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "../components/LocaleProvider";

export const metadata: Metadata = {
  title: "BabyStar | Pregnancy wellness companion",
  description: "Track your pregnancy journey with thoughtful health insights and personalized guidance.",
};

const themeInitScript = `(() => { try { const saved = localStorage.getItem("babystar-theme"); const theme = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = theme; } catch {} })()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body><LocaleProvider>{children}</LocaleProvider></body>
    </html>
  );
}
