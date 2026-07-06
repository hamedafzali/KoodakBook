import AuthShell from '@/components/auth/AuthShell'

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell variant="signup">{children}</AuthShell>
}
