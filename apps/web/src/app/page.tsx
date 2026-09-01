import type { Metadata } from 'next'
import Landing from '@/components/landing/Landing'
import SessionRedirect from '@/components/landing/SessionRedirect'

export const metadata: Metadata = {
  title: 'کودک‌بوک — آموزش زبان فارسی به کودکان با قصه و بازی',
  description:
    'نرم‌افزار آموزش فارسی برای کودکان ۳ تا ۱۰ سال خانواده‌های ایرانی خارج از کشور: الفبا، صداکشی، واژگان با مرور هوشمند، تمرین گفتار و داستان‌های شخصی با هوش مصنوعی و صدای گوینده. شروع رایگان.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'کودک‌بوک — فارسی برای کودکان',
    description: 'کودک شما فارسی را با قصه و بازی یاد می‌گیرد — روزی ۱۰ دقیقه.',
    type: 'website',
    locale: 'fa_IR',
    url: '/',
    // Reuses the app icon — a real 1200×630 hero shot would read better in
    // link previews, but this closes the "no image at all" gap for free.
    images: [{ url: '/og/koodakbook-og.png', width: 512, height: 512, alt: 'کودک‌بوک' }],
  },
  twitter: {
    card: 'summary',
    title: 'کودک‌بوک — فارسی برای کودکان',
    description: 'کودک شما فارسی را با قصه و بازی یاد می‌گیرد — روزی ۱۰ دقیقه.',
    images: ['/og/koodakbook-og.png'],
  },
}

/**
 * Public marketing landing. Logged-in sessions are redirected into the app by
 * <SessionRedirect/> (child mode → child home, else parent dashboard), so kids
 * relaunching never see the sales page; anonymous visitors read the landing.
 */
export default function RootPage() {
  return (
    <>
      <SessionRedirect />
      <Landing />
    </>
  )
}
