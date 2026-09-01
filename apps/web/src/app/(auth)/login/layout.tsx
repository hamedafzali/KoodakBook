import type { Metadata } from 'next'
import AuthShell from '@/components/auth/AuthShell'

export const metadata: Metadata = {
  title: 'ورود — کودک‌بوک',
  description: 'وارد حساب کودک‌بوک شوید و به یادگیری فارسی کودکتان ادامه دهید.',
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell variant="login">{children}</AuthShell>
}
