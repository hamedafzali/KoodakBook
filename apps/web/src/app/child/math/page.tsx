'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { childAge, recommendedRoom, type MathRoom } from '@/lib/persianMath'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import type { Child } from '@koodakbook/shared'

/* دنیای اعداد — hub. Three rooms, one per age band; the child's age picks the
 * highlighted «برای تو» room, nothing is locked (older sibling curiosity is
 * fine — difficulty adapts inside each room). */

// Two steps darker than originally shipped (400/500 → 700 each): white
// title/sub text on the old pair measured well under WCAG AA's 4.5:1
// normal-text floor (2026-09 contrast audit) — same failure as kit.tsx's
// MODULE.solid, fixed the same way.
const ROOMS: { id: MathRoom; href: string; icon: string; title: string; sub: string; ages: string; grad: string }[] = [
  { id: 'counting', href: '/child/math/counting', icon: '🍎', title: 'شمارش', sub: 'بشمار و بگو چند تا!', ages: '۳–۵', grad: 'from-emerald-700 to-green-700' },
  { id: 'digits', href: '/child/math/digits', icon: '۴', title: 'رقم‌های فارسی', sub: '۷ همان 7 است!', ages: '۶–۷', grad: 'from-sky-700 to-blue-700' },
  { id: 'bazaar', href: '/child/math/bazaar', icon: '🛒', title: 'بازار', sub: 'با تومان خرید کن', ages: '۸–۱۰', grad: 'from-amber-700 to-orange-700' },
]

export default function MathHubPage() {
  const router = useRouter()
  const [age, setAge] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    api.get<Child[]>('/api/children').then(r => setAge(childAge(pickChild(r.data ?? []))))
  }, [router])

  const rec = age !== null ? recommendedRoom(age) : null

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="دنیای اعداد ۱۲۳" subtitle="ریاضی به زبان فارسی" gradientClass="from-indigo-500 to-violet-500" />

      <div className="px-4 pt-5 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3">
          <Mascot size={64} mood="happy" />
          <p className="text-gray-700 persian-text text-sm flex-1">
            تو بلدی بشماری — حالا بیا به فارسی بشماریم!
          </p>
        </div>

        {ROOMS.map(room => {
          const isRec = rec === room.id
          return (
            <Link key={room.id} href={room.href} aria-label={`${room.title} — سن ${room.ages}`}>
              <motion.div whileTap={{ scale: 0.97 }}
                className={`relative bg-gradient-to-br ${room.grad} rounded-3xl p-5 text-white flex items-center gap-4 mb-1 ${
                  isRec ? 'ring-4 ring-yellow-300 shadow-raised' : rec ? 'opacity-85 shadow-card' : 'shadow-card'}`}>
                {isRec && (
                  <span className="absolute -top-2.5 left-4 bg-yellow-300 text-yellow-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    برای تو ⭐
                  </span>
                )}
                <span className="text-4xl w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-bold" aria-hidden="true">
                  {room.icon}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-lg">{room.title}</p>
                  <p className="text-sm opacity-90">{room.sub}</p>
                </div>
                <span className="text-xs bg-white/20 rounded-full px-2.5 py-1 shrink-0">{room.ages} سال</span>
              </motion.div>
            </Link>
          )
        })}

        <p className="text-center text-xs text-gray-400 persian-text pt-1">
          ریاضی را در مدرسه یاد می‌گیری — اینجا یادش می‌گیری به فارسی بگویی 💛
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
