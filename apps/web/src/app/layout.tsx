import type { Metadata, Viewport } from 'next'
import { Vazirmatn } from 'next/font/google'
import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: ['400', '500', '700'],
})

// Needed to resolve absolute URLs for OG/Twitter images and the file-based
// opengraph-image convention below. Set NEXT_PUBLIC_SITE_URL in production —
// this only matters for how link previews and crawlers see the site, so it's
// safe to leave at the localhost default in dev.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'KoodakBook — فارسی برای کودکان',
  description: 'یادگیری فارسی برای کودکان ایرانی خارج از کشور — از طریق داستان، بازی و ارتباط با خانواده.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KoodakBook',
  },
}

export const viewport: Viewport = {
  themeColor: '#F5A623',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        className="min-h-full bg-warm-white font-[family-name:var(--font-vazirmatn)]"
        style={{ overscrollBehavior: 'none' }}
      >
        {/* Skip navigation for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[9999] focus:bg-amber-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold"
        >
          رفتن به محتوای اصلی
        </a>
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  )
}
