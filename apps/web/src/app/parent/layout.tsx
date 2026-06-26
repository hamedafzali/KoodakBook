/**
 * Parent shell (desktop/responsive plan, Phase 2). Parents use laptops, so we
 * center the dashboard at a comfortable width on a neutral backdrop instead of
 * letting it stretch edge-to-edge. (A full lg+ sidebar + multi-column dashboard
 * is a later enhancement — it needs the PIN gate lifted to this layout first.)
 */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex justify-center bg-slate-200">
      <div className="w-full max-w-[860px] min-h-screen lg:shadow-xl">{children}</div>
    </div>
  )
}
