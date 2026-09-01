import type { Metadata } from 'next'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'ثبت‌نام رایگان — کودک‌بوک',
  description: 'حساب رایگان کودک‌بوک بسازید — بدون کارت بانکی، بدون تعهد. الفبا، صداکشی و درس‌های پایه همیشه رایگان‌اند.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell variant="signup">{children}</AuthShell>
}
