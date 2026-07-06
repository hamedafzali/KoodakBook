import type { Metadata } from 'next'
import Landing from '@/components/landing/Landing'
import SessionRedirect from '@/components/landing/SessionRedirect'

export const metadata: Metadata = {
  title: 'کودک‌بوک — آموزش زبان فارسی به کودکان با قصه و بازی',
  description:
    'نرم‌افزار آموزش فارسی برای کودکان ۳ تا ۱۰ سال خانواده‌های ایرانی خارج از کشور: الفبا، صداکشی، واژگان با مرور هوشمند، تمرین گفتار و داستان‌های شخصی با هوش مصنوعی و صدای گوینده. شروع رایگان.',
  openGraph: {
    title: 'کودک‌بوک — فارسی برای کودکان',
    description: 'کودک شما فارسی را با قصه و بازی یاد می‌گیرد — روزی ۱۰ دقیقه.',
    type: 'website',
    locale: 'fa_IR',
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
