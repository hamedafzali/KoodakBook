import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// The full set of genuinely public, indexable pages. Private app routes are
// excluded — see robots.ts for why. /login, /signup, /kid stay crawlable
// (robots.ts allows them — they're real product-discovery signal, e.g. "does
// this app have a kid login") but are account-entry pages, not content
// destinations, so they're left out of the sitemap itself (SEO audit, 2026-09).
const PUBLIC_ROUTES = ['', '/privacy', '/terms']

// Content pages: real destinations in their own right (free alphabet /
// vocabulary practice, no signup), not funnel steps — ranked below the
// homepage but above the account routes.
const CONTENT_ROUTES = ['/alphabet', '/first-100-words']

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(route => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.5,
  }))
  const contentEntries: MetadataRoute.Sitemap = CONTENT_ROUTES.map(route => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))
  return [...entries, ...contentEntries]
}
