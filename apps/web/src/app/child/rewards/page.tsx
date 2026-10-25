'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { BADGE_DEFINITIONS, BADGE_EMOJI, toPersianDigits } from '@koodakbook/shared'
import type { ChildBadge, BadgeKey, Child } from '@koodakbook/shared'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import { SectionTitle } from '@/components/child/kit'
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
  // A failed fetch used to render every badge locked — «۰ از N» — telling a
  // child they had lost what they'd earned. Failed is not "none yet".
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    const fail = (e: string | null) => { setLoadError(e ?? 'اتصال برقرار نشد. دوباره تلاش کن'); setLoading(false) }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      if (cancelled) return
      if (!childRes.data) { fail(childRes.error); return }
      const child = pickChild(childRes.data)
      if (!child) { setLoading(false); return }
      const badgesRes = await api.get<ChildBadge[]>(`/api/badges/${child.id}`)
      if (cancelled) return
      if (!badgesRes.data) { fail(badgesRes.error); return }
      setEarned(badgesRes.data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [router, attempt])

  if (loading) return <LoadingScreen message="در حال بارگذاری جوایز..." />
  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }} />
  }

  const earnedKeys = new Set(earned.map(b => b.badge?.key))
  const total = Object.keys(BADGE_DEFINITIONS).length
  const effortBadges = Object.entries(BADGE_DEFINITIONS).filter(([, def]) => def.effort)
  const outcomeBadges = Object.entries(BADGE_DEFINITIONS).filter(([, def]) => !def.effort)

  return (
    <div className="min-h-screen child-bg pb-nav">
      {/* Header */}
      <div
        // White text on this bright→deep saffron gradient measured ~1.7:1 at
        // the bright end. DESIGN_CHARTER.md's pairing is dark `ink` on
        // `bright`, so the header text now uses the rewards ink instead.
        // (No role="banner": this sits inside the root layout's <main>, and
        // a second banner landmark there is misleading.)
        className="px-5 pt-10 pb-8 rounded-b-3xl flex items-end justify-between"
        style={{
          background: 'linear-gradient(to bottom right, color-mix(in oklab, white 25%, var(--ramp-rewards-bright)), var(--ramp-rewards-bright))',
          color: 'var(--ramp-rewards-ink)',
        }}
      >
        <div>
          <h1 className="font-display text-2xl font-black">جوایز من <span aria-hidden="true">🏆</span></h1>
          <p className="text-sm mt-1 persian-text">{toPersianDigits(earned.length)} از {toPersianDigits(total)} جایزه</p>
          {/* Progress dots */}
          <div className="flex gap-2 mt-3" role="progressbar" aria-valuenow={earned.length} aria-valuemin={0} aria-valuemax={total} aria-label={`${toPersianDigits(earned.length)} از ${toPersianDigits(total)} جایزه گرفته شده`}>
            {Array.from({ length: total }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < earned.length ? 'bg-rewards-ink' : 'bg-white/70'}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.06 }}
              />
            ))}
          </div>
        </div>
        <Mascot size={90} mood={earned.length > 0 ? 'proud' : 'idle'} className="-mb-4" />
      </div>

      <div className="px-4 lg:px-8 pt-5 space-y-6">

        {/* Outcome badges */}
        <section aria-labelledby="outcome-badges-title">
          <SectionTitle module="rewards" id="outcome-badges-title">دستاوردها</SectionTitle>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
          <SectionTitle module="rewards" id="effort-badges-title">تلاش و پشتکار <span aria-hidden="true">💪</span></SectionTitle>
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
        className={`rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-all ${
          isEarned
            ? 'bg-white shadow-raised border-2 border-amber-200'
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
          {/* EMOJI-CONTENT: an earned badge is a collectible the child keeps —
              its face is artwork. The *locked* state shows a padlock emoji. */}
          {isEarned ? BADGE_EMOJI[badgeKey] ?? '🏆' : <span aria-hidden="true">🔒</span>}
        </motion.span>
        <p className={`font-bold text-sm ${isEarned ? 'text-text-primary' : 'text-text-secondary'}`}>
          {/* The article's aria-label isn't read when a screen reader walks
              the grid line by line — the padlock is aria-hidden artwork, so
              the locked state needs its own words in the content. */}
          {!isEarned && <span className="sr-only">قفل: </span>}
          {def.title}
        </p>
        <p className={`text-xs ${isEarned ? 'text-text-secondary' : 'text-text-secondary'}`}>
          {isEarned ? def.description : def.hint}
        </p>
        {isEarned && (
          <motion.span
            className="text-xs text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span aria-hidden="true">✓</span> دریافت شد
          </motion.span>
        )}
      </motion.div>
    </motion.article>
  )
}
