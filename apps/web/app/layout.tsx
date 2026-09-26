import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BabyStar | Pregnancy wellness companion",
  description: "Track your pregnancy journey with thoughtful health insights and personalized guidance.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

