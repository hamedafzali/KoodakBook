import ParentGate from '@/components/parent/ParentGate'
import ParentNav from '@/components/parent/ParentNav'

/**
 * Parent shell (desktop/responsive plan, Phase 2+3). The PIN gate now lives here
 * (once for the whole parent area, not per page), so on desktop we can show a
 * sidebar + centered content. On mobile the sidebar is hidden and pages keep
 * their own header nav.
 */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentGate>
      <div className="min-h-screen w-full flex justify-center bg-slate-200">
        <aside className="hidden lg:block self-stretch"><ParentNav /></aside>
        <div className="w-full max-w-[860px] min-h-screen bg-slate-50 lg:shadow-xl">{children}</div>
      </div>
    </ParentGate>
  )
}
