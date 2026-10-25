'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ParentDoorNav from './ParentDoorNav'
import Mascot from './Mascot'
import { Icon, type IconName } from '@/components/icons'

/* Desktop (lg+) vertical nav rail — the pointer/keyboard counterpart to the
 * touch BottomNav (which hides at lg). Same destinations, same active styling,
 * so the two nav models share intent and differ only in ergonomics.
 * Keep this list in sync with BottomNav's. */
const NAV_ITEMS: { href: string; icon: IconName; label: string; ariaLabel: string }[] = [
  // ariaLabel contains the visible label (WCAG 2.5.3) — see BottomNav.
  { href: '/child/home',    icon: 'home',    label: 'خانه',    ariaLabel: 'خانه، صفحه اصلی' },
  { href: '/child/lesson',  icon: 'level',   label: 'درس‌ها',  ariaLabel: 'لیست درس‌ها' },
  { href: '/child/story',   icon: 'stories', label: 'داستان‌ها', ariaLabel: 'داستان‌ها' },
  { href: '/child/rewards', icon: 'rewards', label: 'جوایز',   ariaLabel: 'جوایز و مدال‌ها' },
]

export default function ChildRail() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="منوی اصلی"
      className="hidden lg:flex flex-col items-center gap-2 w-24 shrink-0 py-6 bg-white/70 backdrop-blur-md border-e border-amber-100 sticky top-0 self-start h-screen"
    >
      {/* The brand mark is سیمرغ, the mascot, from the character library (the
          same art as Home's header) — this was a 🦉 emoji stand-in waiting
          for exactly that art. Decorative: the nav is named by its label. */}
      <span className="mb-3 select-none" aria-hidden="true">
        <Mascot size={56} mood="idle" />
      </span>
      {NAV_ITEMS.map(nav => {
        const active = pathname.startsWith(nav.href)
        return (
          <Link
            key={nav.href}
            href={nav.href}
            aria-label={nav.ariaLabel}
            aria-current={active ? 'page' : undefined}
            /* Same selected language as BottomNav (green ink, heavier
               stroke, soft pill) plus an inline-start marker bar — the
               rail's equivalent of the bar's underline. */
            className={`relative flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-colors ${
              active ? 'bg-lessons-soft text-lessons-deep' : 'text-text-secondary hover:bg-lessons-soft/70 hover:text-text-primary'
            }`}
          >
            {active && <span aria-hidden="true" className="absolute -start-4 top-3 bottom-3 w-1 rounded-full bg-lessons-deep" />}
            <motion.span className="leading-none" whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.85 }} tabIndex={-1}>
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
