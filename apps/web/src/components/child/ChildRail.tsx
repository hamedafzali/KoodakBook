'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ParentDoorNav from './ParentDoorNav'
import { Icon, type IconName } from '@/components/icons'

/* Desktop (lg+) vertical nav rail — the pointer/keyboard counterpart to the
 * touch BottomNav (which hides at lg). Same destinations, same active styling,
 * so the two nav models share intent and differ only in ergonomics.
 * Keep this list in sync with BottomNav's. */
const NAV_ITEMS: { href: string; icon: IconName; label: string; ariaLabel: string }[] = [
  { href: '/child/home',    icon: 'home',    label: 'خانه',    ariaLabel: 'صفحه اصلی' },
  { href: '/child/lesson',  icon: 'lessons', label: 'درس‌ها',  ariaLabel: 'لیست درس‌ها' },
  { href: '/child/story',   icon: 'stories', label: 'داستان',  ariaLabel: 'داستان‌ها' },
  { href: '/child/rewards', icon: 'rewards', label: 'جوایز',   ariaLabel: 'جوایز و مدال‌ها' },
]

export default function ChildRail() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="منوی اصلی"
      className="hidden lg:flex flex-col items-center gap-2 w-24 shrink-0 py-6 bg-white/70 backdrop-blur-md border-e border-amber-100 sticky top-0 self-start h-screen"
    >
      {/* EMOJI-CONTENT: brand mascot, not a UI affordance — an outline glyph would
          be a downgrade here. Wants a real mark from pixel-wizards-charachters. */}
      <span className="text-3xl mb-4 select-none" aria-hidden="true">🦉</span>
      {NAV_ITEMS.map(nav => {
        const active = pathname.startsWith(nav.href)
        return (
          <Link
            key={nav.href}
            href={nav.href}
            aria-label={nav.ariaLabel}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-colors ${
              active ? 'bg-amber-100 text-amber-700' : 'text-text-secondary hover:bg-amber-50 hover:text-gray-600'
            }`}
          >
            <motion.span className="leading-none" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.85 }}>
              <Icon name={nav.icon} size="lg" strokeWidth={active ? 2.4 : 2} />
            </motion.span>
            <span className={`text-[11px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>{nav.label}</span>
          </Link>
        )
      })}
      <div className="mt-auto pt-4 border-t border-amber-100 w-16 flex justify-center">
        <ParentDoorNav variant="rail" />
      </div>
    </nav>
  )
}
