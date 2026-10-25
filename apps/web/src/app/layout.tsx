import type { Metadata, Viewport } from 'next'
import { Vazirmatn } from 'next/font/google'
import MotionProvider from '@/components/shared/MotionProvider'
import './globals.css'

// One typeface app-wide (see docs/design-system.md, "Type ladder" — this
// replaced a second rounded display face, Baloo Bhaijaan 2, whose Persian
// glyph coverage and join quality were weaker). Verified to carry the full
// Persian set (پ چ ژ گ ک ی ۀ ZWNJ, Persian digits) with proper init/medi/fina
// shaping across the loaded weights. Hierarchy is weight now, not family:
// 900 for child headings (`font-display`, paired with `font-black` — nothing
// else uses 900, see globals.css's `--font-display`), 400/500/700 for
// body/UI. Re-audit (`grep -rn font-display apps/web/src`) before adding
// another weight here.
const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  variable: '--font-vazirmatn',
  display: 'swap',
  weight: ['400', '500', '700', '900'],
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
  // iOS ignores the manifest's icons for "Add to Home Screen" and uses
  // apple-touch-icon instead — without one it saves a page screenshot as the
  // app icon (see /app's iPhone guide).
  icons: { apple: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KoodakBook',
  },
}

// Browser chrome and the PWA status bar in the page's own cream (child-bg's
// first stop), not the old saffron #F5A623, which framed every cream page in
// an orange bar. `colorScheme: 'light'`: the product has no dark theme, so a
// dark-mode browser must not paint dark form controls or a dark canvas.
export const viewport: Viewport = {
  themeColor: '#FFFBF0',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Site-wide identity, not page content — kept minimal and factual (no
// invented ratings/reviews/prices; see SEO audit, 2026-09). Page-specific
// JSON-LD (e.g. /alphabet's LearningResource) layers on top of this, same as
// any site running both an Organization block and per-page schema.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'KoodakBook',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'KoodakBook',
      url: SITE_URL,
      inLanguage: 'fa',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The page colour inline on <html> (the same #FEFAF5 as globals.css's body
    // background): the browser canvas is cream from the very first paint, even
    // before the stylesheet has arrived, instead of the UA's white.
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full`}
      style={{ backgroundColor: '#FEFAF5' }}
    >
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          <MotionProvider>{children}</MotionProvider>
        </main>
      </body>
    </html>
  )
}
