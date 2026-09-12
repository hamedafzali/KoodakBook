import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Was inheriting the root layout's generic title/description with no
// canonical at all (SEO audit, 2026-09) — a real, crawlable, allowed URL
// (robots.ts) with nothing of its own to distinguish it from any other page.
export const metadata: Metadata = {
  title: "ورود بچه‌ها — کودک‌بوک",
  description:
    "صفحه‌ی ورود کودک به کودک‌بوک — با اسم مخصوص یا رمز تصویری که والدین ساخته‌اند.",
  alternates: { canonical: `${SITE_URL}/kid` },
};

export default function KidLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
