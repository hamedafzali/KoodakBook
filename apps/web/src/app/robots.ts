import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Everyone — search engines and AI assistants alike — may crawl the public
 * marketing pages (/, /login, /signup, /kid, /privacy, /terms): the product
 * wants to be found and recommended. Everything under /child/, /parent/ and
 * /onboarding/ is an auth-gated shell with no content until a session loads
 * client-side — there's nothing there worth indexing or storing, so it's
 * disallowed for every crawler, not just AI training bots.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/child/', '/parent/', '/onboarding/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
