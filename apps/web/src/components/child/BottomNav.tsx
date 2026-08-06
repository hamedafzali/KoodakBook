'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ParentDoorNav from './ParentDoorNav'

const NAV_ITEMS = [
  { href: '/child/home',    emoji: '🏠', label: 'خانه',    ariaLabel: 'صفحه اصلی' },
  { href: '/child/lesson',  emoji: '📚', label: 'درس‌ها',  ariaLabel: 'لیست درس‌ها' },
  { href: '/child/story',   emoji: '📖', label: 'داستان',  ariaLabel: 'داستان‌ها' },
  { href: '/child/rewards', emoji: '🏆', label: 'جوایز',   ariaLabel: 'جوایز و مدال‌ها' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="منوی اصلی"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[540px] bg-white/95 backdrop-blur-md border-t border-amber-100 flex justify-around py-2 px-2 lg:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {NAV_ITEMS.map(nav => {
        const active = pathname.startsWith(nav.href)
        return (
          <Link
            key={nav.href}
            href={nav.href}
            aria-label={nav.ariaLabel}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center gap-0.5 min-w-[64px] min-h-[52px] justify-center rounded-2xl transition-colors"
          >
            {active && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-x-1 inset-y-0.5 bg-amber-100 rounded-2xl"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <motion.span
              className="relative text-2xl leading-none"
              whileTap={{ scale: 0.78 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              {nav.emoji}
            </motion.span>
            <span className={`relative text-xs leading-none ${active ? 'font-bold text-amber-800' : 'font-medium text-gray-400'}`}>
              {nav.label}
            </span>
          </Link>
        )
      })}
      <ParentDoorNav variant="bar" />
    </nav>
  )
}
