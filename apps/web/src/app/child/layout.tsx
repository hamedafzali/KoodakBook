/**
 * Child stage (desktop/responsive plan, Phase 1). The child UI is a touch
 * experience — on a wide screen we don't spread it edge-to-edge; we center it as
 * a phone/tablet-width "stage" on a warm backdrop. On mobile the stage is the
 * full width, so this is invisible there. The page's own `child-bg` fills the
 * stage; the backdrop only shows beside it on desktop.
 */
export default function ChildLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex justify-center bg-[#ece2d1]">
      <div className="relative w-full max-w-[540px] min-h-screen bg-warm-white lg:shadow-2xl">
        {children}
      </div>
    </div>
  )
}
