'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ParentDoorNav from './ParentDoorNav'
import { Icon, type IconName } from '@/components/icons'

/* Four tabs plus the parent door = five items, which is the ceiling for a
 * bottom bar (and the practical limit at 64px per item on a 360px phone).
 *
 * «همه‌ی بخش‌ها» took the slot «جوایز» used to hold. Home is now a path — one
 * step at a time, chosen by the app — so the hub is the only way to reach the
 * seven rooms the nav never covered (phonics, review, math, speak, write,
 * games, friends), and it is opened every session. Rewards is visited
 * occasionally and announces itself the moment a badge is earned, so it lives
 * inside the hub instead of holding a permanent slot. */
const NAV_ITEMS: { href: string; icon: IconName; label: string; ariaLabel: string }[] = [
  { href: '/child/home',   icon: 'home',    label: 'خانه',    ariaLabel: 'صفحه اصلی' },
  { href: '/child/lesson', icon: 'lessons', label: 'درس‌ها',  ariaLabel: 'لیست درس‌ها' },
  { href: '/child/story',  icon: 'stories', label: 'داستان',  ariaLabel: 'داستان‌ها' },
  { href: '/child/rooms',  icon: 'seeAll',  label: 'همه',     ariaLabel: 'همه‌ی بخش‌ها' },
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
              className={`relative leading-none ${active ? 'text-amber-800' : 'text-gray-400'}`}
              whileTap={{ scale: 0.78 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              <Icon name={nav.icon} size="lg" strokeWidth={active ? 2.4 : 2} />
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
