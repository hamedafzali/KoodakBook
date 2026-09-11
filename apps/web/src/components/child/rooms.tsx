'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { ModuleCard, SectionTitle } from '@/components/child/kit'
import type { ModuleKey } from '@/components/child/kit'
import type { AppCharacter } from '@koodakbook/shared'

/* ── Every room the child can reach ──────────────────────────────────────────
 *
 * This used to be the body of /child/rooms, reached from home through a single
 * «همه‌ی بخش‌ها» door. That was a mistake, and it is worth writing down why so
 * nobody re-derives it: the reasoning behind the door was adult reasoning —
 * "one clear step beats forty choices" — and it is sound right up until you
 * remember who holds the tablet. A four-year-old cannot read the door's label,
 * has no model of content that exists but isn't on screen, and will not tap a
 * word-shaped card on the chance that their favourite game lives behind it. A
 * room the child cannot see is a room the child does not have.
 *
 * So the rooms live ON home now, and this file is the single source of them:
 * home renders it inline, /child/rooms renders the same thing for the deep
 * link. Add a room to the app → add it here, once.
 *
 * The rules that survive from the old hub, because they were the right ones:
 * nothing windowed, nothing behind a "see all", never a sideways scroller.
 * Every tile is on the page and reachable by scrolling down, which is the one
 * gesture a pre-reader already owns.
 */

export interface Room {
  href: string
  module: ModuleKey
  title: string
  sub: string
}

/* Grouped by what the child WANTS, not by how the code is organised. A
 * five-year-old does not think "math module" — they think "I want to play". */
export const LEARN: Room[] = [
  { href: '/child/lesson', module: 'lessons', title: 'درس‌ها', sub: 'همه‌ی درس‌ها' },
  { href: '/child/story', module: 'stories', title: 'قصه‌ها', sub: 'همه‌ی قصه‌ها' },
  { href: '/child/phonics', module: 'phonics', title: 'صداها', sub: 'زبر، زیر، پیش' },
  { href: '/child/write', module: 'write', title: 'نوشتن', sub: 'حرف‌ها را بنویس' },
  { href: '/child/speak', module: 'speak', title: 'گفتن', sub: 'کلمه‌ها را بگو' },
  { href: '/child/review', module: 'review', title: 'مرور', sub: 'کلمه‌های یادگرفته' },
]

export const PLAY: Room[] = [
  { href: '/child/math', module: 'math', title: 'دنیای اعداد', sub: 'ریاضی به فارسی' },
  { href: '/child/math/counting', module: 'lessons', title: 'بشمار!', sub: 'شمردن با تصویر' },
  { href: '/child/math/digits', module: 'letters', title: 'رقم‌ها', sub: 'یک، دو، سه…' },
  { href: '/child/math/bazaar', module: 'rewards', title: 'بازار', sub: 'خرید و فروش' },
  { href: '/child/games/memory', module: 'games', title: 'بازی حافظه', sub: 'جفت‌ها را پیدا کن' },
  { href: '/child/games/marpele', module: 'games', title: 'مارپله', sub: 'نردبان و مار' },
]

export const MINE: Room[] = [
  { href: '/child/rewards', module: 'rewards', title: 'جوایز من', sub: 'مدال‌هایم' },
]

function RoomGrid({ rooms, big }: { rooms: Room[]; big?: boolean }) {
  /* One column for the youngest: at 3–5 the tile is the reading, so it gets the
     full width and the big icon rather than half a row. */
  return (
    <div className={`grid gap-3 ${big ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {rooms.map(r => (
        <ModuleCard key={r.href} module={r.module} href={r.href} title={r.title} sub={r.sub} big={big} />
      ))}
    </div>
  )
}

/** Every room, in three groups. `band` is the age band (1 = 3–5), which only
 *  changes density — never what is present. A younger child sees fewer things
 *  per row, not fewer things. */
export function RoomSections({ friends = [], band = 2 }: { friends?: AppCharacter[]; band?: number }) {
  const big = band === 1
  return (
    <>
      <section aria-labelledby="rooms-learn">
        <SectionTitle module="lessons" id="rooms-learn">یاد بگیر</SectionTitle>
        <RoomGrid rooms={LEARN} big={big} />
      </section>

      <section aria-labelledby="rooms-play">
        <SectionTitle module="games" id="rooms-play">بازی کن</SectionTitle>
        <RoomGrid rooms={PLAY} big={big} />
      </section>

      {/* Friends are people, not rooms — so they get faces, not module tiles.
          A wrapping grid, never a side-scroller: the promise here is that
          nothing is off-screen. */}
      {friends.length > 0 && (
        <section aria-labelledby="rooms-friends">
          <SectionTitle module="speak" id="rooms-friends">دوست‌های من</SectionTitle>
          <div className={`grid gap-3 ${big ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
            {friends.map(f => (
              <Link key={f.slug} href={`/child/friends/${f.slug}`} aria-label={`برو پیش ${f.name_persian}`}>
                <motion.div
                  whileTap={{ scale: 0.93 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className={`bg-white rounded-2xl shadow-card flex flex-col items-center gap-1 py-3 justify-center ${big ? 'min-h-[136px]' : 'min-h-[112px]'}`}
                >
                  <CharacterAvatar slug={f.slug} size={big ? 88 : 64} mood="idle" />
                  <p className={`font-bold text-text-primary text-center px-1 ${big ? 'text-sm' : 'text-xs'}`}>{f.name_persian}</p>
                </motion.div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="rooms-mine">
        <SectionTitle module="rewards" id="rooms-mine">مال من</SectionTitle>
        <RoomGrid rooms={MINE} big={big} />
      </section>
    </>
  )
}
