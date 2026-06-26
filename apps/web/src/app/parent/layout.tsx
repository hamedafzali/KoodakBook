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
      <div className="min-h-screen w-full flex bg-slate-100">
        <aside className="hidden lg:block self-stretch border-e border-slate-200"><ParentNav /></aside>
        {/* Fluid main region — pages own their measure via the Container layer,
            so reading pages stay a comfortable column while the dashboard fills width. */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </ParentGate>
  )
}
