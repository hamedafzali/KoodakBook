'use client'
import { usePathname } from 'next/navigation'
import ChildRail from '@/components/child/ChildRail'

/**
 * Child shell. On a wide screen this is a real desktop *app frame*, not a
 * centered phone: a persistent left rail (the BottomNav hides at lg) plus a
 * stage whose width is route-aware —
 *   • focused single-task screens (lesson, quiz, phonics, speak, write…) stay a
 *     centered ~540 stage on the warm backdrop — a child task shouldn't sprawl
 *     across a monitor; focus is the correct ergonomics there;
 *   • information-rich screens (home, story reader) break into a wide landscape
 *     composition and use the horizontal space.
 * Below lg the rail is hidden and the stage is full-width → mobile is unchanged.
 */
// Surfaces that adopt the wide landscape stage: the home, the browse *lists*
// (which lay out as grids), and the story *reader* (two-page spread). Focused
// single-task screens — the lesson player, phonics, speak, write, review and the
// /new story form — deliberately stay a centred ~540 stage.
const WIDE_EXACT = ['/child/home', '/child/lesson', '/child/story', '/child/rewards']
function isWideRoute(p: string) {
  if (WIDE_EXACT.includes(p)) return true
  if (p.startsWith('/child/story/') && p !== '/child/story/new') return true
  return false
}

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const wide = isWideRoute(pathname)
  return (
    <div className="min-h-screen w-full flex bg-[#ece2d1]">
      <ChildRail />
      <div className="flex-1 min-w-0 flex justify-center">
        <div
          className={`relative w-full min-h-screen bg-warm-white lg:shadow-2xl ${
            wide ? 'max-w-[540px] lg:max-w-[1120px]' : 'max-w-[540px]'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
