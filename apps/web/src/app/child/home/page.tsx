'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { mediaUrl } from '@/lib/media'
import { useChildSession } from '@/lib/useSession'
import { pickChild, setActiveChildId } from '@/lib/activeChild'
import { consumeChildPick } from '@/lib/mode'
import { childAge } from '@/lib/persianMath'
import { speakPersian, speakOrPlay } from '@/lib/speech'
import { playTap } from '@/lib/sounds'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import Tutorial, { hasSeenTutorial } from '@/components/child/Tutorial'
import { LESSON_TYPE_EMOJI, resolveLevel, isLessonUnlocked, isStoryUnlocked, ALL_UNLOCKED, SCENE_SLUGS, type SceneSlug } from '@koodakbook/shared'
import { MODULE, ChunkyButton } from '@/components/child/kit'
import { Icon } from '@/components/icons'
import SceneBackdrop from '@/components/child/SceneBackdrop'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import { RoomSections } from '@/components/child/rooms'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem, StrandLevels, Letter, AppCharacter } from '@koodakbook/shared'

/* Child home — one glowing "next" and the whole house under it.
 *
 * The history matters, because this screen has been wrong in both directions.
 * It started as six rows of windowed carousels with the one thing the app had
 * already decided — what to do next — lost among them. The over-correction put
 * every room behind a single «همه‌ی بخش‌ها» word-shaped door, which a
 * pre-reader cannot open: a room behind a word is a room they do not have.
 *
 * What's here now, in priority order:
 *  1. «ادامه بده» — the app's one decision, as the single filled control, on an
 *     illustrated saffron card at the top. A child who wants to be told what to
 *     do is told, immediately.
 *  2. The joyful shelves — friends, قصه‌ها, الفبا, درس‌ها — as swipeable
 *     carousels of real illustrated covers. Windowed so the tile count stays
 *     bounded at any catalogue size (continue + ~10 + a 🎲 and a 🚪).
 *  3. Every room, in full, from the same source /child/rooms renders
 *     (components/child/rooms.tsx) so the two can never disagree.
 *
 * Age bands change density, never inventory: 3–5 get bigger tiles and no
 * stats — they do not get fewer rooms.
 */

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

interface NextUp { href: string; label: string; title: string; emoji: string; say: string }

/** Deterministic scene per id/href — tiles get stable illustrated covers. */
function sceneFor(id: string): SceneSlug {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SCENE_SLUGS[h % SCENE_SLUGS.length]
}

export default function ChildHomePage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [letters, setLetters] = useState<Letter[]>([])
  const [friends, setFriends] = useState<AppCharacter[]>([])
  const [stats, setStats] = useState({ words: 0, streak: 0, xp: 0 })
  const [reviewWords, setReviewWords] = useState<ReviewItem[]>([])
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [doneLessons, setDoneLessons] = useState<Set<string>>(new Set())
  const [doneStories, setDoneStories] = useState<Set<string>>(new Set())
  const [lastLesson, setLastLesson] = useState<Lesson | null>(null)
  const [lastStory, setLastStory] = useState<Story | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [pickList, setPickList] = useState<Child[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [reprobeDue, setReprobeDue] = useState(false)

  useChildSession(child?.id ?? null)
  useEffect(() => { if (!hasSeenTutorial()) setShowTutorial(true) }, [])
  useEffect(() => { api.get<AppCharacter[]>('/api/characters').then(r => { if (r.data) setFriends(r.data) }) }, [])

  async function loadForChild(c: Child) {
    setChild(c)
    const [lessonsRes, storiesRes, lettersRes, dashRes, reviewRes, progressRes, placeRes, reprobeRes] = await Promise.all([
      api.get<Lesson[]>('/api/lessons'),
      api.get<Story[]>('/api/stories'),
      api.get<Letter[]>('/api/letters'),
      api.get<DashboardSummary>(`/api/dashboard/${c.id}`),
      api.get<ReviewItem[]>(`/api/progress/${c.id}/review`),
      api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${c.id}`),
      api.get<{ strand_levels: StrandLevels }>(`/api/placement/${c.id}`),
      // Checked once per session load, never polled (design doc §1/§2) — a
      // skippable game card, not an interstitial; reprobeDue never expires.
      api.get<{ due: boolean }>(`/api/placement/${c.id}/reprobe-due`),
    ])
    if (dashRes.data) setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
    if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
    setReprobeDue(reprobeRes.data?.due ?? false)
    if (reviewRes.data) setReviewWords(reviewRes.data)
    if (progressRes.data) {
      setDoneLessons(new Set(progressRes.data.lessons.filter(l => l.completed).map(l => l.lesson_id)))
      setDoneStories(new Set(progressRes.data.stories.filter(s => s.completed).map(s => s.story_id)))
      const lastLessonId = progressRes.data.lessons.filter(l => !l.completed).at(-1)?.lesson_id
      if (lastLessonId && lessonsRes.data) setLastLesson(lessonsRes.data.find(l => l.id === lastLessonId) ?? null)
      const lastStoryId = progressRes.data.stories.filter(s => !s.completed).at(-1)?.story_id
      if (lastStoryId && storiesRes.data) setLastStory(storiesRes.data.find(s => s.id === lastStoryId) ?? null)
    }
    if (lessonsRes.data) setLessons(lessonsRes.data)
    if (storiesRes.data) setStories(storiesRes.data)
    if (lettersRes.data) setLetters(lettersRes.data)
  }

  function resolveChild(c: Child) {
    setActiveChildId(c.id)
    if (!c.placement_done) { router.replace('/onboarding/placement'); return }
    setShowPicker(false)
    loadForChild(c)
  }

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function start() {
      const childRes = await api.get<Child[]>('/api/children')
      if (cancelled) return
      const list = childRes.data ?? []
      if (list.length === 0) { router.replace('/parent/dashboard'); return }
      if (consumeChildPick() && list.length > 1) { setPickList(list); setShowPicker(true); return }
      const c = pickChild(list)
      if (c) resolveChild(c)
    }
    start()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const band = child ? (childAge(child) <= 5 ? 1 : childAge(child) <= 7 ? 2 : 3) : 2

  // ── The one decision the app makes FOR the child ──────────
  const nextUp = useMemo<NextUp>(() => {
    if (lastLesson) return { href: `/child/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, emoji: LESSON_TYPE_EMOJI[lastLesson.type] ?? '📚', say: `بیا درس ${lastLesson.title} رو تمام کنیم!` }
    if (reviewWords.length >= 3) return { href: '/child/review', label: 'مرور کلمه‌ها', title: `${reviewWords.length} کلمه منتظرند`, emoji: '🔄', say: 'بیا کلمه‌هایی که یاد گرفتی رو مرور کنیم!' }
    if (lastStory) return { href: `/child/story/${lastStory.id}`, label: 'ادامه‌ی قصه', title: lastStory.title_persian, emoji: '📖', say: `بیا بقیه‌ی قصه‌ی ${lastStory.title_persian} رو بخونیم!` }
    const nl = lessons.find(l => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
    if (nl) return { href: `/child/lesson/${nl.id}`, label: 'درس تازه', title: nl.title, emoji: LESSON_TYPE_EMOJI[nl.type] ?? '📚', say: `بیا درس ${nl.title} رو شروع کنیم!` }
    const ns = stories.find(s => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
    if (ns) return { href: `/child/story/${ns.id}`, label: 'قصه‌ی تازه', title: ns.title_persian, emoji: '📖', say: `بیا قصه‌ی ${ns.title_persian} رو بخونیم!` }
    return { href: '/child/phonics', label: 'بازی صداها', title: 'زبر، زیر، پیش', emoji: '🎵', say: 'بیا با صداها بازی کنیم!' }
  }, [lastLesson, lastStory, reviewWords, lessons, stories, strandLevels, doneLessons, doneStories])

  // ── Windowed carousels: bounded tiles at any catalog size ──
  const lessonRow = useMemo(() => {
    const unlocked = lessons.filter(l => isLessonUnlocked(l, strandLevels))
    const todo = unlocked.filter(l => !doneLessons.has(l.id)).sort((a, b) => a.stage - b.stage)
    const locked = lessons.filter(l => !isLessonUnlocked(l, strandLevels)).slice(0, 2)
    return { window: todo.slice(0, 10), doneCount: doneLessons.size, locked, pool: todo }
  }, [lessons, strandLevels, doneLessons])

  const storyRow = useMemo(() => {
    const unlocked = stories.filter(s => isStoryUnlocked(s, strandLevels))
    const fresh = unlocked.filter(s => !doneStories.has(s.id) && s.id !== lastStory?.id).sort((a, b) => a.stage - b.stage)
    const win = (lastStory ? [lastStory] : []).concat(fresh).slice(0, 10)
    const locked = stories.filter(s => !isStoryUnlocked(s, strandLevels)).slice(0, 2)
    return { window: win, doneCount: doneStories.size, locked, pool: unlocked }
  }, [stories, strandLevels, doneStories, lastStory])

  function surprise(kind: 'lesson' | 'story') {
    const pool = kind === 'lesson' ? lessonRow.pool : storyRow.pool
    if (pool.length === 0) return
    const pick = pool[Math.floor(Math.random() * pool.length)]
    speakPersian('سورپرایز!')
    router.push(kind === 'lesson' ? `/child/lesson/${pick.id}` : `/child/story/${(pick as Story).id}`)
  }

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-50 child-bg flex flex-col items-center justify-center p-6 gap-8">
        <h1 className="font-display text-h1 font-bold text-text-primary persian-text">کی می‌خواد بازی کنه؟ 🎮</h1>
        <div className="grid grid-cols-2 gap-5 w-full max-w-md">
          {pickList.map(c => (
            <motion.button key={c.id} onClick={() => resolveChild(c)} whileTap={{ scale: 0.94 }}
              className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-3" aria-label={`بازی با ${c.name}`}>
              {/* EMOJI-CONTENT: avatar placeholder standing in for a child's own photo —
                  this is a portrait slot, not an affordance. Wants real art from
                  pixel-wizards-charachters, not a UI glyph. */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-4xl"
                style={{ background: 'var(--ramp-brand-soft)' }}>
                {mediaUrl(c.avatar_url) ? <img src={mediaUrl(c.avatar_url)!} alt="" className="w-full h-full object-cover" /> : '🧒'}
              </div>
              <span className="font-bold text-text-primary">{c.name}</span>
            </motion.button>
          ))}
        </div>
        <button onClick={() => router.push('/parent/dashboard')}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors persian-text mt-2 inline-flex items-center gap-1.5 min-h-[44px]">
          <Icon name="back" size="sm" />
          بازگشت به پنل والدین
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <AnimatePresence>
        {showTutorial && <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* ── Hero: greeting + mascot; stats only for older kids ──
          The saffron identity gradient (#FBBF24 → #F97316) at full brightness,
          with very dark warm-brown ink (--color-on-brand, text-on-brand) — the
          DESIGN_CHARTER rule is dark ink on saffron, never white. Contrast:
          8.97:1 at the amber end, 5.34:1 at the orange end. The twinkles are
          the app's own emoji, not monochrome strokes. */}
      <div
        className="relative overflow-hidden pt-8 pb-24 px-5 rounded-b-[2.5rem] text-on-brand"
        style={{ background: 'linear-gradient(to bottom right, var(--color-brand-from), var(--color-brand-to))' }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true" />
        <motion.span className="absolute top-6 left-16 text-xl select-none" aria-hidden="true"
          animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>⭐</motion.span>
        <motion.span className="absolute bottom-16 right-24 text-lg select-none opacity-80" aria-hidden="true"
          animate={{ y: [0, -8, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}>☁️</motion.span>
        <motion.span className="absolute top-14 right-1/3 text-sm select-none opacity-90" aria-hidden="true"
          animate={{ y: [0, -5, 0], rotate: [0, -10, 0] }} transition={{ duration: 3.0, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}>✨</motion.span>
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-body mb-1 opacity-80">{greeting()} 👋</p>
            <h1 className="font-display text-h1 font-bold">{child?.name ?? 'کودک عزیز'}</h1>
            {band === 3 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {stats.streak > 0 && <div className="bg-white/30 rounded-full px-3 py-1 text-small font-bold">🔥 {stats.streak} روز</div>}
                {stats.words > 0 && <div className="bg-white/30 rounded-full px-3 py-1 text-small font-bold">⭐ {stats.words} کلمه</div>}
                <div className="bg-white/30 rounded-full px-3 py-1 text-small font-bold">🎓 {resolveLevel(stats.xp).label}</div>
              </div>
            )}
            {/* Streak count hidden for bands 1-2 (expert review, streak
                hazard): a broken-streak number is exactly the punishment-
                for-failure shape the frustration-loop work was meant to
                eliminate, and the youngest kids have no control over whether
                a tablet gets handed to them on a given day. Band 3 keeps it
                in the chip row above; every band still sees it on the
                parent dashboard. */}
          </div>
          <button onClick={() => speakPersian(nextUp.say)} aria-label="مَسکات — بگو چی کار کنیم">
            <Mascot size={band === 1 ? 116 : 96} mood={stats.streak > 0 ? 'happy' : 'idle'} />
          </button>
        </div>
      </div>

      <div className={`relative -mt-14 px-4 space-y-7 pb-4 ${band === 3 ? 'lg:px-8 lg:max-w-5xl lg:mx-auto' : 'max-w-2xl mx-auto'}`}>

        {/* ── ادامه بده: the app already decided what's next ──
             The one filled control on the screen, on an illustrated saffron
             card rather than a flat white slab — the "play" thing should look
             like the most fun thing here. */}
        <Link href={nextUp.href} aria-label={`${nextUp.label}: ${nextUp.title}`}>
          <motion.div
            whileTap={{ scale: 0.97 }}
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative overflow-hidden rounded-[1.75rem] shadow-raised flex items-center gap-4 text-on-brand ${band === 1 ? 'p-6' : 'p-5'}`}
            style={{ background: 'linear-gradient(to bottom right, var(--color-brand-from), var(--color-brand-to))' }}
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
              <SceneBackdrop scene={sceneFor(nextUp.href)} className="w-full h-full !rounded-none" />
            </div>
            <span className={`relative shrink-0 ${band === 1 ? 'text-6xl' : 'text-5xl'}`} aria-hidden="true">{nextUp.emoji}</span>
            <div className="relative flex-1 min-w-0">
              <p className="font-bold text-small opacity-80">{nextUp.label}</p>
              <p className={`font-display font-bold truncate ${band === 1 ? 'text-h1' : 'text-card-title'}`}>{nextUp.title}</p>
            </div>
            <ChunkyButton className={`relative ${band === 1 ? 'text-xl px-6 py-4' : 'px-5 py-3'}`}>
              بازی کن! 🎈
            </ChunkyButton>
          </motion.div>
        </Link>

        {/* ── Re-placement's entry point (all bands): a skippable game card,
             same visual weight as any other activity, flavor-labeled — never
             "ارزیابی"/assessment wording (design doc §2). Doesn't render next
             visit until it's due again. ── */}
        {reprobeDue && (
          <Link href="/onboarding/placement?mode=reprobe" aria-label="بازی سیمرغ">
            <motion.div whileTap={{ scale: 0.98 }}
              className="rounded-2xl p-4 shadow-card flex items-center gap-3"
              style={{ background: 'var(--ramp-brand-soft)' }}>
              {/* EMOJI-CONTENT: Simorgh is the character the game is about. */}
              <span className="text-3xl" aria-hidden="true">🦅</span>
              <div className="flex-1">
                <p className="font-bold text-text-primary text-sm">بازی سیمرغ</p>
                <p className="text-xs text-text-secondary">سیمرغ دلش می‌خواد باهات بازی کنه!</p>
              </div>
              <span style={{ color: 'var(--ramp-brand-ink)' }}><Icon name="prev" size="md" strokeWidth={2.5} /></span>
            </motion.div>
          </Link>
        )}

        {/* ── Friends row: the characters (all bands) ── */}
        {friends.length > 0 && (
          <TileRow label="دوست‌های من 🦊" bigTiles={band === 1}>
            {friends.map(f => (
              <Link key={f.slug} href={`/child/friends/${f.slug}`} role="listitem"
                aria-label={`برو پیش ${f.name_persian}`} className="flex-shrink-0 snap-start">
                <motion.div whileTap={{ scale: 0.93 }}
                  className={`${band === 1 ? 'w-40' : 'w-32'} bg-white rounded-2xl shadow-card flex flex-col items-center gap-1 py-3`}>
                  <CharacterAvatar slug={f.slug} size={band === 1 ? 96 : 76} mood="idle" />
                  <p className="font-bold text-text-primary text-sm">{f.name_persian}</p>
                  <p className="text-[10px] text-brand-text font-bold">بیا پیشم! 👋</p>
                </motion.div>
              </Link>
            ))}
          </TileRow>
        )}

        {/* ── Stories row (all bands — stories are the heart) ── */}
        <TileRow label="قصه‌ها 📖" bigTiles={band === 1}>
          {storyRow.window.map(s => (
            <CardTile key={s.id} href={`/child/story/${s.id}`} title={s.title_persian}
              image={mediaUrl(s.cover_url)} emoji="📖" tint={MODULE.stories.soft} scene={sceneFor(s.id)}
              glow={s.id === (lastStory?.id ?? storyRow.window[0]?.id)} big={band === 1}
              badge={s.id === lastStory?.id ? 'ادامه بده' : undefined} />
          ))}
          {storyRow.locked.map(s => (
            <LockedTile key={s.id} title={s.title_persian} big={band === 1} />
          ))}
          {storyRow.pool.length > 1 && (
            <ActionTile emoji="🎲" title="شانسی!" onClick={() => surprise('story')} big={band === 1} />
          )}
          {storyRow.doneCount > 0 && (
            <ActionTile emoji="⭐" title={`خوانده‌ها (${storyRow.doneCount})`} href="/child/story" big={band === 1} />
          )}
          <ActionTile emoji="🚪" title="همه‌ی قصه‌ها" href="/child/story" big={band === 1} />
        </TileRow>

        {/* ── Alphabet row: tap a letter, HEAR it (all bands) ── */}
        {letters.length > 0 && (
          <TileRow label="الفبا — ضربه بزن و بشنو 🔤" bigTiles={band === 1}>
            {letters.map(l => (
              <button key={l.id} role="listitem"
                onClick={() => { playTap(); speakOrPlay(l.audio_url, l.name_persian) }}
                aria-label={`بشنو: ${l.name_persian}`}
                className="flex-shrink-0 snap-start">
                <motion.div whileTap={{ scale: 0.88 }}
                  className={`${band === 1 ? 'w-24 h-28' : 'w-20 h-24'} bg-white rounded-2xl shadow-card flex flex-col items-center justify-center gap-1`}>
                  {/* The alphabet is the `letters` module — its ink, not a
                      stray sky-600 that belonged to no module. */}
                  <span className={`${band === 1 ? 'text-5xl' : 'text-4xl'} font-bold leading-none`}
                    style={{ color: 'var(--ramp-letters-ink)' }}>{l.character}</span>
                  <span className="text-[11px] text-text-secondary persian-text">{l.name_persian}</span>
                </motion.div>
              </button>
            ))}
            <ActionTile emoji="✍️" title="بنویس!" href="/child/write" big={band === 1} />
          </TileRow>
        )}

        {/* ── Lessons row (bands 2–3) ── */}
        {band >= 2 && (
          <TileRow label="درس‌ها 📚">
            {lessonRow.window.map((l, idx) => (
              <CardTile key={l.id} href={`/child/lesson/${l.id}`} title={l.title}
                emoji={LESSON_TYPE_EMOJI[l.type] ?? '📖'} tint={MODULE.lessons.soft}
                sub={`مرحله ${l.stage}`} glow={idx === 0} />
            ))}
            {lessonRow.locked.map(l => <LockedTile key={l.id} title={l.title} />)}
            {lessonRow.pool.length > 1 && <ActionTile emoji="🎲" title="شانسی!" onClick={() => surprise('lesson')} />}
            {lessonRow.doneCount > 0 && <ActionTile emoji="⭐" title={`انجام‌شده (${lessonRow.doneCount})`} href="/child/lesson" />}
            <ActionTile emoji="🚪" title="همه‌ی درس‌ها" href="/child/lesson" />
          </TileRow>
        )}

        {/* ── Review, when the queue is real (bands 2–3) ──
             Carries a COUNT, which is why it earns a place here instead of
             just living in the rooms below. */}
        {band >= 2 && reviewWords.length >= 3 && nextUp.href !== '/child/review' && (
          <Link href="/child/review" aria-label={`مرور ${reviewWords.length} کلمه`}>
            <motion.div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3" whileTap={{ scale: 0.98 }}>
              <span className="text-2xl" aria-hidden="true">🔄</span>
              <div className="flex-1">
                <p className="font-bold text-text-primary text-sm">مرور امروز</p>
                <p className="text-xs text-text-secondary">{reviewWords.length} کلمه منتظر توست</p>
              </div>
              <span style={{ color: 'var(--ramp-review-ink)' }}><Icon name="prev" size="md" strokeWidth={2.5} /></span>
            </motion.div>
          </Link>
        )}

        {/* ── Every room, on the screen ──
             The same source /child/rooms renders. Friends appear above as a
             carousel, so they're passed to RoomSections only on the deep-link
             page, not here. */}
        <RoomSections band={band} />
      </div>

      <BottomNav />
    </div>
  )
}

/* ── Building blocks ─────────────────────────────────────── */

function TileRow({ label, bigTiles, children }: { label: string; bigTiles?: boolean; children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [ends, setEnds] = useState({ start: true, end: true })   // hidden until measured

  // Track position, not just overflow: each arrow exists only while there is
  // content in ITS direction (self-evident semantics, disappears at the end).
  // RTL note: modern engines report scrollLeft ≤ 0 in RTL; |scrollLeft| is the
  // distance travelled from the start (which sits at the visual RIGHT).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const check = () => {
      const max = el.scrollWidth - el.clientWidth
      const pos = Math.abs(el.scrollLeft)
      const next = { start: max <= 8 || pos <= 8, end: max <= 8 || pos >= max - 8 }
      // Functional + value-compared: a fresh object every call here would
      // re-render → re-run → loop, freezing the whole page's interactivity.
      setEnds(prev => (prev.start === next.start && prev.end === next.end ? prev : next))
    }
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    // Rows fill asynchronously (API data) without resizing the scroller box —
    // watch the children too, or arrows would only appear after a manual scroll.
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true })
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); mo.disconnect() }
  }, [])

  /** forward = deeper into content = visual LEFT in RTL. */
  function nudge(forward: boolean) {
    const el = scroller.current
    if (el) el.scrollBy({ left: (forward ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section>
      <h2 className={`font-bold text-text-primary mb-3 ${bigTiles ? 'text-lg' : 'text-base'}`}>{label}</h2>
      <div className="relative">
        {/* Full-bleed on mobile (-mx-4) so tiles swipe edge-to-edge instead of
            clipping at the page padding; pt-1/px-1 give the glow ring room. */}
        <div ref={scroller}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth"
          role="list" aria-label={label}>
          {children}
        </div>
        {/* Desktop affordance: glossy arrows floated half OFF the content so
            they never cover a tile; each lives only while its direction has
            more content, so it can't point the wrong way. */}
        {!ends.end && (
          <button onClick={() => nudge(true)} aria-label="بعدی"
            className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-gradient-to-b from-white to-surface-subtle shadow-lg ring-1 ring-border items-center justify-center text-2xl text-text-secondary hover:text-brand-text hover:scale-110 active:scale-95 transition">‹</button>
        )}
        {!ends.start && (
          <button onClick={() => nudge(false)} aria-label="قبلی"
            className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-gradient-to-b from-white to-surface-subtle shadow-lg ring-1 ring-border items-center justify-center text-2xl text-text-secondary hover:text-brand-text hover:scale-110 active:scale-95 transition">›</button>
        )}
      </div>
    </section>
  )
}

function CardTile({ href, title, sub, badge, emoji, image, tint, scene, glow, big }: {
  href: string; title: string; sub?: string; badge?: string
  emoji: string; image?: string | null; tint: string; scene?: SceneSlug; glow?: boolean; big?: boolean
}) {
  const w = big ? 'w-44' : 'w-36'
  const h = big ? 'h-32' : 'h-24'
  const total = big ? 'h-[212px]' : 'h-[172px]'
  return (
    <Link href={href} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>
      <motion.div
        className={`${w} ${total} bg-white rounded-2xl overflow-hidden shadow-card relative flex flex-col`}
        /* Glow is the brand `bright`, the same hue as the «ادامه بده» card —
           an inline shadow so it replaces `.shadow-card` wholesale rather than
           stacking a second, mismatched ring on top of it. */
        style={glow ? { boxShadow: '0 0 0 4px var(--ramp-brand-bright), 0 8px 20px rgb(15 23 42 / 0.10)' } : undefined}
        whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {badge && <span className="absolute top-2 right-2 z-10 bg-brand-text text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
        {image ? (
          <div className={`relative w-full ${h} shrink-0`}>
            <Image src={image} alt="" fill sizes="176px" className="object-cover" />
          </div>
        ) : scene ? (
          <div className={`w-full ${h} shrink-0`}><SceneBackdrop scene={scene} className="w-full h-full !rounded-none" /></div>
        ) : (
          <div className={`w-full ${h} shrink-0 ${tint} flex items-center justify-center ${big ? 'text-6xl' : 'text-5xl'}`} aria-hidden="true">{emoji}</div>
        )}
        <div className="p-3 flex-1 min-h-0">
          <p className={`font-bold text-text-primary leading-tight line-clamp-2 ${big ? 'text-base' : 'text-sm'}`}>{title}</p>
          {sub && <p className="text-xs text-text-secondary mt-0.5 truncate">{sub}</p>}
        </div>
      </motion.div>
    </Link>
  )
}

/** Friendly lock: sleeping tile, not a barrier. */
function LockedTile({ title, big }: { title: string; big?: boolean }) {
  return (
    <div role="listitem" className="flex-shrink-0" aria-label={`${title} — هنوز خوابه`}>
      <div className={`${big ? 'w-44 h-[212px]' : 'w-36 h-[172px]'} bg-white/60 rounded-2xl overflow-hidden shadow-sm select-none flex flex-col`}>
        <div className={`w-full shrink-0 ${big ? 'h-32' : 'h-24'} bg-surface-subtle flex items-center justify-center ${big ? 'text-5xl' : 'text-4xl'}`} aria-hidden="true">😴</div>
        <div className="p-3 flex-1 min-h-0">
          <p className="font-bold text-text-secondary text-sm leading-tight line-clamp-2">{title}</p>
          <p className="text-xs text-text-secondary mt-0.5 truncate">هنوز خوابه!</p>
        </div>
      </div>
    </div>
  )
}

/** 🎲 dice / ⭐ stack / 🚪 door tiles at the end of each row. */
function ActionTile({ emoji, title, href, onClick, big }: {
  emoji: string; title: string; href?: string; onClick?: () => void; big?: boolean
}) {
  const inner = (
    <motion.div whileTap={{ scale: 0.94 }}
      className={`${big ? 'w-32 h-[212px]' : 'w-28 h-[172px]'} bg-amber-50 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2`}>
      <span className={big ? 'text-5xl' : 'text-4xl'} aria-hidden="true">{emoji}</span>
      <p className="font-bold text-brand-text text-xs text-center px-2 leading-snug">{title}</p>
    </motion.div>
  )
  if (href) return <Link href={href} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>{inner}</Link>
  return <button onClick={onClick} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>{inner}</button>
}
