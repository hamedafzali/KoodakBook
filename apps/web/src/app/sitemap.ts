import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// The full set of genuinely public, indexable pages. Private app routes
// (/child/, /parent/, /onboarding/) are excluded — see robots.ts for why.
// /login, /signup, /kid stay crawlable (robots.ts allows them — they're real
// product-discovery signal, e.g. "does this app have a kid login") but are
// account-entry pages, not content destinations, so they're left out of the
// sitemap itself (SEO audit, 2026-09).
//
// Root is listed as '/', not '', so its <loc> is `${SITE_URL}/` — matching
// the homepage's own `alternates.canonical` in page.tsx exactly (Google's
// sitemap docs: each <loc> should match the page's canonical URL).
const PUBLIC_ROUTES = ['/', '/privacy', '/terms']

// Content pages: real destinations in their own right (free alphabet /
// vocabulary practice, no signup), not funnel steps.
const CONTENT_ROUTES = ['/alphabet', '/first-100-words']

// No <lastmod> is emitted for any route (SEO audit, 2026-09 — Google sitemap
// requirements). Google's docs are explicit that <lastmod> should reflect the
// URL's actual last significant modification and that an inaccurate value
// (e.g. always "now") can cause Google to ignore it. None of these routes has
// a trustworthy source for that date:
//   - `/`, `/privacy`, `/terms` are static JSX with no CMS/DB-backed
//     "last updated" field to read.
//   - `/alphabet` and `/first-100-words` render live from the `letters` and
//     `words` tables (supabase/migrations/001_schema.sql), neither of which
//     has an `updated_at` column.
// Stamping build/request time (`new Date()`) instead — the previous
// behavior — put the exact same fabricated instant on every URL regardless
// of whether that URL's content actually changed, which is precisely what
// Google's docs warn against. If a route later gets a real modification
// timestamp (e.g. a CMS field, or `updated_at` added to `letters`/`words`),
// add `lastModified` for that route specifically rather than reintroducing a
// blanket timestamp.
//
// <changefreq> and <priority> are omitted entirely: per Google's current
// sitemap documentation, Google does not use either value.
export default function sitemap(): MetadataRoute.Sitemap {
  return [...PUBLIC_ROUTES, ...CONTENT_ROUTES].map(route => ({
    url: `${SITE_URL}${route}`,
  }))
}
