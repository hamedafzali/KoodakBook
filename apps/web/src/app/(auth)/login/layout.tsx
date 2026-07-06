import AuthShell from '@/components/auth/AuthShell'

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell variant="login">{children}</AuthShell>
}
