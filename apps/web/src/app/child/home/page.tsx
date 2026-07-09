'use client'
import { useEffect, useMemo, useState } from 'react'
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
import { speakPersian } from '@/lib/speech'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import Tutorial, { hasSeenTutorial } from '@/components/child/Tutorial'
import { ACTIVITY_GRADIENTS, LESSON_TYPE_EMOJI, resolveLevel, isLessonUnlocked, isStoryUnlocked, ALL_UNLOCKED } from '@koodakbook/shared'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem, StrandLevels } from '@koodakbook/shared'

/* Child home, redesigned for its real audience.
 *
 * Principles (design/motion/content plan §1):
 *  - ONE giant "play" button that routes to the smartest next activity — a
 *    4-year-old should never have to decide, only tap the glowing thing.
 *  - Windowed carousels instead of truncated lists: continue + the next ~10
 *    relevant items, then a 🎲 random tile and a 🚪 door to the full page.
 *    Bounded UI at ANY catalog size (100+ stories still shows ~13 tiles).
 *  - Age bands: 3–5 see hero + stories + two giant tiles; 6–7 add lessons and
 *    the practice grid; 8–10 get the dense layout with stats and review. */

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

interface NextUp { href: string; label: string; title: string; emoji: string; say: string }

export default function ChildHomePage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
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

  useChildSession(child?.id ?? null)
  useEffect(() => { if (!hasSeenTutorial()) setShowTutorial(true) }, [])

  async function loadForChild(c: Child) {
    setChild(c)
    const [lessonsRes, storiesRes, dashRes, reviewRes, progressRes, placeRes] = await Promise.all([
      api.get<Lesson[]>('/api/lessons'),
      api.get<Story[]>('/api/stories'),
      api.get<DashboardSummary>(`/api/dashboard/${c.id}`),
      api.get<ReviewItem[]>(`/api/progress/${c.id}/review`),
      api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${c.id}`),
      api.get<{ strand_levels: StrandLevels }>(`/api/placement/${c.id}`),
    ])
    if (dashRes.data) setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
    if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
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
        <h1 className="text-2xl font-bold text-gray-800 persian-text">کی می‌خواد بازی کنه؟ 🎮</h1>
        <div className="grid grid-cols-2 gap-5 w-full max-w-md">
          {pickList.map(c => (
            <motion.button key={c.id} onClick={() => resolveChild(c)} whileTap={{ scale: 0.94 }}
              className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center gap-3" aria-label={`بازی با ${c.name}`}>
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
      <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 pt-8 pb-14 px-5 rounded-b-[3rem] overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="absolute top-4 -left-6 w-20 h-20 bg-white/10 rounded-full" aria-hidden="true" />
        <div className="relative flex items-end justify-between">
          <div className="text-white">
            <p className="text-white text-sm mb-1">{greeting()} 👋</p>
            <h1 className="text-3xl font-bold leading-tight">{child?.name ?? 'کودک عزیز'}</h1>
            {band === 3 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {stats.streak > 0 && <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium">🔥 {stats.streak} روز</div>}
                {stats.words > 0 && <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium">⭐ {stats.words} کلمه</div>}
                <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-medium">🎓 {resolveLevel(stats.xp).label}</div>
              </div>
            )}
            {band !== 3 && stats.streak > 0 && (
              <div className="inline-block bg-white/20 rounded-full px-3 py-1 text-sm font-medium mt-2">🔥 {stats.streak} روز</div>
            )}
          </div>
          <button onClick={() => speakPersian(nextUp.say)} aria-label="مَسکات — بگو چی کار کنیم">
            <Mascot size={band === 1 ? 120 : 100} mood={stats.streak > 0 ? 'happy' : 'idle'} className="-mb-5" />
          </button>
        </div>
      </div>

      <div className={`px-4 pt-5 space-y-7 ${band === 3 ? 'lg:px-8 lg:max-w-5xl lg:mx-auto' : 'max-w-2xl mx-auto'}`}>

        {/* ── THE button: the app already decided what's next ── */}
        <Link href={nextUp.href} aria-label={`${nextUp.label}: ${nextUp.title}`}>
          <motion.div
            whileTap={{ scale: 0.97 }}
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className={`bg-white rounded-[1.75rem] shadow-lg ring-4 ring-yellow-300/70 flex items-center gap-4 ${band === 1 ? 'p-6' : 'p-5'}`}
          >
            <span className={`${band === 1 ? 'text-6xl' : 'text-5xl'} shrink-0`} aria-hidden="true">{nextUp.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-600 font-bold text-sm">{nextUp.label}</p>
              <p className={`font-bold text-gray-800 truncate ${band === 1 ? 'text-2xl' : 'text-lg'}`}>{nextUp.title}</p>
            </div>
            <span className={`bg-brand-gradient text-white font-bold rounded-2xl shadow-md shrink-0 ${band === 1 ? 'text-xl px-6 py-4' : 'px-5 py-3'}`}>
              بازی کن! 🎈
            </span>
          </motion.div>
        </Link>

        {/* ── Stories row (all bands — stories are the heart) ── */}
        <TileRow label="قصه‌ها 📖" bigTiles={band === 1}>
          {storyRow.window.map((s, idx) => (
            <CardTile key={s.id} href={`/child/story/${s.id}`} title={s.title_persian}
              image={mediaUrl(s.cover_url)} emoji="📖" grad={ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]}
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

        {/* ── Lessons row (bands 2–3) ── */}
        {band >= 2 && (
          <TileRow label="درس‌ها 📚">
            {lessonRow.window.map((l, idx) => (
              <CardTile key={l.id} href={`/child/lesson/${l.id}`} title={l.title}
                emoji={LESSON_TYPE_EMOJI[l.type] ?? '📖'} grad={ACTIVITY_GRADIENTS[idx % ACTIVITY_GRADIENTS.length]}
                sub={`مرحله ${l.stage}`} glow={idx === 0} />
            ))}
            {lessonRow.locked.map(l => <LockedTile key={l.id} title={l.title} />)}
            {lessonRow.pool.length > 1 && <ActionTile emoji="🎲" title="شانسی!" onClick={() => surprise('lesson')} />}
            {lessonRow.doneCount > 0 && <ActionTile emoji="⭐" title={`انجام‌شده (${lessonRow.doneCount})`} href="/child/lesson" />}
            <ActionTile emoji="🚪" title="همه‌ی درس‌ها" href="/child/lesson" />
          </TileRow>
        )}

        {/* ── Review strip (band 3: older kids like seeing the queue) ── */}
        {band === 3 && reviewWords.length > 0 && (
          <Link href="/child/review" aria-label={`مرور ${reviewWords.length} کلمه`}>
            <motion.div className="bg-white rounded-lg p-4 shadow-sm flex items-center gap-3" whileTap={{ scale: 0.98 }}>
              <span className="text-3xl" aria-hidden="true">🔄</span>
              <div className="flex-1">
                <p className="font-bold text-gray-800 text-sm">مرور امروز</p>
                <p className="text-xs text-gray-500">{reviewWords.length} کلمه منتظر توست</p>
              </div>
              <span className="text-amber-400 text-xl">←</span>
            </motion.div>
          </Link>
        )}

        {/* ── Practice ── */}
        {band === 1 ? (
          /* Two giant, loud choices — that's the whole menu at this age */
          <div className="grid grid-cols-2 gap-4">
            <Link href="/child/phonics" aria-label="بازی صداها">
              <motion.div whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-[1.5rem] p-5 shadow-md text-white flex flex-col items-center gap-2 min-h-[120px] justify-center">
                <span className="text-5xl" aria-hidden="true">🎵</span>
                <p className="font-bold text-lg">صداها</p>
              </motion.div>
            </Link>
            <Link href="/child/math/counting" aria-label="بازی شمارش">
              <motion.div whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-br from-emerald-400 to-green-500 rounded-[1.5rem] p-5 shadow-md text-white flex flex-col items-center gap-2 min-h-[120px] justify-center">
                <span className="text-5xl" aria-hidden="true">🍎</span>
                <p className="font-bold text-lg">بشمار!</p>
              </motion.div>
            </Link>
          </div>
        ) : (
          <section>
            <h2 className="font-bold text-gray-800 text-base mb-3">تمرین کن 🌟</h2>
            <div className={`grid grid-cols-2 gap-3 ${band === 3 ? 'lg:grid-cols-3' : ''}`}>
              <PracticeTile href="/child/phonics" emoji="🎵" title="صداها" sub="زبر، زیر، پیش" grad="from-orange-500 to-amber-600" />
              <PracticeTile href="/child/write" emoji="✏️" title="نوشتن" sub="حرف‌ها را بنویس" grad="from-blue-400 to-cyan-500" />
              <PracticeTile href="/child/speak" emoji="🎤" title="گفتن" sub="کلمه‌ها را بگو" grad="from-rose-400 to-pink-500" />
              <PracticeTile href="/child/math" emoji="🔢" title="دنیای اعداد" sub="ریاضی به فارسی" grad="from-indigo-400 to-violet-500" />
              <PracticeTile href="/child/games/memory" emoji="🃏" title="بازی حافظه" sub="جفت‌ها را پیدا کن" grad="from-violet-400 to-purple-500" />
              <PracticeTile href="/child/rewards" emoji="🏆" title="جوایز من" sub="مدال‌هایم" light />
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

/* ── Building blocks ─────────────────────────────────────── */

function TileRow({ label, bigTiles, children }: { label: string; bigTiles?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`font-bold text-gray-800 mb-3 ${bigTiles ? 'text-lg' : 'text-base'}`}>{label}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x" role="list" aria-label={label}>
        {children}
      </div>
    </section>
  )
}

function CardTile({ href, title, sub, badge, emoji, image, grad, glow, big }: {
  href: string; title: string; sub?: string; badge?: string
  emoji: string; image?: string | null; grad: string; glow?: boolean; big?: boolean
}) {
  const w = big ? 'w-44' : 'w-36'
  const h = big ? 'h-32' : 'h-24'
  return (
    <Link href={href} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>
      <motion.div
        className={`${w} bg-white rounded-lg overflow-hidden shadow-md relative ${glow ? 'ring-4 ring-yellow-300/80' : ''}`}
        whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {badge && <span className="absolute top-2 right-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>}
        {image ? (
          <img src={image} alt="" className={`w-full ${h} object-cover`} />
        ) : (
          <div className={`w-full ${h} bg-gradient-to-br ${grad} flex items-center justify-center ${big ? 'text-6xl' : 'text-5xl'}`} aria-hidden="true">{emoji}</div>
        )}
        <div className="p-3">
          <p className={`font-bold text-gray-800 leading-tight ${big ? 'text-base' : 'text-sm'}`}>{title}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </motion.div>
    </Link>
  )
}

/** Friendly lock: sleeping tile, not a barrier. */
function LockedTile({ title, big }: { title: string; big?: boolean }) {
  return (
    <div role="listitem" className="flex-shrink-0" aria-label={`${title} — هنوز خوابه`}>
      <div className={`${big ? 'w-44' : 'w-36'} bg-white/60 rounded-lg overflow-hidden shadow-sm select-none`}>
        <div className={`w-full ${big ? 'h-32' : 'h-24'} bg-gray-100 flex items-center justify-center ${big ? 'text-5xl' : 'text-4xl'}`} aria-hidden="true">😴</div>
        <div className="p-3">
          <p className="font-bold text-gray-400 text-sm leading-tight">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">هنوز خوابه — بعداً بیدار می‌شه!</p>
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
      className={`${big ? 'w-32 h-[188px]' : 'w-28 h-[156px]'} bg-amber-50 border-2 border-dashed border-amber-200 rounded-lg flex flex-col items-center justify-center gap-2`}>
      <span className={big ? 'text-5xl' : 'text-4xl'} aria-hidden="true">{emoji}</span>
      <p className="font-bold text-amber-700 text-xs text-center px-2 leading-snug">{title}</p>
    </motion.div>
  )
  if (href) return <Link href={href} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>{inner}</Link>
  return <button onClick={onClick} role="listitem" className="flex-shrink-0 snap-start" aria-label={title}>{inner}</button>
}

function PracticeTile({ href, emoji, title, sub, grad, light }: {
  href: string; emoji: string; title: string; sub: string; grad?: string; light?: boolean
}) {
  return (
    <Link href={href} aria-label={`${title}: ${sub}`}>
      <motion.div whileTap={{ scale: 0.96 }}
        className={`rounded-lg p-4 shadow-sm flex items-center gap-3 min-h-[72px] ${
          light ? 'bg-white' : `bg-gradient-to-br ${grad} text-white`}`}>
        <span className="text-3xl" aria-hidden="true">{emoji}</span>
        <div>
          <p className={`font-bold text-sm ${light ? 'text-gray-800' : ''}`}>{title}</p>
          <p className={`text-xs ${light ? 'text-gray-500' : 'opacity-80'}`}>{sub}</p>
        </div>
      </motion.div>
    </Link>
  )
}
