'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { childAge, recommendedRoom, type MathRoom } from '@/lib/persianMath'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import type { Child } from '@koodakbook/shared'
import { type IconName } from '@/components/icons'
import { ModuleCard, SectionTitle } from '@/components/child/kit'
import { ClayChip, type Tone } from '@/components/child/clay'

/* دنیای اعداد — hub. Three rooms, one per age band; the child's age picks the
 * highlighted «برای تو» room, nothing is locked (older sibling curiosity is
 * fine — difficulty adapts inside each room). */

/* Three rooms of one house, but each with its own colour — the shipped
 * emerald / sky / saffron (DESIGN_CHARTER.md: colour is delight, one strong
 * hue per card is welcome). The old per-room gradients put WHITE on a -400
 * fill and failed AA; these are the same hues rebuilt as chunky clay tiles
 * with DARK ink (every fill↔ink pair ≥ 6:1 — see clay.tsx TONES). */
const ROOMS: { id: MathRoom; href: string; icon: IconName; glyph?: string; tone: Tone; title: string; sub: string; ages: string }[] = [
  { id: 'counting', href: '/child/math/counting', icon: 'counting', glyph: '🍎', tone: 'emerald', title: 'شمارش', sub: 'بشمار و بگو چند تا!', ages: '۳–۵' },
  // The Persian digit IS what this room teaches, so it stays a glyph — the
  // documented `glyph` escape hatch on the tile, not an emoji.
  { id: 'digits', href: '/child/math/digits', icon: 'math', glyph: '۴', tone: 'sky', title: 'رقم‌های فارسی', sub: '۷ همان 7 است!', ages: '۶–۷' },
  { id: 'bazaar', href: '/child/math/bazaar', icon: 'shop', glyph: '🛒', tone: 'amber', title: 'بازار', sub: 'با تومان خرید کن', ages: '۸–۱۰' },
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
      <PageHeader title="دنیای اعداد ۱۲۳" subtitle="ریاضی به زبان فارسی" module="math" />

      <div className="px-4 pt-5 space-y-5 max-w-md mx-auto">
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'var(--ramp-math-soft)', color: 'var(--ramp-math-ink)' }}
        >
          <Mascot size={64} mood="happy" />
          <p className="persian-text text-body flex-1 font-medium">
            تو بلدی بشماری — حالا بیا به فارسی بشماریم!
          </p>
        </div>

        <div>
          <SectionTitle module="math">اتاق‌ها</SectionTitle>
          <div className="space-y-3">
            {ROOMS.map(room => {
              const isRec = rec === room.id
              return (
                /* The recommendation used to be a ring plus an opacity knock-back
                 * on the other two — which dimmed perfectly valid choices. Now it
                 * is additive: the suggested room gets a badge and the bigger
                 * tile, and nothing is made to look switched off. */
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: ROOMS.indexOf(room) * 0.06 }}
                >
                  {isRec && (
                    <div className="flex justify-end mb-1.5">
                      <ClayChip ramp="rewards">برای تو <span aria-hidden="true">⭐</span></ClayChip>
                    </div>
                  )}
                  <ModuleCard
                    module="math"
                    tone={room.tone}
                    icon={room.icon}
                    glyph={room.glyph}
                    title={room.title}
                    sub={`${room.sub} · ${room.ages} سال`}
                    href={room.href}
                    big={isRec}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-small text-text-secondary persian-text leading-relaxed pt-1">
          ریاضی را در مدرسه یاد می‌گیری — اینجا یادش می‌گیری به فارسی بگویی <span aria-hidden="true">💛</span>
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
