'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { BADGE_DEFINITIONS, BADGE_EMOJI } from '@koodakbook/shared'
import type { ChildBadge, BadgeKey, Child } from '@koodakbook/shared'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
import { pickChild } from '@/lib/activeChild'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
}

export default function RewardsPage() {
  const router = useRouter()
  const [earned, setEarned] = useState<ChildBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      const child = pickChild(childRes.data ?? [])
      if (!child) { setLoading(false); return }
      const badgesRes = await api.get<ChildBadge[]>(`/api/badges/${child.id}`)
      if (badgesRes.data) setEarned(badgesRes.data)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingScreen message="در حال بارگذاری جوایز..." />

  const earnedKeys = new Set(earned.map(b => b.badge?.key))
  const total = Object.keys(BADGE_DEFINITIONS).length
  const effortBadges = Object.entries(BADGE_DEFINITIONS).filter(([, def]) => def.effort)
  const outcomeBadges = Object.entries(BADGE_DEFINITIONS).filter(([, def]) => !def.effort)

  return (
    <div className="min-h-screen child-bg pb-nav">
      {/* Header */}
      <div
        className="bg-gradient-to-br from-purple-500 to-violet-600 px-5 pt-10 pb-8 rounded-b-[2.5rem] text-white flex items-end justify-between"
        role="banner"
      >
        <div>
          <h1 className="text-2xl font-bold">جوایز من 🏆</h1>
          <p className="text-purple-100 text-sm mt-1">{earned.length} از {total} جایزه</p>
          {/* Progress dots */}
          <div className="flex gap-2 mt-3" role="progressbar" aria-valuenow={earned.length} aria-valuemin={0} aria-valuemax={total} aria-label={`${earned.length} از ${total} جایزه گرفته شده`}>
            {Array.from({ length: total }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < earned.length ? 'bg-white' : 'bg-white/30'}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.06 }}
              />
            ))}
          </div>
        </div>
        <Mascot size={90} mood={earned.length > 0 ? 'happy' : 'idle'} className="-mb-4" />
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* Outcome badges */}
        <section aria-labelledby="outcome-badges-title">
          <h2 id="outcome-badges-title" className="font-bold text-gray-700 mb-3 text-sm">دستاوردها 🎓</h2>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
            {outcomeBadges.map(([key, def]) => {
              const isEarned = earnedKeys.has(key as BadgeKey)
              return (
                <BadgeCard
                  key={key}
                  badgeKey={key}
                  def={def}
                  isEarned={isEarned}
                />
              )
            })}
          </motion.div>
        </section>

        {/* Effort badges */}
        <section aria-labelledby="effort-badges-title">
          <h2 id="effort-badges-title" className="font-bold text-gray-700 mb-3 text-sm">تلاش و پشتکار 💪</h2>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
            {effortBadges.map(([key, def]) => {
              const isEarned = earnedKeys.has(key as BadgeKey)
              return (
                <BadgeCard
                  key={key}
                  badgeKey={key}
                  def={def}
                  isEarned={isEarned}
                />
              )
            })}
          </motion.div>
        </section>
      </div>

      <BottomNav />
    </div>
  )
}

function BadgeCard({
  badgeKey,
  def,
  isEarned,
}: {
  badgeKey: string
  def: { title: string; description: string; hint: string; effort: boolean }
  isEarned: boolean
}) {
  return (
    <motion.article
      variants={{ hidden: { opacity: 0, scale: 0.7 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } } }}
      aria-label={`${def.title}: ${isEarned ? 'گرفته شده' : `قفل — ${def.hint}`}`}
    >
      <motion.div
        className={`rounded-[1.75rem] p-4 flex flex-col items-center gap-2 text-center transition-all ${
          isEarned
            ? 'bg-white shadow-lg border-2 border-amber-200'
            : 'bg-white/60 border-2 border-transparent'
        }`}
        whileHover={isEarned ? { scale: 1.03, y: -2 } : {}}
      >
        <motion.span
          className="text-5xl"
          aria-hidden="true"
          animate={isEarned ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {isEarned ? BADGE_EMOJI[badgeKey] ?? '🏆' : '🔒'}
        </motion.span>
        <p className={`font-bold text-sm ${isEarned ? 'text-gray-800' : 'text-gray-400'}`}>{def.title}</p>
        <p className={`text-xs ${isEarned ? 'text-gray-500' : 'text-gray-400'}`}>
          {isEarned ? def.description : def.hint}
        </p>
        {isEarned && (
          <motion.span
            className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ✓ دریافت شد
          </motion.span>
        )}
      </motion.div>
    </motion.article>
  )
}
