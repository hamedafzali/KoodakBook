import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "ورود — کودک‌بوک",
  description: "وارد حساب کودک‌بوک شوید و به یادگیری فارسی کودکتان ادامه دهید.",
  alternates: { canonical: `${SITE_URL}/login` },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell variant="login">{children}</AuthShell>;
}
