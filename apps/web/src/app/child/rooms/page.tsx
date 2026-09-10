'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { ModuleCard, SectionTitle } from '@/components/child/kit'
import type { ModuleKey } from '@/components/child/kit'
import type { AppCharacter } from '@koodakbook/shared'

/* ── «همه‌ی بخش‌ها» — every room, none hidden ────────────────────────────────
 *
 * This page exists because of a decision about the home screen: home became a
 * path (one step at a time, the app decides) and the module grid moved here.
 * That trade is only safe if this page is COMPLETE.
 *
 * The old home carried the grid as truncated carousels — "first N + see all" —
 * which the audit flagged twice: children don't model hidden content, so a
 * child who never scrolls sees the same four tiles forever. Worse, the bottom
 * nav only ever carried four tabs while eleven rooms exist, so home was the
 * sole entry point for seven of them. Taking the grid off home without
 * building this page would not have demoted those rooms — it would have
 * orphaned them.
 *
 * So the rule for this file: every room the child can reach is on this page,
 * nothing is windowed, nothing is behind a "see all", and it never scrolls
 * sideways. Adding a room to the app means adding it here.
 */

interface Room {
  href: string
  module: ModuleKey
  title: string
  sub: string
}

/* Grouped by what the child WANTS, not by how the code is organised. A
 * five-year-old does not think "math module" — they think "I want to play". */
const LEARN: Room[] = [
  { href: '/child/lesson', module: 'lessons', title: 'درس‌ها', sub: 'همه‌ی درس‌ها' },
  { href: '/child/story', module: 'stories', title: 'قصه‌ها', sub: 'همه‌ی قصه‌ها' },
  { href: '/child/phonics', module: 'phonics', title: 'صداها', sub: 'زبر، زیر، پیش' },
  { href: '/child/write', module: 'write', title: 'نوشتن', sub: 'حرف‌ها را بنویس' },
  { href: '/child/speak', module: 'speak', title: 'گفتن', sub: 'کلمه‌ها را بگو' },
  { href: '/child/review', module: 'review', title: 'مرور', sub: 'کلمه‌های یادگرفته' },
]

const PLAY: Room[] = [
  { href: '/child/math', module: 'math', title: 'دنیای اعداد', sub: 'ریاضی به فارسی' },
  { href: '/child/math/counting', module: 'lessons', title: 'بشمار!', sub: 'شمردن با تصویر' },
  { href: '/child/math/digits', module: 'letters', title: 'رقم‌ها', sub: 'یک، دو، سه…' },
  { href: '/child/math/bazaar', module: 'rewards', title: 'بازار', sub: 'خرید و فروش' },
  { href: '/child/games/memory', module: 'games', title: 'بازی حافظه', sub: 'جفت‌ها را پیدا کن' },
  { href: '/child/games/marpele', module: 'games', title: 'مارپله', sub: 'نردبان و مار' },
]

/* Rewards lives here rather than in the bottom nav. The nav bar already
 * carries four tabs plus the parent door — five items, which is the documented
 * ceiling — so the hub had to take a slot from something. It took the one that
 * is visited occasionally rather than every session, and badges announce
 * themselves at the moment they're earned anyway. */
const MINE: Room[] = [
  { href: '/child/rewards', module: 'rewards', title: 'جوایز من', sub: 'مدال‌هایم' },
]

export default function ChildRoomsPage() {
  const [friends, setFriends] = useState<AppCharacter[]>([])

  useEffect(() => {
    api.get<AppCharacter[]>('/api/characters').then(r => { if (r.data) setFriends(r.data) })
  }, [])

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="همه‌ی بخش‌ها" subtitle="هر جا دوست داری برو" backHref="/child/home" />

      <div className="px-4 pt-5 space-y-7 max-w-2xl mx-auto">

        <section>
          <SectionTitle module="lessons">یاد بگیر</SectionTitle>
          <RoomGrid rooms={LEARN} />
        </section>

        <section>
          <SectionTitle module="games">بازی کن</SectionTitle>
          <RoomGrid rooms={PLAY} />
        </section>

        {/* Friends are people, not rooms — so they get faces, not module tiles.
            Rendered in a wrapping grid rather than a side-scroller: this page's
            whole promise is that nothing is off-screen. */}
        {friends.length > 0 && (
          <section>
            <SectionTitle module="speak">دوست‌های من</SectionTitle>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {friends.map(f => (
                <Link key={f.slug} href={`/child/friends/${f.slug}`} aria-label={`برو پیش ${f.name_persian}`}>
                  <motion.div
                    whileTap={{ scale: 0.93 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className="bg-white rounded-2xl shadow-card flex flex-col items-center gap-1 py-3 min-h-[112px] justify-center"
                  >
                    <CharacterAvatar slug={f.slug} size={64} mood="idle" />
                    <p className="font-bold text-slate-800 text-xs text-center px-1">{f.name_persian}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle module="rewards">مال من</SectionTitle>
          <RoomGrid rooms={MINE} />
        </section>
      </div>

      <BottomNav />
    </div>
  )
}

function RoomGrid({ rooms }: { rooms: Room[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {rooms.map(r => (
        <ModuleCard key={r.href} module={r.module} href={r.href} title={r.title} sub={r.sub} />
      ))}
    </div>
  )
}
