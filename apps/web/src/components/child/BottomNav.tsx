'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import ParentDoorNav from './ParentDoorNav'
import { Icon, type IconName } from '@/components/icons'

/* Four tabs plus the parent door = five items, which is the ceiling for a
 * bottom bar (and the practical limit at 64px per item on a 360px phone).
 *
 * «جوایز» is back in the slot the «همه‌ی بخش‌ها» hub briefly held. That hub was
 * a tab because home had been reduced to a single path and it was the only way
 * to reach seven rooms; home carries every room itself now, so a tab pointing
 * at a second copy of home is a wasted slot. Rewards is the one destination a
 * child asks for by name and that home does not put in front of them.
 *
 * The tab marks are friendly LINE icons (2026-09-28 visual-fidelity pass,
 * matching the approved reference and the desktop ChildRail, which already
 * drew these same Lucide glyphs): the colourful emoji tabs competed with the
 * room art above them for a pre-reader's eye, and the bar and the rail drew
 * the same destination two different ways. The picture is still what a
 * pre-reader picks by — a house, a cap, a book, a cup — and the selected tab
 * says so three ways (green ink, a heavier stroke, a pill + underline), not
 * by colour alone. The inactive label keeps `text-text-secondary` (a
 * deliberate contrast fix over the old gray-400, 2.56:1). */
export const CHILD_NAV_ITEMS: { href: string; icon: IconName; label: string; ariaLabel: string }[] = [
  // ariaLabel must CONTAIN the visible label (WCAG 2.5.3 label-in-name) so a
  // voice-control user can say what they see: «صفحه اصلی» and «جایزه‌های
  // من» didn't contain «خانه» / «جوایز».
  { href: '/child/home',    icon: 'home',    label: 'خانه',   ariaLabel: 'خانه، صفحه اصلی' },
  { href: '/child/lesson',  icon: 'level',   label: 'درس‌ها', ariaLabel: 'لیست درس‌ها' },
  { href: '/child/story',   icon: 'stories', label: 'داستان‌ها', ariaLabel: 'داستان‌ها' },
  { href: '/child/rewards', icon: 'rewards', label: 'جوایز',  ariaLabel: 'جوایز من' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="منوی اصلی"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[540px] bg-white/95 backdrop-blur-md rounded-t-[1.75rem] shadow-[0_-6px_20px_rgb(61_48_40/0.08)] flex justify-around pt-2 px-2 lg:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {CHILD_NAV_ITEMS.map(nav => {
        const active = pathname.startsWith(nav.href)
        return (
          <Link
            key={nav.href}
            href={nav.href}
            aria-label={nav.ariaLabel}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center gap-0.5 min-w-[64px] min-h-[56px] justify-center rounded-2xl transition-colors"
          >
            {active && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-x-1 inset-y-0.5 bg-lessons-soft rounded-2xl"
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                aria-hidden="true"
              />
            )}
            <motion.span
              className={`relative leading-none ${active ? 'text-lessons-deep' : 'text-text-secondary'}`}
              whileTap={{ scale: 0.78 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              aria-hidden="true"
              tabIndex={-1}
            >
              <Icon name={nav.icon} size={26} strokeWidth={active ? 2.5 : 2} />
            </motion.span>
            <span className={`relative text-xs leading-none ${active ? 'font-bold text-lessons-deep' : 'font-medium text-text-secondary'}`}>
              {nav.label}
            </span>
            {/* Underline: the selected cue that survives without colour. */}
            <span aria-hidden="true"
              className={`relative h-[3px] w-5 rounded-full mt-0.5 ${active ? 'bg-lessons-deep' : 'bg-transparent'}`} />
          </Link>
        )
      })}
      <ParentDoorNav variant="bar" />
    </nav>
  )
}
