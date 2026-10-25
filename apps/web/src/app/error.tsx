'use client'
import { usePathname } from 'next/navigation'
import ErrorState from '@/components/child/ErrorState'

/* A page that throws while rendering. Without this file Next shows its own
 * English "Application error" page on white. Retry re-renders the segment;
 * the way out goes to the home of whichever app the visitor was in. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname() ?? '/'
  const home = pathname.startsWith('/child')
    ? { href: '/child/home', label: 'برگشت به خانه' }
    : pathname.startsWith('/parent')
      ? { href: '/parent/dashboard', label: 'برگشت به پنل والدین' }
      : { href: '/', label: 'برگشت به صفحه اصلی' }
  return (
    <ErrorState
      title="یک مشکلی پیش آمد"
      onRetry={reset}
      backHref={home.href}
      backLabel={home.label}
    />
  )
}
