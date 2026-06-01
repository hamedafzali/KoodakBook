'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { BADGE_DEFINITIONS } from '@koodakbook/shared'
import type { ChildBadge, BadgeKey, Child } from '@koodakbook/shared'
import Mascot from '@/components/child/Mascot'

const BADGE_EMOJIS: Record<string, string> = {
  first_lesson: '📚', first_story: '📖', words_10: '⭐', streak_7: '🔥', all_alphabet: '🔤'
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, scale: 0.7 }, show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } } }

export default function RewardsPage() {
  const router = useRouter()
  const [earned, setEarned] = useState<ChildBadge[]>([])

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const childRes = await api.get<Child[]>('/api/children')
      if (!childRes.data?.[0]) return
      const badgesRes = await api.get<ChildBadge[]>(`/api/badges/${childRes.data[0].id}`)
      if (badgesRes.data) setEarned(badgesRes.data)
    }
    load()
  }, [router])

  const earnedKeys = new Set(earned.map(b => b.badge?.key))
  const total = Object.keys(BADGE_DEFINITIONS).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 pt-10 pb-8 rounded-b-[3rem] text-white flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">جوایز من 🏆</h1>
          <p className="text-amber-100 text-sm mt-1">{earned.length} از {total} جایزه</p>
          {/* Progress dots */}
          <div className="flex gap-2 mt-3">
            {Array.from({ length: total }).map((_, i) => (
              <motion.div key={i}
                className={`w-3 h-3 rounded-full ${i < earned.length ? 'bg-white' : 'bg-white/30'}`}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}
              />
            ))}
          </div>
        </div>
        <Mascot size={90} mood={earned.length > 0 ? 'happy' : 'idle'} className="-mb-4" />
      </div>

      <motion.div variants={container} initial="hidden" animate="show"
        className="px-4 pt-6 grid grid-cols-2 gap-4">
        {Object.entries(BADGE_DEFINITIONS).map(([key, def]) => {
          const isEarned = earnedKeys.has(key as BadgeKey)
          return (
            <motion.div key={key} variants={item}>
              <motion.div
                className={`rounded-3xl p-5 flex flex-col items-center gap-2 text-center transition ${
                  isEarned
                    ? 'bg-white shadow-lg border-2 border-amber-200'
                    : 'bg-white/60 opacity-50'
                }`}
                whileHover={isEarned ? { scale: 1.03, y: -2 } : {}}
              >
                <motion.span
                  className="text-5xl"
                  animate={isEarned ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  {isEarned ? BADGE_EMOJIS[key] ?? '🏆' : '🔒'}
                </motion.span>
                <p className="font-bold text-gray-800 text-sm">{def.title}</p>
                <p className="text-xs text-gray-500">{def.description}</p>
                {isEarned && (
                  <motion.span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    ✓ دریافت شد
                  </motion.span>
                )}
              </motion.div>
            </motion.div>
          )
        })}
      </motion.div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-100 flex justify-around py-3 px-4">
        <Link href="/child/home"    className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">🏠</span><span className="text-xs">خانه</span></Link>
        <Link href="/child/lesson"  className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">📚</span><span className="text-xs">درس‌ها</span></Link>
        <Link href="/child/story"   className="flex flex-col items-center gap-1 text-gray-400"><span className="text-2xl">📖</span><span className="text-xs">داستان</span></Link>
        <Link href="/child/rewards" className="flex flex-col items-center gap-1 text-amber-600"><span className="text-2xl">🏆</span><span className="text-xs font-bold">جوایز</span></Link>
      </nav>
    </div>
  )
}
