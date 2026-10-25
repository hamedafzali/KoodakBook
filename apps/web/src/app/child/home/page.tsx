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
import { childAge, toPersianDigits } from '@/lib/persianMath'
import { speakPersian, speakOrPlay } from '@/lib/speech'
import { playTap } from '@/lib/sounds'
import Mascot from '@/components/child/Mascot'
import BottomNav from '@/components/child/BottomNav'
import Tutorial, { hasSeenTutorial } from '@/components/child/Tutorial'
import { LESSON_TYPE_EMOJI, isLessonUnlocked, isStoryUnlocked, ALL_UNLOCKED } from '@koodakbook/shared'
import { MODULE, ModuleCard, Icon, type ModuleKey } from '@/components/child/kit'
import { ClayButton } from '@/components/child/clay'
import CharacterAvatar from '@/components/child/CharacterAvatar'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import StoryCover from '@/components/child/StoryCover'
import ParentDoorNav from '@/components/child/ParentDoorNav'
import type { Lesson, Story, Child, DashboardSummary, ReviewItem, StrandLevels, Letter, AppCharacter, ChildSession } from '@koodakbook/shared'

/* Child home — redesigned against the 2026-09-21 mockup (WebHome.dc.html): a
 * header identity strip, an illustrated "continue" journey card, three real
 * stat tiles, and the friends/module grid restyled as chunky character-hosted
 * room cards. Every data hook below (child/lessons/stories/letters/friends/
 * stats/reviewWords/strandLevels/doneLessons/doneStories/lastLesson/
 * lastStory/tutorial/reprobeDue/pickList) is unchanged from the previous
 * build — this is a visual pass, not a feature cut, with ONE genuinely new
 * read (`recentSessions`, already returned by `/api/dashboard/:id` and
 * already consumed the same way by apps/web/src/app/parent/dashboard/
 * page.tsx — no new endpoint). This also supersedes the OLD home's own
 * doc comment above (now this one): the old design's "every room lives on
 * home, windowed carousels + RoomSections inline" philosophy is replaced by
 * this mockup's "one continue card + a hub-level grid" philosophy, exactly
 * as apps/mobile/app/home.tsx already did for the same mockup family. Rooms
 * not represented as a hub tile here (math's sub-games, the individual
 * story catalogue, …) are still one tap away through the hub they belong to
 * (/child/math already lists its sub-games; /child/rooms — linked from the
 * grid header below — still renders every room in full for whoever wants
 * that view) or through BottomNav/ChildRail's own persistent tabs (home,
 * درس‌ها, داستان, جوایز already reach lessons/stories/rewards from anywhere).
 *
 * Deliberate honesty calls, documented so a future editor doesn't "fix" them
 * back toward the mockup's literal numbers/elements:
 *
 *  - Header: the mockup's own 48×48 parent-lock button is DROPPED. This
 *    route is wrapped by apps/web/src/app/child/layout.tsx, whose ChildRail
 *    (desktop, lg+) and BottomNav (mobile) BOTH already carry
 *    ParentDoorNav — a discoverable, ~0.7s-hold, PIN-gated door — on every
 *    child screen including this one. Adding a second, ungated tap-target
 *    for the same destination would be a duplicate gate and, being a plain
 *    tap instead of a hold, an actual regression from the app's existing
 *    child-safety pattern (rule 5 in the port brief). Same call
 *    apps/mobile/app/home.tsx already made for BottomNav's hold door.
 *  - Header/stat-row streak: shown only when `band === 3` (ages 8+), exactly
 *    the pre-existing gate this file already had (now on the streak PILL
 *    and the streak STAT TILE specifically, not the whole stat row) — a
 *    documented product-ethics call already in this codebase (a broken-
 *    streak number is a punishment shape a 3–7 year-old has no control
 *    over), not something this port should silently undo to match the
 *    mockup's unconditional streak chip. Mirrors apps/mobile/app/home.tsx's
 *    `childAge(child) > 7` gate on its own streak pill. The goal-ring and
 *    words-learned tiles carry no such risk (they only ever go up, never
 *    read as "you broke it") and are shown for every band, matching
 *    mobile's goal-ring, which is likewise unconditional.
 *  - Header star/xp pill: the mockup's fixed "۴۲" is real `stats.xp`
 *    (dashRes.data.xp, already loaded) — an explicit call in the port
 *    brief, not a guess: the pre-redesign header used a ⭐ beside
 *    `stats.words` instead, but that was one screen's earlier choice, not a
 *    binding contract on what a star means app-wide.
 *  - Header avatar-initial circle: real `child.name`'s first character
 *    (mobile precedent: `avatarInitial: child.name?.[0]`), not a
 *    placeholder letter. It renders as a static identity mark (no tap
 *    handler) — the mockup's tap affordance there would most naturally mean
 *    "switch child", but the only child-switcher this app has is the
 *    full-screen `showPicker` modal populated once at session start from
 *    `consumeChildPick()`, not a general "reopen switcher" action available
 *    at will from an arbitrary later tap; inventing that reopening behaviour
 *    would be a new feature, not a re-skin (rule 4).
 *  - Continue card eyebrow + title: generalized from the mockup's fixed
 *    "قصه‌ی امروز" to this file's OWN pre-existing `nextUp.label`/`.title`
 *    (unchanged decision logic — lesson → review → story → new lesson → new
 *    story → phonics, in that order) — the mockup's literal copy only ever
 *    covered the "today's story" case, which isn't always what `nextUp`
 *    actually is.
 *  - Continue card "X از Y بخش" + progress bar: the mockup implies a
 *    multi-section structure within one story/lesson that
 *    `packages/shared/src/types.ts`'s `Story`/`Lesson` do not model (no
 *    sub-section list on either). Mirroring apps/mobile/app/home.tsx's own
 *    `nextUpProgress`, this shows a REAL "X از Y" (and a real % bar, an
 *    upgrade over mobile's plain text now that a true ratio is available)
 *    only when `lastLesson`/`lastStory` has an actual peer set at the same
 *    `stage` — otherwise the whole row is omitted, never faked.
 *  - Continue card road/lock/checkmark section markers: DROPPED entirely —
 *    same reasoning as the point above, and the same call mobile already
 *    made. Replaced with the single real CTA the app already computes
 *    (`nextUp.href`), styled in the mockup's "بزن بریم!" language.
 *  - Continue card's big character: the mockup fixes it to پشمک (stories'
 *    host). This port instead swaps it to `nextUp`'s own module host —
 *    روزی for a lesson, لاکی for review, پشمک for a story, no character for
 *    a phonics fallback — mirroring apps/mobile/app/home.tsx's
 *    `NEXTUP_STYLE` swap (the brief's own suggestion): the card is titled
 *    by whatever `nextUp` actually is, so the character standing in it
 *    should match, not always claim "this is a story" when it might be a
 *    lesson. چرخی (see kit.tsx's own comment on `MODULE`) stays FIXED at
 *    its own spot regardless of `nextUp` — it's cast as the road/journey
 *    mascot for this screen specifically, not a per-module host.
 *  - Continue scene illustration: the sky/dot-pattern/sun/bird/terrain/tree/
 *    sparkle/road art is ported as one inline SVG (verbatim mockup tokens,
 *    same technique as apps/mobile/app/home.tsx's `CONTINUE_SCENE_SVG`,
 *    itself following LaunchScreen's precedent of reusing mockup-sourced art
 *    rather than redrawing) and stretched with `preserveAspectRatio="xMidYMid
 *    slice"` to this card's wider aspect rather than hand-authored at the
 *    mockup's literal 1344×460 — the same crop-to-fit technique the SVG
 *    already uses on mobile's differently-shaped card.
 *  - Stat row, column 3 ("این هفته" / "۴۲ ستاره"): `ChildSession` (see
 *    types.ts) carries `duration_sec` only — no per-session xp/stars field
 *    exists, so a real WEEKLY stars figure cannot be computed at all (not
 *    even from the `recent_sessions` this page now also reads, which is
 *    capped server-side besides). Rather than drop the tile outright, it is
 *    relabelled to the SAME real total the pre-redesign header already
 *    showed beside a ⭐ — `stats.words` (`words_learned`) — reframed
 *    honestly as a lifetime count ("کلمه‌های یادگرفته") instead of a false
 *    weekly claim.
 *  - Stat row, column 1 ("هدف امروز" ring, "۱۲ از ۲۰ دقیقه"): real
 *    `todayMin` computed from `recentSessions` with the exact filter/sum
 *    apps/web/src/app/parent/dashboard/page.tsx's `todayMin` already uses on
 *    its heatmap, against the family's real saved setting
 *    (`localStorage['koodakbook_daily_goal_min']`, same key + same
 *    `parseInt(…, 10) || 10` fallback as that same dashboard file — mirrors
 *    mobile's `getDailyGoal()`, web's own equivalent already exists here,
 *    it just wasn't read from this particular page before).
 *  - Module grid badges ("۲۴ درس"/"۳۲ حرف"/"۱۸ تمرین"/"۱۵ تمرین"/"۱۰
 *    تمرین"/"۲۸ بازی"/"۲۲ بازی"/"۹ نشان"): lessons and letters get a REAL
 *    count appended to their subtitle — `lessons.length`/`letters.length`,
 *    both already loaded by this exact page for other purposes. The other
 *    six (phonics/speak/write/math/games/rewards) have no exercise/game/
 *    badge COUNT loaded anywhere on this page, and fetching one solely to
 *    backfill a cosmetic mockup number would be new scope this port
 *    shouldn't take on — dropped, per the same "no already-loaded source →
 *    omit" rule mobile's port already applied to every one of its own
 *    badges (mobile dropped all of them, including lessons/letters, where
 *    this port instead found a real source already on-page and used it).
 *  - Review card's "امروز" corner pill: NOT wired to `reprobeDue` (the
 *    port brief's own suggestion) — `reprobeDue` gates a different, real
 *    feature (the placement re-probe game, kept below as its own
 *    conditional grid tile, unchanged), and using it to badge the REVIEW
 *    card would mislabel it with an unrelated signal. The pill instead uses
 *    the condition that's actually true of the review queue itself:
 *    `reviewWords.length > 0` — the exact real signal this file already
 *    uses to decide whether review even has content to show.
 *  - Module grid: "letters" has no dedicated route (`rooms.tsx`'s own room
 *    table has none either — alphabet browsing has only ever lived inline on
 *    this page). Rather than invent a `/child/letters` route (out of scope,
 *    rule 4), its card links to `#alphabet`, a same-page anchor to the
 *    tap-to-hear alphabet strip kept further down (unchanged from the
 *    pre-redesign page). "games" likewise has no `/child/games` hub
 *    (`apps/web/src/app/child/games/` has no `page.tsx`, only `memory/`,
 *    `marpele/` and `marpele-online/`) — its card links to `/child/games/memory`, the first real
 *    destination, rather than a hub page that doesn't exist.
 *  - Friends carousel and the alphabet tap-to-hear strip: neither appears in
 *    the mockup's home screen, but both are real, working, already-built
 *    features this page is their only reachable entry point for (rooms.tsx
 *    also has a friends section, but only on the /child/rooms deep link,
 *    which this page no longer inlines — see above). The mockup being
 *    silent about them isn't a mandate to remove working functionality
 *    (rule 4 cuts the other way: don't shrink scope beyond what the mockup
 *    asks), so both are kept, positioned below the module grid.
 */

/* 2026-09-28 visual-fidelity pass (against the approved reference; mobile
 * Home parity). Supersedes the notes above where they disagree:
 *  - Hero: a warm illustrated world with سیمرغ and a visible greeting by
 *    name (now the page's h1). The continue card no longer carries its own
 *    road scene — it overlaps the hero as ONE deep indigo card (.card-indigo):
 *    host art thumb, label, title, the same real "X از Y" (bar + figure, only
 *    when a peer set exists — else «بزن بریم!»), a round go-arrow.
 *  - Learning path (new): phonics, letters (#alphabet), lessons, stories —
 *    a plain list of rooms, deliberately UNNUMBERED with no order arrows
 *    (the teaching order isn't approved; mobile Home matches). Counts are the
 *    already-loaded lessons/stories/letters and the doneLessons/doneStories
 *    sets — no new read. Phonics has no host (MODULE) and no count on this
 *    page, so it shows a headphones mark and its tagline.
 *  - Featured stories (new): unlocked stories only, the in-progress one
 *    first («نیمه‌کاره», real lastStory), then unread, then read («خوندم»,
 *    real doneStories). Covers are the shelf's own StoryCover. No "new" or
 *    duration badge: nothing loaded here says either.
 *  - The three stat tiles fold into ONE reward card: today's real minutes vs
 *    the family's real goal (the same todayMin/goalMin), the xp star total
 *    and words learned — linking to /child/rewards. Streak stays a header
 *    pill, still band-3 only.
 *  - Quiet parent card (new): its only control is ParentDoorNav's `card`
 *    variant — the SAME hold + PIN door as the nav, so the "no second,
 *    ungated tap-target" call above still holds.
 *  - «دوستات منتظرتن» keeps every room the path doesn't (review, speak,
 *    write, math, games, rewards + the conditional re-probe tile), as
 *    regular-size clay tiles below the fold.
 *  - Wide screens: path + stories take two thirds, reward + parent sit in a
 *    side column; everything below is full width. */

type NextUpKind = 'lesson' | 'review' | 'story' | 'phonics'
interface NextUp { href: string; label: string; title: string; emoji: string; say: string; kind: NextUpKind }

/** The continue-card's colour + big character by what nextUp actually is —
 *  ported from apps/mobile/app/home.tsx's NEXTUP_STYLE, keyed the same way. */
const NEXTUP_MODULE: Record<NextUpKind, ModuleKey> = {
  lesson: 'lessons', review: 'review', story: 'stories', phonics: 'phonics',
}

interface GridItem { module: ModuleKey; title: string; sub: string; href: string; badge?: string }

/* The hero's world (2026-09-28 visual-fidelity pass, against the approved
 * reference): a morning sky, a sun, clouds, far mountains and the same
 * rolling teal hills the old continue-card scene used (same hex, so the
 * palette didn't move), ending in the page's own cream so the hero melts
 * into the page. Built in layers rather than one cropped picture: the sky is
 * a CSS gradient, the land is a strip stretched to any width, and sun,
 * clouds and trees are small fixed-size pieces — so a 1120px desktop hero
 * and a 320px phone hero both look drawn for their width (one `slice`-cropped
 * SVG showed a desktop only giant trees and hills). Decorative. */
function HeroScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true"
      style={{ background: 'linear-gradient(180deg, #CFEAFB 0%, #E3F3F4 55%, #FFF8EA 100%)' }}>
      <svg viewBox="0 0 60 60" className="absolute top-12 start-[42%] w-16 h-16 lg:start-[48%]">
        <circle cx="30" cy="30" r="28" fill="#FBBF24" opacity=".16" /><circle cx="30" cy="30" r="18" fill="#FCD34D" />
      </svg>
      <svg viewBox="0 0 80 34" className="absolute top-24 end-[34%] w-20 lg:end-[40%]">
        <g fill="#FFFFFF" opacity=".92"><rect x="4" y="16" width="70" height="16" rx="8" /><circle cx="22" cy="16" r="12" /><circle cx="42" cy="11" r="11" /><circle cx="58" cy="18" r="9" /></g>
      </svg>
      <svg viewBox="0 0 80 34" className="absolute top-5 start-[18%] w-14 max-sm:hidden">
        <g fill="#FFFFFF" opacity=".85"><rect x="4" y="16" width="70" height="16" rx="8" /><circle cx="22" cy="16" r="12" /><circle cx="42" cy="11" r="11" /><circle cx="58" cy="18" r="9" /></g>
      </svg>
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-[46%]">
        <path d="M0 46 L54 10 L96 32 L150 -4 L214 40 L272 6 L334 36 L400 8 L400 120 L0 120 Z" fill="#BCD7F0" opacity=".7" />
        <path d="M0 52 q80 -30 170 -8 q90 24 160 -8 q40 -16 70 -4 L400 120 L0 120 Z" fill="#CFEDE2" />
        <path d="M0 74 q96 -30 200 -6 q100 22 200 -8 L400 120 L0 120 Z" fill="#8FE2CC" />
        <path d="M0 94 q110 -22 214 -4 q84 14 186 -8 L400 120 L0 120 Z" fill="#57D6BC" opacity=".55" />
        <path d="M0 108 q120 -14 230 -2 q90 8 170 -6 L400 120 L0 120 Z" fill="#FFF8EA" />
      </svg>
      <svg viewBox="0 0 40 60" className="absolute bottom-[15%] start-1 w-9 lg:start-[34%] lg:w-12">
        <rect x="16" y="30" width="8" height="28" rx="4" fill="#8A5A24" /><circle cx="20" cy="22" r="17" fill="#127A55" /><circle cx="9" cy="30" r="10.5" fill="#0E6244" /><circle cx="30" cy="29" r="9.5" fill="#159C69" /><circle cx="14" cy="14" r="7.5" fill="#35C08C" opacity=".55" />
      </svg>
      <svg viewBox="0 0 40 60" className="absolute bottom-[20%] end-[40%] w-7 lg:w-9 max-[379px]:hidden">
        <rect x="16" y="30" width="8" height="28" rx="4" fill="#8A5A24" /><circle cx="20" cy="22" r="17" fill="#127A55" /><circle cx="9" cy="30" r="10.5" fill="#0E6244" /><circle cx="30" cy="29" r="9.5" fill="#159C69" />
      </svg>
    </div>
  )
}

type PathItem = { module: ModuleKey; title: string; sub: string; href: string; pct?: number }

export default function ChildHomePage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [letters, setLetters] = useState<Letter[]>([])
  const [friends, setFriends] = useState<AppCharacter[]>([])
  const [stats, setStats] = useState({ words: 0, streak: 0, xp: 0 })
  const [recentSessions, setRecentSessions] = useState<ChildSession[]>([])
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
  // A failed /api/children used to read as "this family has no children"
  // and bounce the child to the parent dashboard. Same fix as mobile Home:
  // an error screen with a retry.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  // A secondary read failing (lessons, stories, dashboard, progress) used to
  // render the page as if it were empty -- the phonics fallback card, zero
  // stats -- with nothing saying so. Now one honest note with a retry (web's
  // counterpart of mobile Home's per-list NoteCards; web Home has no lesson/
  // story lists of its own, so one note covers the page).
  const [partialError, setPartialError] = useState(false)
  const [reloading, setReloading] = useState(false)

  useChildSession(child?.id ?? null)
  useEffect(() => { if (!hasSeenTutorial()) setShowTutorial(true) }, [])
  useEffect(() => { api.get<AppCharacter[]>('/api/characters').then(r => { if (r.data) setFriends(r.data) }) }, [])

  async function loadForChild(c: Child) {
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
    // `child` is set here, with everything else, not before the fetch (same
    // fix as the mobile Home, 2026-09-25): setting it first let the full page
    // render with empty data -- the fallback next-up card, no path, no
    // stories, no streak -- and swap to the real data a moment later. Until
    // `child` is set the loading screen below stays up; all of these updates
    // land in one render.
    setChild(c)
    setPartialError(!lessonsRes.data || !storiesRes.data || !dashRes.data || !progressRes.data)
    if (dashRes.data) {
      setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
      // Real minutes-today for the stat row's goal ring — same field the
      // parent dashboard's heatmap already reads off this same response.
      setRecentSessions(dashRes.data.recent_sessions ?? [])
    }
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
      if (!childRes.data) { setLoadError(childRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); return }
      const list = childRes.data
      if (list.length === 0) { router.replace('/parent/dashboard'); return }
      if (consumeChildPick() && list.length > 1) { setPickList(list); setShowPicker(true); return }
      const c = pickChild(list)
      if (c) resolveChild(c)
    }
    start()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, attempt])

  const band = child ? (childAge(child) <= 5 ? 1 : childAge(child) <= 7 ? 2 : 3) : 2
  // Streak display gate — see the file doc comment's product-ethics note.
  const showStreak = band === 3 && stats.streak > 0

  // ── The one decision the app makes FOR the child (unchanged logic; `kind`
  //    is a new UI-only tag on the same result, for module-themed styling) ──
  const nextUp = useMemo<NextUp>(() => {
    if (lastLesson) return { href: `/child/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, emoji: LESSON_TYPE_EMOJI[lastLesson.type] ?? '📚', say: `بیا درس ${lastLesson.title} رو تمام کنیم!`, kind: 'lesson' }
    if (reviewWords.length >= 3) return { href: '/child/review', label: 'مرور کلمه‌ها', title: `${toPersianDigits(reviewWords.length)} کلمه منتظرند`, emoji: '🔄', say: 'بیا کلمه‌هایی که یاد گرفتی رو مرور کنیم!', kind: 'review' }
    if (lastStory) return { href: `/child/story/${lastStory.id}`, label: 'ادامه‌ی قصه', title: lastStory.title_persian, emoji: '📖', say: `بیا بقیه‌ی قصه‌ی ${lastStory.title_persian} رو بخونیم!`, kind: 'story' }
    const nl = lessons.find(l => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
    if (nl) return { href: `/child/lesson/${nl.id}`, label: 'درس تازه', title: nl.title, emoji: LESSON_TYPE_EMOJI[nl.type] ?? '📚', say: `بیا درس ${nl.title} رو شروع کنیم!`, kind: 'lesson' }
    const ns = stories.find(s => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
    if (ns) return { href: `/child/story/${ns.id}`, label: 'قصه‌ی تازه', title: ns.title_persian, emoji: '📖', say: `بیا قصه‌ی ${ns.title_persian} رو بخونیم!`, kind: 'story' }
    return { href: '/child/phonics', label: 'بازی صداها', title: 'زبر، زیر، پیش', emoji: '🎵', say: 'بیا با صداها بازی کنیم!', kind: 'phonics' }
  }, [lastLesson, lastStory, reviewWords, lessons, stories, strandLevels, doneLessons, doneStories])

  const nextUpModule = NEXTUP_MODULE[nextUp.kind]

  // Real "X از Y": the child's position among peers at the same stage, only
  // when there IS a meaningful peer set — mirrors apps/mobile/app/home.tsx's
  // `nextUpProgress` (see the file doc comment for why this replaces the
  // mockup's fixed "۱ از ۵" + road markers).
  const nextUpProgress = useMemo(() => {
    if (lastLesson) {
      const peers = lessons.filter(l => l.stage === lastLesson.stage)
      const idx = peers.findIndex(l => l.id === lastLesson.id)
      if (idx >= 0 && peers.length > 1) return { idx, total: peers.length }
    }
    if (lastStory) {
      const peers = stories.filter(s => s.stage === lastStory.stage)
      const idx = peers.findIndex(s => s.id === lastStory.id)
      if (idx >= 0 && peers.length > 1) return { idx, total: peers.length }
    }
    return null
  }, [lastLesson, lastStory, lessons, stories])

  // Minutes played today — same filter/sum apps/web/src/app/parent/
  // dashboard/page.tsx's heatmap already uses on `recent_sessions`.
  const todayMin = useMemo(() => {
    const todayStr = new Date().toDateString()
    const secs = recentSessions
      .filter(s => new Date(s.started_at).toDateString() === todayStr)
      .reduce((sum, s) => sum + (s.duration_sec ?? 0), 0)
    return Math.round(secs / 60)
  }, [recentSessions])
  // Same key + same fallback as the parent dashboard's own goalMin.
  const goalMin = typeof window !== 'undefined' ? (parseInt(localStorage.getItem('koodakbook_daily_goal_min') ?? '10', 10) || 10) : 10
  const goalPct = goalMin > 0 ? Math.min(1, todayMin / goalMin) : 0

  // The learning path: four core rooms. NOT a teaching order — that order
  // isn't approved (product rule, 2026-09-29; mobile Home is deliberately
  // unnumbered too), so no step numbers and no arrows, just a row of rooms.
  // Every count is already loaded on this page.
  const path = useMemo<PathItem[]>(() => ([
    { module: 'phonics', title: 'صداها', href: '/child/phonics', sub: 'گوش کن و بگو' },
    { module: 'letters', title: 'حروف الفبا', href: '#alphabet',
      sub: letters.length ? `${toPersianDigits(letters.length)} حرف` : 'ضربه بزن، بشنو' },
    { module: 'lessons', title: 'درس‌ها', href: '/child/lesson',
      sub: lessons.length ? `${toPersianDigits(doneLessons.size)} از ${toPersianDigits(lessons.length)}` : 'کلمه‌های تازه',
      pct: lessons.length ? doneLessons.size / lessons.length : undefined },
    { module: 'stories', title: 'قصه‌ها', href: '/child/story',
      sub: stories.length ? `${toPersianDigits(doneStories.size)} از ${toPersianDigits(stories.length)}` : 'بخون و گوش کن',
      pct: stories.length ? doneStories.size / stories.length : undefined },
  ]), [letters.length, lessons.length, stories.length, doneLessons, doneStories])

  // Featured stories: the one in progress first, then unread unlocked ones,
  // then the rest of the unlocked shelf — never a locked story (a card that
  // opens onto a lock is a broken promise). Four are drawn; the fourth only
  // shows on a wide screen.
  const featured = useMemo(() => {
    const open = stories.filter(s => isStoryUnlocked(s, strandLevels))
    const rank = (s: Story) => (lastStory?.id === s.id ? 0 : doneStories.has(s.id) ? 2 : 1)
    return [...open].sort((a, b) => rank(a) - rank(b)).slice(0, 4)
  }, [stories, strandLevels, lastStory, doneStories])

  // Every other room, still one tap from home (the path above carries the
  // four core ones). See the file doc comment for every href and badge.
  const moreRooms = useMemo<GridItem[]>(() => ([
    { module: 'review', title: 'مرور', href: '/child/review', sub: 'لاکی راهنماته',
      badge: reviewWords.length > 0 ? 'امروز' : undefined },
    { module: 'speak', title: 'گفتار', href: '/child/speak', sub: 'آوا راهنماته' },
    { module: 'write', title: 'نوشتن', href: '/child/write', sub: 'شکل حرف‌ها' },
    { module: 'math', title: 'ریاضی', href: '/child/math', sub: 'خرسی راهنماته' },
    { module: 'games', title: 'بازی‌ها', href: '/child/games/memory', sub: 'تندپا راهنماته' },
    { module: 'rewards', title: 'جایزه‌ها', href: '/child/rewards', sub: 'سیمرغ راهنماته' },
  ]), [reviewWords.length])

  // Nothing of the page until its data is in (see loadForChild): the same
  // loading screen, on the same child-bg, as every other child screen.
  if (loadError) {
    // No way-out link: this IS home.
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setAttempt(a => a + 1) }} backHref={null} />
  }
  if (!child && !showPicker) return <LoadingScreen />

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-50 child-bg flex flex-col items-center justify-center p-6 gap-8">
        <h1 className="font-display text-h1 font-black text-text-primary persian-text">کی می‌خواد بازی کنه؟ <span aria-hidden="true">🎮</span></h1>
        <div className="grid grid-cols-2 gap-5 w-full max-w-md">
          {pickList.map(c => (
            <motion.button key={c.id} onClick={() => resolveChild(c)} whileTap={{ scale: 0.94 }}
              className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-3" aria-label={`بازی با ${c.name}`}>
              {/* EMOJI-CONTENT: avatar placeholder standing in for a child's own photo —
                  this is a portrait slot, not an affordance. Wants real art from
                  pixel-wizards-charachters. */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-4xl"
                style={{ background: 'var(--ramp-brand-soft)' }}>
                {mediaUrl(c.avatar_url) ? <img src={mediaUrl(c.avatar_url)!} alt="" className="w-full h-full object-cover" /> : '🧒'}
              </div>
              <span className="font-bold text-text-primary">{c.name}</span>
            </motion.button>
          ))}
        </div>
        <button onClick={() => router.push('/parent/dashboard')}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors persian-text mt-2 inline-flex items-center gap-1.5 min-h-[56px]">
          <Icon name="back" size="sm" />
          بازگشت به پنل والدین
        </button>
      </div>
    )
  }

  const nextHost = MODULE[nextUpModule].character
  const goalLabel = `امروز ${toPersianDigits(todayMin)} از ${toPersianDigits(goalMin)} دقیقه`

  return (
    <div className="min-h-screen child-bg pb-nav">
      <AnimatePresence>
        {showTutorial && <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      {/* ── Hero: the warm world, سیمرغ in it, a greeting by name. ── */}
      <section className="relative overflow-hidden" aria-labelledby="home-greeting">
        <HeroScene />
        <div className="relative px-4 sm:px-6 lg:px-10 pt-4">
          {/* Header strip. No lock button here — ChildRail/BottomNav's
              hold-to-parent door (and the parent card below, the same door)
              is the one gate on this route (see file doc comment). */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => speakPersian(nextUp.say)} className="flex items-center gap-2 min-h-[48px] rounded-2xl" aria-label="کودک‌بوک — بگو چی کار کنیم">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shadow-card"
                style={{ background: 'linear-gradient(135deg, var(--ramp-letters-bright), var(--ramp-math-deep))', color: '#fff' }} aria-hidden="true">
                <Icon name="stories" size="md" strokeWidth={2.4} />
              </span>
              <span className="font-display font-black text-card-title text-text-primary">کودک‌بوک</span>
            </button>
            <div className="flex items-center gap-2">
              {showStreak && (
                <div className="flex items-center gap-1.5 h-10 px-3 rounded-pill bg-white/90 shadow-card max-[359px]:px-2">
                  {/* `-ink`, not `-bright`: a stroke icon in the bright tone
                      alone is ~2.3:1 on white (WCAG 1.4.11 wants 3:1). */}
                  <span style={{ color: 'var(--ramp-phonics-ink)' }}><Icon name="streak" size="sm" strokeWidth={2.4} /></span>
                  <span className="font-bold text-sm" style={{ color: 'var(--ramp-phonics-ink)' }}>{toPersianDigits(stats.streak)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 h-10 px-3 rounded-pill bg-white/90 shadow-card max-[359px]:px-2">
                <span style={{ color: 'var(--ramp-brand-ink)' }}><Icon name="star" size="sm" strokeWidth={2.4} /></span>
                <span className="font-bold text-sm" style={{ color: 'var(--ramp-brand-ink)' }}>{toPersianDigits(stats.xp)}</span>
              </div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border-[3px] bg-white shrink-0 max-[359px]:hidden"
                style={{ borderColor: 'var(--ramp-stories-bright)' }} aria-hidden="true">
                {mediaUrl(child?.avatar_url) ? (
                  <img src={mediaUrl(child?.avatar_url)!} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display font-black text-lg" style={{ color: 'var(--ramp-stories-ink)' }}>{child?.name?.[0] ?? '؟'}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-2 pb-14 lg:pb-16">
            <div className="min-w-0 pt-5 pb-10 lg:pt-8 lg:pb-12">
              <h1 id="home-greeting" className="font-display font-black text-h2 sm:text-h1 text-text-primary persian-text">
                سلام {child?.name}! <span aria-hidden="true">👋</span>
              </h1>
              <p className="text-body font-bold text-text-secondary persian-text">امروز چی یاد بگیریم؟</p>
            </div>
            {/* سیمرغ, the story companion — the hero's one character. */}
            <div className="shrink-0 -me-2 lg:me-6" aria-hidden="true">
              <div className="w-[150px] h-[150px] max-[359px]:w-[120px] max-[359px]:h-[120px] sm:w-[170px] sm:h-[170px] lg:w-[210px] lg:h-[210px] [&>*]:!w-full [&>*]:!h-full [&_svg]:w-full [&_svg]:h-full">
                <Mascot size={200} mood="happy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative px-4 sm:px-6 lg:px-10 -mt-12 pb-4 space-y-7">
        {partialError && child && (
          <div role="status" className="rounded-3xl p-4 flex items-center gap-3 flex-wrap"
            style={{ background: 'var(--ramp-brand-soft)', color: 'var(--ramp-brand-ink)' }}>
            <CharacterAvatar slug="charkhi" size={48} mood="confused" />
            <p className="flex-1 min-w-[10rem] font-bold text-small persian-text">نتونستیم همه‌چیز رو بیاریم.</p>
            <div className="w-full sm:w-auto">
              <ClayButton size="md" disabled={reloading}
                onClick={async () => { setReloading(true); await loadForChild(child); setReloading(false) }}>
                {reloading ? 'در حال آوردن...' : 'دوباره امتحان کن'}
              </ClayButton>
            </div>
          </div>
        )}

        {/* ── Continue: the app's one decision, the deepest card on the page. ──
            block + the card's radius so the focus ring follows the card. */}
        <Link href={nextUp.href} aria-label={`${nextUp.label}: ${nextUp.title}${nextUpProgress ? `، ${toPersianDigits(nextUpProgress.idx + 1)} از ${toPersianDigits(nextUpProgress.total)}` : ''}`}
          className="block rounded-[1.75rem]">
          <motion.div whileTap={{ scale: 0.98 }} tabIndex={-1} /* wrapper inside a link: whileTap would otherwise add tabindex=0 (a second, nameless tab stop) */
            className="card-indigo relative overflow-hidden p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
            <span className="shrink-0 w-[84px] h-[84px] sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(160deg, var(--ramp-${nextUpModule}-soft), color-mix(in oklab, var(--ramp-${nextUpModule}-bright) 45%, white))` }} aria-hidden="true">
              {nextHost
                ? <CharacterAvatar slug={nextHost} size={84} mood="encouraging" />
                : <span className="text-5xl">{nextUp.emoji}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white/85">{nextUp.label}</p>
              <p className="font-display font-black text-card-title sm:text-h2 text-white truncate">{nextUp.title}</p>
              {nextUpProgress ? (
                <div className="flex items-center gap-2 mt-2" aria-hidden="true">
                  <div className="h-2.5 flex-1 max-w-[16rem] rounded-pill overflow-hidden bg-white/20">
                    <div className="h-full rounded-pill" style={{ background: 'var(--ramp-lessons-bright)', width: `${((nextUpProgress.idx + 1) / nextUpProgress.total) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-white/90 tabular-nums">{toPersianDigits(nextUpProgress.idx + 1)}/{toPersianDigits(nextUpProgress.total)}</span>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-white/85 mt-1 persian-text">بزن بریم! <span aria-hidden="true">🎈</span></p>
              )}
            </div>
            <span className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-card"
              style={{ background: '#6366F1' }} aria-hidden="true">
              <Icon name="next" size="md" strokeWidth={2.8} />
            </span>
          </motion.div>
        </Link>

        <div className="lg:grid lg:grid-cols-3 lg:gap-8 space-y-7 lg:space-y-0">
          <div className="lg:col-span-2 space-y-7">
            {/* ── Learning path: four rooms in the order a child climbs them ── */}
            <section aria-labelledby="path-title">
              <div className="flex items-end justify-between mb-3">
                <h2 id="path-title" className="font-display font-black text-card-title text-text-primary">مسیر یادگیری</h2>
                <Link href="/child/rooms" className="text-sm font-bold text-brand-text inline-flex items-center gap-1 min-h-[40px] rounded-lg">
                  همه‌ی اتاق‌ها <Icon name="next" size="sm" strokeWidth={2.5} />
                </Link>
              </div>
              <ul className="grid grid-cols-4 gap-2 min-[380px]:gap-3 sm:gap-5">
                {path.map(p => (
                  <li key={p.module} className="min-w-0">
                    <Link href={p.href} aria-label={`${p.title}: ${p.sub}`}
                      className="h-full block rounded-[1.5rem]">
                      <motion.div whileTap={{ y: 3 }} tabIndex={-1}
                        className="h-full card-soft flex flex-col items-center text-center px-1.5 pt-3 pb-2.5 sm:px-3 sm:pt-4"
                        style={{ background: `linear-gradient(180deg, color-mix(in oklab, var(--ramp-${p.module}-bright) 26%, white), color-mix(in oklab, var(--ramp-${p.module}-bright) 12%, white))` }}>
                        <span className="w-14 h-14 sm:w-[72px] sm:h-[72px] flex items-center justify-center" aria-hidden="true">
                          {MODULE[p.module].character
                            ? <span className="scale-[.78] sm:scale-100"><CharacterAvatar slug={MODULE[p.module].character!} size={72} mood="happy" /></span>
                            : <span style={{ color: `var(--ramp-${p.module}-deep)` }}><Icon name="headphones" size={44} strokeWidth={2.2} /></span>}
                        </span>
                        <p className="mt-2 font-bold text-sm leading-tight text-text-primary">{p.title}</p>
                        <p className="text-[11px] sm:text-xs font-medium mt-0.5 leading-tight" style={{ color: `var(--ramp-${p.module}-ink)` }}>{p.sub}</p>
                        {p.pct !== undefined && (
                          <span className="mt-1.5 h-1.5 w-4/5 rounded-pill overflow-hidden bg-white/80" aria-hidden="true">
                            <span className="block h-full rounded-pill" style={{ width: `${Math.round(p.pct * 100)}%`, background: `var(--ramp-${p.module}-deep)` }} />
                          </span>
                        )}
                      </motion.div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Featured stories: illustrated covers with a play badge ── */}
            {featured.length > 0 && (
              <section aria-labelledby="featured-title">
                <div className="flex items-end justify-between mb-3">
                  <h2 id="featured-title" className="font-display font-black text-card-title text-text-primary">قصه‌هایی برای تو</h2>
                  <Link href="/child/story" className="text-sm font-bold text-brand-text inline-flex items-center gap-1 min-h-[40px] rounded-lg">
                    همه <Icon name="next" size="sm" strokeWidth={2.5} />
                  </Link>
                </div>
                <ul className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {featured.map((s, i) => {
                    const done = doneStories.has(s.id)
                    const inProgress = lastStory?.id === s.id
                    const tag = inProgress ? 'نیمه‌کاره' : done ? 'خوندم' : null
                    return (
                      <li key={s.id} className={i === 3 ? 'hidden lg:block' : undefined}>
                        <Link href={`/child/story/${s.id}`}
                          aria-label={`${s.title_persian}${tag ? ` — ${tag}` : ''}`}
                          className="block h-full rounded-[1.25rem]">
                          <motion.div whileTap={{ scale: 0.97 }} tabIndex={-1}
                            className="h-full bg-white rounded-[1.25rem] overflow-hidden shadow-card">
                            <div className="relative">
                              <StoryCover id={s.id} coverUrl={s.cover_url} className="h-24 sm:h-32" hostSize={56} sizes="(min-width: 1024px) 18vw, 33vw" />
                              {tag && (
                                <span aria-hidden="true" className="absolute top-2 start-2 rounded-pill px-2 py-0.5 text-[11px] font-bold text-white"
                                  style={{ background: inProgress ? 'var(--ramp-math-deep)' : 'var(--ramp-lessons-deep)' }}>{tag}</span>
                              )}
                            </div>
                            <div className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                              <p className="font-bold text-sm sm:text-base text-text-primary leading-snug persian-text line-clamp-2">{s.title_persian}</p>
                              {s.age_min ? (
                                <p className="text-[11px] sm:text-xs text-text-secondary mt-0.5 inline-flex items-center gap-1">
                                  <Icon name="listen" size="xs" /> {toPersianDigits(s.age_min)}–{toPersianDigits(s.age_max ?? '')} سال
                                </p>
                              ) : null}
                            </div>
                          </motion.div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>

          {/* ── Side column on a wide screen: reward + parent, quiet. ── */}
          <div className="space-y-4">
            {/* Reward/progress: today's real minutes against the family's
                real goal, the real star total, the real words count. */}
            <Link href="/child/rewards"
              aria-label={`آفرین! ${goalLabel}. ${toPersianDigits(stats.xp)} ستاره، ${toPersianDigits(stats.words)} کلمه یاد گرفتی. برو به جایزه‌ها`}
              className="block rounded-[1.75rem]">
              <motion.div whileTap={{ scale: 0.98 }} tabIndex={-1}
                className="card-soft p-4 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, #FFF7DA, #FFEFC2)' }}>
                <span className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 35% 30%, #FFF6D0, #FDE68A)' }} aria-hidden="true">
                  <StarBuddy />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-text-primary persian-text truncate">آفرین {child?.name}، عالی پیش میری!</p>
                  <div className="flex items-center gap-2 mt-1.5" aria-hidden="true">
                    <span className="h-2.5 flex-1 rounded-pill overflow-hidden bg-white/80">
                      <span className="block h-full rounded-pill" style={{ width: `${Math.round(goalPct * 100)}%`, background: 'var(--ramp-lessons-bright)' }} />
                    </span>
                  </div>
                  <p className="text-xs font-medium mt-1" style={{ color: 'var(--ramp-rewards-ink)' }}>
                    {goalLabel} · {toPersianDigits(stats.words)} کلمه
                  </p>
                </div>
                <span className="shrink-0 flex flex-col items-center gap-0.5" style={{ color: 'var(--ramp-rewards-ink)' }} aria-hidden="true">
                  <Icon name="gift" size="lg" strokeWidth={2.2} />
                  <span className="text-xs font-black tabular-nums">{toPersianDigits(stats.xp)} <Icon name="star" size={11} strokeWidth={3} className="inline -mt-0.5" /></span>
                </span>
              </motion.div>
            </Link>

            {/* Quiet parent card: tells a grown-up where their door is. The
                ONLY control in it is ParentDoorNav — the same hold + PIN gate
                as the nav's door, never a tap-through (see doc comment). */}
            <section aria-labelledby="parent-card-title" className="card-soft p-4 flex items-center gap-3 flex-wrap"
              style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)' }}>
              <span className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(160deg, var(--ramp-review-bright), var(--ramp-review-deep))' }} aria-hidden="true">
                <Icon name="locked" size="md" strokeWidth={2.4} />
              </span>
              <div className="flex-1 min-w-[6rem]">
                <h2 id="parent-card-title" className="font-bold text-sm text-text-primary">بخش والدین</h2>
                <p className="text-xs text-text-secondary persian-text leading-snug">گزارش پیشرفت و تنظیمات</p>
              </div>
              <div className="shrink-0" style={{ color: 'var(--ramp-review-ink)' }}>
                <ParentDoorNav variant="card" />
              </div>
            </section>
          </div>
        </div>

        {/* ── Every other room, one tap from home ── */}
        <section aria-labelledby="more-rooms-title">
          <div className="flex items-end justify-between mb-3">
            <h2 id="more-rooms-title" className="font-display font-black text-card-title text-text-primary">دوستات منتظرتن</h2>
            <Link href="/child/rooms" className="text-sm font-bold text-brand-text inline-flex items-center gap-1 min-h-[40px] rounded-lg">
              کتابخانه‌ی کامل <Icon name="next" size="sm" strokeWidth={2.5} />
            </Link>
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" role="list" aria-label="دوستات منتظرتن">
            {moreRooms.map(g => (
              <div key={g.module} role="listitem">
                <ModuleCard module={g.module} title={g.title} sub={g.sub} href={g.href} badge={g.badge} />
              </div>
            ))}
            {/* Re-placement's entry point — سیمرغ by name, so سیمرغ hosts it,
                same as apps/mobile/app/home.tsx's own conditional tile. */}
            {reprobeDue && (
              <div role="listitem">
                <ModuleCard module="rewards" title="بازی سیمرغ" sub="سیمرغ دلش می‌خواد باهات بازی کنه!"
                  href="/onboarding/placement?mode=reprobe" />
              </div>
            )}
          </div>
        </section>

        {/* ── Friends carousel: not in the mockup, kept for reachability
             (see file doc comment) ── */}
        {friends.length > 0 && (
          <section aria-labelledby="friends-title">
            <h2 id="friends-title" className="font-display font-black text-card-title text-text-primary mb-3">دوست‌های من</h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth" role="list" aria-label="دوست‌های من">
              {/* role="listitem" sits on a wrapper, not on the Link/button:
                  on the control itself it REPLACED the link/button role, so
                  these were announced as plain list items. */}
              {friends.map(f => (
                <div key={f.slug} role="listitem" className="flex-shrink-0 snap-start">
                  <Link href={`/child/friends/${f.slug}`}
                    aria-label={`برو پیش ${f.name_persian}`} className="block rounded-[1.25rem]">
                    <motion.div whileTap={{ scale: 0.93 }} tabIndex={-1}
                      className="w-28 bg-white rounded-[1.25rem] shadow-card flex flex-col items-center gap-1 py-3">
                      <CharacterAvatar slug={f.slug} size={64} mood="idle" />
                      <p className="font-bold text-text-primary text-sm">{f.name_persian}</p>
                    </motion.div>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Alphabet — tap to hear; the path's «حروف الفبا» step lands
             here (#alphabet), kept for reachability (see file doc comment) ── */}
        {letters.length > 0 && (
          <section id="alphabet" className="scroll-mt-20" aria-labelledby="alphabet-title">
            <h2 id="alphabet-title" className="font-display font-black text-card-title text-text-primary mb-3">الفبا — ضربه بزن و بشنو</h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth" role="list" aria-label="الفبا">
              {letters.map(l => (
                <div key={l.id} role="listitem" className="flex-shrink-0 snap-start">
                  <button
                    onClick={() => { playTap(); speakOrPlay(l.audio_url, l.name_persian) }}
                    aria-label={`بشنو: ${l.name_persian}`}
                    className="block rounded-[1.25rem]">
                    <motion.div whileTap={{ scale: 0.88 }} tabIndex={-1}
                      className="w-20 h-24 bg-white rounded-[1.25rem] shadow-card flex flex-col items-center justify-center gap-1">
                      <span className="text-4xl font-bold leading-none" style={{ color: 'var(--ramp-letters-ink)' }}>{l.character}</span>
                      <span className="text-[11px] text-text-secondary persian-text">{l.name_persian}</span>
                    </motion.div>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

/** The reward card's star — a small friendly face on the star the child
 *  collects, not a stock glyph (the reference's star buddy). Decorative. */
function StarBuddy() {
  return (
    <svg viewBox="0 0 48 48" width={44} height={44} aria-hidden="true">
      <path d="M24 4.5l5.6 11.8 12.9 1.6-9.5 8.9 2.5 12.8L24 33.3l-11.5 6.3 2.5-12.8-9.5-8.9 12.9-1.6z"
        fill="#FBBF24" stroke="#D97706" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="19.5" cy="22.5" r="2" fill="#5B3A00" />
      <circle cx="28.5" cy="22.5" r="2" fill="#5B3A00" />
      <path d="M20 27.5q4 3.4 8 0" fill="none" stroke="#5B3A00" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="26.5" r="1.8" fill="#FB7185" opacity=".55" />
      <circle cx="31.5" cy="26.5" r="1.8" fill="#FB7185" opacity=".55" />
    </svg>
  )
}
