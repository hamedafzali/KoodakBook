import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "ثبت‌نام رایگان — کودک‌بوک",
  description:
    "حساب رایگان کودک‌بوک بسازید — بدون کارت بانکی، بدون تعهد. الفبا، صداکشی و درس‌های پایه همیشه رایگان‌اند.",
  alternates: { canonical: `${SITE_URL}/signup` },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell variant="signup">{children}</AuthShell>;
}
