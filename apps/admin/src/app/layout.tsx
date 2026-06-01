import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KoodakBook Admin',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
