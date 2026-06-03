import type { NextConfig } from 'next'
import path from 'path'

// Docker internal service name at runtime; override with BACKEND_URL for local dev
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:4000'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),

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
