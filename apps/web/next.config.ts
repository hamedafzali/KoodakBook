import type { NextConfig } from 'next'
import path from 'path'

// Docker internal service name at runtime; override with BACKEND_URL for local dev
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:4000'

// Conservative starter CSP: broad enough not to break Next's inline hydration
// scripts/styles or existing third-party bits (Google Fonts, framer-motion,
// canvas-confetti, socket.io's ws upgrade) without a nonce-based rework, but
// still blocks framing and restricts everything to same-origin/https by
// default. Tighten script-src/style-src once nonces are worth the effort.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https: blob:",
      "connect-src 'self' https: wss: ws:",
      "frame-ancestors 'none'",
    ].join('; ') },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  // Proxy all API and upload requests through the Next.js server so the
  // browser never needs to know the backend's address or port.
  async rewrites() {
    return [
      { source: '/api/:path*',     destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
    ]
  },
}

export default nextConfig
