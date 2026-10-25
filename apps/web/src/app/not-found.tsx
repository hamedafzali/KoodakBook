import type { Metadata } from 'next'
import ErrorState from '@/components/child/ErrorState'

export const metadata: Metadata = {
  title: 'صفحه پیدا نشد — کودک‌بوک',
  robots: { index: false },
}

/* Unknown URL. Next's built-in 404 is an English page on white (black in a
 * dark-mode browser, from its own inline <style>): the one screen that left
 * the app's page, type and direction. Same screen as a failed load instead,
 * with a way home. `/` is the landing; a signed-in family is one tap from the
 * app there, and middleware sends /child/* without a session to /login. */
export default function NotFound() {
  return (
    <ErrorState
      title="این صفحه پیدا نشد"
      message="شاید آدرس اشتباه نوشته شده، یا این صفحه دیگر وجود ندارد."
      backHref="/"
      backLabel="برگشت به صفحه اصلی"
    />
  )
}
