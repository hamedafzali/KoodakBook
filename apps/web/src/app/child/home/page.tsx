'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { LESSON_TYPE_ICON, resolveLevel, isLessonUnlocked, isStoryUnlocked, ALL_UNLOCKED } from '@koodakbook/shared'
import { ChunkyButton } from '@/components/child/kit'
import { Icon, type IconName } from '@/components/icons'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem, StrandLevels, Letter, AppCharacter } from '@koodakbook/shared'
import CharacterAvatar from '@/components/child/CharacterAvatar'

/* Child home — a path, not a menu.
 *
 * What changed and why. Home used to be a stack of windowed carousels: stories,
 * alphabet, lessons, games, and a seven-tile practice grid. Bounded at any
 * catalog size, which solved the truncation bug it was built for — but it still
 * asked a five-year-old to choose from ~40 tiles across six rows, and the one
 * thing the app had already decided (what to do next) was competing with all of
 * them for attention.
 *
 * Now: one step at a time. What was finished, what to do NOW, and a glimpse of
 * what's next. The «بازی کن!» button is the only filled control on the screen.
 * The ten modules moved to /child/rooms — a complete hub, nothing windowed —
 * which is also the fourth tab in the bottom nav. That page had to exist BEFORE
 * this one lost the grid: the nav only ever carried four tabs while eleven
 * rooms exist, so home was the sole entry point for seven of them, and deleting
 * the grid without a hub would have orphaned rooms rather than demoted them.
 *
 * What stayed on home, deliberately:
 *  - The friends row and the alphabet strip. Neither is navigation to a room —
 *    one is who the child plays with, the other is an activity performed in
 *    place (tap a letter, hear it). Both render EVERY item, so neither
 *    reintroduces the hidden-content problem carousels had.
 *  - Age bands still change density: 3–5 get a bigger path and no stats.
 */

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

interface NextUp { href: string; label: string; title: string; icon: IconName; say: string }

/** A step on the path that isn't today's. Title + icon only — these are
 *  context, not controls, so they carry no href. */
interface PathAside { title: string; icon: IconName }

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
  const [justDone, setJustDone] = useState<PathAside | null>(null)
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

      /* The step behind today. This is the most recently COMPLETED item, taken
       * from the same progress list — the API carries no completion timestamp,
       * so "the last one in the completed list" is the strongest honest claim
       * available. It is never labelled with a day («دیروز» would be a guess);
       * it just says «تمام شد». */
      const doneLessonId = progressRes.data.lessons.filter(l => l.completed).at(-1)?.lesson_id
      const doneLesson = doneLessonId && lessonsRes.data ? lessonsRes.data.find(l => l.id === doneLessonId) : null
      if (doneLesson) {
        setJustDone({ title: doneLesson.title, icon: (LESSON_TYPE_ICON[doneLesson.type] ?? 'lessons') as IconName })
      } else {
        const doneStoryId = progressRes.data.stories.filter(s => s.completed).at(-1)?.story_id
        const doneStory = doneStoryId && storiesRes.data ? storiesRes.data.find(s => s.id === doneStoryId) : null
        setJustDone(doneStory ? { title: doneStory.title_persian, icon: 'stories' } : null)
      }
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
    if (lastLesson) return { href: `/child/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, icon: (LESSON_TYPE_ICON[lastLesson.type] ?? 'lessons') as IconName, say: `بیا درس ${lastLesson.title} رو تمام کنیم!` }
    if (reviewWords.length >= 3) return { href: '/child/review', label: 'مرور کلمه‌ها', title: `${reviewWords.length} کلمه منتظرند`, icon: 'review' as IconName, say: 'بیا کلمه‌هایی که یاد گرفتی رو مرور کنیم!' }
    if (lastStory) return { href: `/child/story/${lastStory.id}`, label: 'ادامه‌ی قصه', title: lastStory.title_persian, icon: 'stories' as IconName, say: `بیا بقیه‌ی قصه‌ی ${lastStory.title_persian} رو بخونیم!` }
    const nl = lessons.find(l => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
    if (nl) return { href: `/child/lesson/${nl.id}`, label: 'درس تازه', title: nl.title, icon: (LESSON_TYPE_ICON[nl.type] ?? 'lessons') as IconName, say: `بیا درس ${nl.title} رو شروع کنیم!` }
    const ns = stories.find(s => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
    if (ns) return { href: `/child/story/${ns.id}`, label: 'قصه‌ی تازه', title: ns.title_persian, icon: 'stories' as IconName, say: `بیا قصه‌ی ${ns.title_persian} رو بخونیم!` }
    return { href: '/child/phonics', label: 'بازی صداها', title: 'زبر، زیر، پیش', icon: 'phonics' as IconName, say: 'بیا با صداها بازی کنیم!' }
  }, [lastLesson, lastStory, reviewWords, lessons, stories, strandLevels, doneLessons, doneStories])

  /* ── The step AFTER today ──────────────────────────────────
   * Shown locked, on purpose. A pre-reader has no model of what's coming, and
   * "there is a next thing, and it isn't open yet" is the single most reliable
   * reason to come back tomorrow. It is deliberately not tappable: an
   * affordance that refuses the tap teaches the child that tapping is
   * pointless. It reads as scenery, not as a broken door. */
  const comingUp = useMemo<PathAside | null>(() => {
    const nextLesson = lessons
      .filter(l => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
      .sort((a, b) => a.stage - b.stage)
      .find(l => `/child/lesson/${l.id}` !== nextUp.href)
    if (nextLesson) {
      return { title: nextLesson.title, icon: (LESSON_TYPE_ICON[nextLesson.type] ?? 'lessons') as IconName }
    }
    const nextStory = stories
      .filter(s => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
      .sort((a, b) => a.stage - b.stage)
      .find(s => `/child/story/${s.id}` !== nextUp.href)
    return nextStory ? { title: nextStory.title_persian, icon: 'stories' } : null
  }, [lessons, stories, strandLevels, doneLessons, doneStories, nextUp.href])

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-50 child-bg flex flex-col items-center justify-center p-6 gap-8">
        <h1 className="text-2xl font-bold text-gray-800 persian-text">کی می‌خواد بازی کنه؟</h1>
        <div className="grid grid-cols-2 gap-5 w-full max-w-md">
          {pickList.map(c => (
            <motion.button key={c.id} onClick={() => resolveChild(c)} whileTap={{ scale: 0.94 }}
              className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-3" aria-label={`بازی با ${c.name}`}>
              {/* EMOJI-CONTENT: avatar placeholder standing in for a child's own photo —
                  this is a portrait slot, not an affordance. Wants real art from
                  pixel-wizards-charachters, not a UI glyph. */}
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden text-4xl">
                {mediaUrl(c.avatar_url) ? <img src={mediaUrl(c.avatar_url)!} alt="" className="w-full h-full object-cover" /> : '🧒'}
              </div>
              <span className="font-bold text-gray-800">{c.name}</span>
            </motion.button>
          ))}
        </div>
        <button onClick={() => router.push('/parent/dashboard')}
          className="text-sm text-gray-500 hover:text-amber-700 transition-colors persian-text mt-2">
          → بازگشت به پنل والدین
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <AnimatePresence>
        {showTutorial && <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* ── Hero: greeting + mascot; stats only for older kids ── */}
      {/* from-amber-700/to-orange-700, not the lighter -400/-500 the hero used
          before the 2026-09 contrast audit: white greeting text + the child's
          own name render here, and the lighter pair measured ~1.7–2.8:1 —
          below WCAG AA even for large bold text. Matches --color-brand-from/to. */}
      <div className="relative bg-gradient-to-b from-amber-700 to-orange-700 pt-8 pb-24 px-5 rounded-b-[2.5rem]">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true" />
        <motion.span className="absolute top-6 left-16 text-xl select-none" aria-hidden="true"
          animate={{ y: [0, -6, 0], rotate: [0, 8, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}><Icon name="star" size="sm" className="text-white/90 fill-white/90" /></motion.span>
        <motion.span className="absolute bottom-16 right-24 text-lg select-none opacity-80" aria-hidden="true"
          animate={{ y: [0, -8, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}><Icon name="sky" size="md" className="text-white/70 fill-white/40" /></motion.span>
        <motion.span className="absolute top-14 right-1/3 text-sm select-none opacity-90" aria-hidden="true"
          animate={{ y: [0, -5, 0], rotate: [0, -10, 0] }} transition={{ duration: 3.0, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}><Icon name="sparkle" size="xs" className="text-white/80" /></motion.span>
        <div className="relative flex items-end justify-between">
          <div className="text-white">
            <p className="text-white text-sm mb-1">{greeting()}</p>
            <h1 className="text-3xl font-bold leading-tight">{child?.name ?? 'کودک عزیز'}</h1>
            {band === 3 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {stats.streak > 0 && <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5"><Icon name="streak" size="xs" />{stats.streak} روز</div>}
                {stats.words > 0 && <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5"><Icon name="star" size="xs" />{stats.words} کلمه</div>}
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5"><Icon name="level" size="xs" />{resolveLevel(stats.xp).label}</div>
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

        {/* ── The path ──────────────────────────────────────────
             Three rungs at most: what was finished, what to do NOW, what comes
             after. The middle one is the only thing on this screen with a
             filled button. */}
        <ol className="space-y-0" role="list" aria-label="مسیر امروز">
          {justDone && (
            <PathRung state="done" icon={justDone.icon} label="تمام شد" title={justDone.title} />
          )}

          <PathRung state="now" icon={nextUp.icon} label={nextUp.label} title={nextUp.title}
            href={nextUp.href} big={band === 1} hasNext={!!comingUp} />

          {comingUp && (
            <PathRung state="locked" icon={comingUp.icon} label="بعدی" title={comingUp.title} />
          )}
        </ol>

        {/* ── Re-placement's entry point (all bands): a skippable game card,
             same visual weight as any other activity, flavor-labeled — never
             "ارزیابی"/assessment wording (design doc §2). Doesn't render next
             visit until it's due again. ── */}
        {reprobeDue && (
          <Link href="/onboarding/placement?mode=reprobe" aria-label="بازی سیمرغ">
            <motion.div whileTap={{ scale: 0.98 }}
              className="bg-amber-50 rounded-2xl p-4 shadow-card flex items-center gap-3 ring-2 ring-amber-200/70">
              {/* EMOJI-CONTENT: Simorgh is the character the game is about. */}
              <span className="text-3xl" aria-hidden="true">🦅</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-sm">بازی سیمرغ</p>
                <p className="text-xs text-gray-500">سیمرغ دلش می‌خواد باهات بازی کنه!</p>
              </div>
              <span className="text-amber-400 text-xl">←</span>
            </motion.div>
          </Link>
        )}

        {/* ── Friends row: the characters (all bands) ── */}
        {friends.length > 0 && (
          <TileRow label="دوست‌های من" bigTiles={band === 1}>
            {friends.map(f => (
              <Link key={f.slug} href={`/child/friends/${f.slug}`} role="listitem"
                aria-label={`برو پیش ${f.name_persian}`} className="flex-shrink-0 snap-start">
                <motion.div whileTap={{ scale: 0.93 }}
                  className={`${band === 1 ? 'w-40' : 'w-32'} bg-white rounded-2xl shadow-card flex flex-col items-center gap-1 py-3`}>
                  <CharacterAvatar slug={f.slug} size={band === 1 ? 96 : 76} mood="idle" />
                  <p className="font-bold text-slate-800 text-sm">{f.name_persian}</p>
                  <p className="text-[10px] text-amber-600 font-medium">بیا پیشم!</p>
                </motion.div>
              </Link>
            ))}
          </TileRow>
        )}

        {/* ── Alphabet row: tap a letter, HEAR it (all bands) ── */}
        {letters.length > 0 && (
          <TileRow label="الفبا — ضربه بزن و بشنو" bigTiles={band === 1}>
            {letters.map(l => (
              <button key={l.id} role="listitem"
                onClick={() => { playTap(); speakOrPlay(l.audio_url, l.name_persian) }}
                aria-label={`بشنو: ${l.name_persian}`}
                className="flex-shrink-0 snap-start">
                <motion.div whileTap={{ scale: 0.88 }}
                  className={`${band === 1 ? 'w-24 h-28' : 'w-20 h-24'} bg-white rounded-2xl shadow-card flex flex-col items-center justify-center gap-1`}>
                  <span className={`${band === 1 ? 'text-5xl' : 'text-4xl'} font-bold text-sky-600 leading-none`}>{l.character}</span>
                  <span className="text-[11px] text-slate-400 persian-text">{l.name_persian}</span>
                </motion.div>
              </button>
            ))}
          </TileRow>
        )}

        {/* ── Review, when the queue is real (bands 2–3) ──
             Not a module tile: this one carries a COUNT, which is the only
             reason it earns a place on the path screen instead of living in
             the hub with everything else. */}
        {band >= 2 && reviewWords.length >= 3 && nextUp.href !== '/child/review' && (
          <Link href="/child/review" aria-label={`مرور ${reviewWords.length} کلمه`}>
            <motion.div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3" whileTap={{ scale: 0.98 }}>
              <span style={{ color: 'var(--ramp-review-ink)' }}><Icon name="review" size="lg" strokeWidth={2.2} /></span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-sm">مرور امروز</p>
                <p className="text-xs text-gray-500">{reviewWords.length} کلمه منتظر توست</p>
              </div>
              <Icon name="prev" size="md" className="text-amber-500" />
            </motion.div>
          </Link>
        )}

        {/* ── The door to everything else ──
             One door, not a grid. It is the last thing on the page on purpose:
             a child who knows what they want will reach for it, and a child who
             doesn't has already been given today's step at the top. */}
        <Link href="/child/rooms" aria-label="همه‌ی بخش‌ها">
          <motion.div
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className={`bg-white rounded-2xl shadow-card flex items-center gap-3 ${band === 1 ? 'p-5' : 'p-4'}`}
          >
            <span className="text-amber-700"><Icon name="seeAll" size={band === 1 ? 'xl' : 'lg'} strokeWidth={2.2} /></span>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-gray-800 ${band === 1 ? 'text-lg' : 'text-sm'}`}>همه‌ی بخش‌ها</p>
              <p className="text-xs text-gray-500">بازی‌ها، نوشتن، گفتن، اعداد…</p>
            </div>
            <Icon name="prev" size="md" className="text-amber-500" />
          </motion.div>
        </Link>
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
      <h2 className={`font-bold text-gray-800 mb-3 ${bigTiles ? 'text-lg' : 'text-base'}`}>{label}</h2>
      <div className="relative">
        {/* Full-bleed on mobile (-mx-4) so tiles swipe edge-to-edge instead of
            clipping at the page padding; pt-1/px-1 give the glow ring room. */}
        <div ref={scroller}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth"
          role="list" aria-label={label}>
          {children}
        </div>
        {/* Arrows render at EVERY width, not just sm+. They used to be
            `hidden sm:flex`, which left dragging as the only way to reach
            content past the fold on the phone a 3-year-old actually holds —
            WCAG 2.2 "Dragging Movements" (2.5.7) asks for a single-pointer
            alternative, and pre-readers don't infer that a clipped tile
            means "swipe me". On mobile they sit just inside the full-bleed
            scroller; from sm they float half off it so they never cover a
            tile. Each renders only while its direction has more content, so
            it can never point at nothing. */}
        {!ends.end && (
          <button onClick={() => nudge(true)} aria-label="بعدی"
            className="flex absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-gradient-to-b from-white to-slate-100 shadow-raised ring-1 ring-slate-200/80 items-center justify-center text-slate-500 hover:text-amber-600 hover:scale-110 active:scale-95 transition">
            <Icon name="next" size="md" strokeWidth={2.5} />
          </button>
        )}
        {!ends.start && (
          <button onClick={() => nudge(false)} aria-label="قبلی"
            className="flex absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-gradient-to-b from-white to-slate-100 shadow-raised ring-1 ring-slate-200/80 items-center justify-center text-slate-500 hover:text-amber-600 hover:scale-110 active:scale-95 transition">
            <Icon name="prev" size="md" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </section>
  )
}

/* ── A rung on the path ─────────────────────────────────────
 * Three states, one shape. Keeping the shape constant across states is the
 * point: the child sees the SAME object move from "next" to "now" to "done"
 * over successive visits, which is what makes it read as a path rather than
 * as three unrelated cards.
 *
 * Only `now` is a link. `done` is a record and `locked` is a promise; neither
 * accepts a tap, and neither pretends to — no ring, no button, no arrow. An
 * affordance that refuses the tap teaches a pre-reader that tapping does
 * nothing, which is the opposite of what this screen is for. */
function PathRung({ state, icon, label, title, href, big, hasNext }: {
  state: 'done' | 'now' | 'locked'
  icon: IconName
  label: string
  title: string
  href?: string
  big?: boolean
  hasNext?: boolean
}) {
  const now = state === 'now'
  const done = state === 'done'

  const card = (
    <div
      className={`flex-1 min-w-0 flex items-center gap-3 rounded-2xl ${
        now
          ? `bg-white shadow-raised ring-4 ring-yellow-300/70 ${big ? 'p-5' : 'p-4'}`
          : 'bg-white/60 p-3'
      }`}
    >
      <span className={`shrink-0 ${now ? 'text-amber-600' : 'text-gray-400'}`}>
        <Icon name={done ? 'doneCircle' : now ? icon : 'locked'} size={now && big ? 'hero' : now ? 'xl' : 'md'} strokeWidth={2.2} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`font-bold ${now ? 'text-amber-600 text-sm' : 'text-gray-400 text-xs'}`}>{label}</p>
        <p className={`font-bold truncate ${now ? (big ? 'text-2xl text-gray-800' : 'text-lg text-gray-800') : 'text-sm text-gray-500'}`}>
          {title}
        </p>
      </div>
      {now && (
        <ChunkyButton className={big ? 'text-xl px-6 py-4' : 'px-5 py-3'}>
          بازی کن!
        </ChunkyButton>
      )}
    </div>
  )

  return (
    <li className="flex items-stretch gap-3">
      {/* The rail. It runs from this rung's dot down to the next one, so the
          last rung's line is absent rather than dangling into nothing. */}
      <div className="w-4 shrink-0 flex flex-col items-center pt-5" aria-hidden="true">
        <span
          className={`w-3 h-3 rounded-full shrink-0 ${
            done ? 'bg-amber-500' : now ? 'bg-amber-500 ring-4 ring-amber-200' : 'bg-gray-300'
          }`}
        />
        {(done || (now && hasNext)) && <span className="w-0.5 flex-1 bg-amber-200 mt-1" />}
      </div>

      <div className="flex-1 min-w-0 pb-3">
        {now && href ? (
          <Link href={href} aria-label={`${label}: ${title}`} className="block">
            <motion.div
              whileTap={{ scale: 0.97 }}
              animate={{ scale: [1, 1.015, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex"
            >
              {card}
            </motion.div>
          </Link>
        ) : (
          <div className="flex" aria-disabled={state === 'locked' ? true : undefined}>{card}</div>
        )}
      </div>
    </li>
  )
}
