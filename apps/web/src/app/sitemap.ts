import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// The full set of genuinely public pages. Private app routes are excluded —
// see robots.ts for why.
const PUBLIC_ROUTES = ['', '/login', '/signup', '/kid', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(route => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.5,
  }))
}
