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
// Story reader joins this once its two-page spread lands (until then it would
// merely stretch). Home is the first wide landscape surface.
const WIDE_ROUTES = ['/child/home']

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const wide = WIDE_ROUTES.some(r => pathname.startsWith(r))
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
