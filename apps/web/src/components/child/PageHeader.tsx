'use client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface Props {
  title: string
  subtitle?: string
  onBack?: () => void
  backHref?: string
  rightSlot?: React.ReactNode
  className?: string
  variant?: 'gradient' | 'white'
  gradientClass?: string
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  backHref,
  rightSlot,
  className = '',
  variant = 'gradient',
  gradientClass = 'from-amber-400 to-orange-500',
}: Props) {
  const router = useRouter()

  function handleBack() {
    if (onBack) { onBack(); return }
    if (backHref) { router.push(backHref); return }
    router.back()
  }

  // Design system v2: no saturated banner — a calm sticky header where the
  // module's color survives only as a small accent bar. Color = wayfinding
  // signal, not decoration; text lives on white for AA contrast. The legacy
  // gradientClass prop is kept (all screens pass it) and mapped to an accent.
  const ACCENT: Record<string, string> = {
    amber: 'bg-amber-400', orange: 'bg-orange-400', rose: 'bg-rose-400',
    emerald: 'bg-emerald-400', green: 'bg-green-400', teal: 'bg-teal-400',
    sky: 'bg-sky-400', blue: 'bg-blue-400', cyan: 'bg-cyan-400',
    indigo: 'bg-indigo-400', violet: 'bg-violet-400', purple: 'bg-purple-400',
    pink: 'bg-pink-400',
  }
  const hue = gradientClass.match(/from-([a-z]+)-/)?.[1] ?? 'amber'
  const bar = ACCENT[hue] ?? 'bg-amber-400'

  return (
    <div className={`sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 pt-3 pb-3 ${className}`}>
      <div className="flex items-center gap-2">
        <motion.button
          onClick={handleBack}
          aria-label="برگشت"
          whileTap={{ scale: 0.85 }}
          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          {/* RTL: right-pointing chevron = "back" (away from reading direction) */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </motion.button>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-xl text-slate-800 truncate leading-tight">{title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-8 h-1 rounded-full ${bar}`} aria-hidden="true" />
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>

        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
