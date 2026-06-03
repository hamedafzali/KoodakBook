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

  const base = variant === 'gradient'
    ? `bg-gradient-to-br ${gradientClass} px-5 pt-10 pb-6 rounded-b-[2.5rem] text-white`
    : 'bg-white border-b border-gray-100 px-5 py-4 text-gray-800'

  return (
    <div className={`${base} ${className}`}>
      <div className="flex items-center gap-3">
        <motion.button
          onClick={handleBack}
          aria-label="برگشت"
          whileTap={{ scale: 0.85 }}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
            variant === 'gradient'
              ? 'text-white/80 hover:text-white hover:bg-white/10'
              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          {/* RTL: right-pointing chevron = "back" (away from reading direction) */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </motion.button>

        <div className="flex-1 min-w-0">
          <h1 className={`font-bold truncate ${variant === 'gradient' ? 'text-xl text-white' : 'text-xl text-gray-800'}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`text-sm mt-0.5 ${variant === 'gradient' ? 'text-white/75' : 'text-gray-500'}`}>
              {subtitle}
            </p>
          )}
        </div>

        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}
