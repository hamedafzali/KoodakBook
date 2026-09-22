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
import { MODULE, ModuleCard, IconChip, Icon, type ModuleKey } from '@/components/child/kit'
import { clayVars } from '@/components/child/clay'
import CharacterAvatar from '@/components/child/CharacterAvatar'
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

type NextUpKind = 'lesson' | 'review' | 'story' | 'phonics'
interface NextUp { href: string; label: string; title: string; emoji: string; say: string; kind: NextUpKind }

/** The continue-card's colour + big character by what nextUp actually is —
 *  ported from apps/mobile/app/home.tsx's NEXTUP_STYLE, keyed the same way. */
const NEXTUP_MODULE: Record<NextUpKind, ModuleKey> = {
  lesson: 'lessons', review: 'review', story: 'stories', phonics: 'phonics',
}

interface GridItem { module: ModuleKey; title: string; sub: string; href: string; badge?: string }

/* The mockup's continue-card scene, ported verbatim (var(--token) resolved to
 * literal hex — same reasoning as apps/mobile/app/home.tsx's
 * CONTINUE_SCENE_SVG, which this is a wider crop-to-fit sibling of; see the
 * file doc comment above for why the road stays as decoration while the
 * section-progress markers that sat on it do not). */
const CONTINUE_SCENE_SVG = `<svg viewBox="0 0 354 224" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="354" height="224" fill="#FFF8EA"/>
  <rect x="0" y="98" width="354" height="126" fill="#FFEFD6"/>
  <defs><pattern id="kbDotsW" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#E8B765" opacity=".16"/></pattern></defs><rect x="0" y="0" width="354" height="110" fill="url(#kbDotsW)"/>
  <circle cx="50" cy="38" r="30" fill="#FBBF24" opacity=".18"/>
  <circle cx="50" cy="38" r="20" fill="#FBBF24"/>
  <path d="M128 34 q3.6 -2.7 7.2 0 q3.6 -2.7 7.2 0" fill="none" stroke="#B99A63" stroke-width="1.71" stroke-linecap="round" opacity=".5"/><path d="M176 22 q2.8 -2.1 5.6 0 q2.8 -2.1 5.6 0" fill="none" stroke="#B99A63" stroke-width="1.33" stroke-linecap="round" opacity=".4"/>
  <g fill="#FFFFFF" opacity=".9">
    <rect x="236" y="26" width="60" height="15" rx="7.5"/>
    <circle cx="250" cy="26" r="12"/><circle cx="268" cy="19" r="16"/><circle cx="288" cy="27" r="11"/>
  </g>
  <path d="M0 118 q70 -30 140 -8 q72 24 146 -6 q40 -16 68 2 L354 224 L0 224 Z" fill="#CFEDE2"/>
  <path d="M0 142 q88 -38 184 -6 q96 30 170 -4 L354 224 L0 224 Z" fill="#8FE2CC"/>
  <path d="M0 172 q110 -30 214 -2 q84 22 140 -6 L354 224 L0 224 Z" fill="#57D6BC"/>
  <path d="M0 194 q140 -16 248 0 q58 8 106 -6 L354 224 L0 224 Z" fill="#F3E0B4"/>
  <g><ellipse cx="26" cy="189" rx="14.56" ry="3.36" fill="#0F5C4A" opacity=".13"/><rect x="21.52" y="156.88" width="8.96" height="30.24" rx="4.48" fill="#8A5A24"/><circle cx="26" cy="145.68" r="19.04" fill="#127A55"/><circle cx="13.68" cy="154.64" r="11.76" fill="#0E6244"/><circle cx="37.2" cy="153.52" r="10.64" fill="#159C69"/><circle cx="19.28" cy="136.72" r="8.4" fill="#35C08C" opacity=".55"/></g><g><ellipse cx="330" cy="179" rx="11.7" ry="2.7" fill="#0F5C4A" opacity=".13"/><rect x="326.4" y="152.6" width="7.2" height="24.3" rx="3.6" fill="#8A5A24"/><circle cx="330" cy="143.6" r="15.3" fill="#127A55"/><circle cx="320.1" cy="150.8" r="9.45" fill="#0E6244"/><circle cx="339.0" cy="149.9" r="8.55" fill="#159C69"/><circle cx="324.6" cy="136.4" r="6.75" fill="#35C08C" opacity=".55"/></g>
  <g opacity=".9"><circle cx="96" cy="206" r="2.108" fill="#F472B6"/><circle cx="93.148" cy="206" r="2.108" fill="#F472B6"/><circle cx="98.852" cy="206" r="2.108" fill="#F472B6"/><circle cx="96" cy="203.148" r="2.108" fill="#F472B6"/><circle cx="96" cy="208.852" r="2.108" fill="#F472B6"/><circle cx="96" cy="206" r="1.488" fill="#FFE9A8"/></g><g opacity=".9"><circle cx="246" cy="210" r="1.972" fill="#FBBF24"/><circle cx="243.332" cy="210" r="1.972" fill="#FBBF24"/><circle cx="248.668" cy="210" r="1.972" fill="#FBBF24"/><circle cx="246" cy="207.332" r="1.972" fill="#FBBF24"/><circle cx="246" cy="212.668" r="1.972" fill="#FBBF24"/><circle cx="246" cy="210" r="1.392" fill="#FFE9A8"/></g>
  <ellipse cx="322" cy="190" rx="26" ry="6" fill="#0F5C4A" opacity=".16"/><ellipse cx="192" cy="106" rx="32" ry="8" fill="#0F5C4A" opacity=".16"/><ellipse cx="38" cy="178" rx="24" ry="6" fill="#0F5C4A" opacity=".16"/>
  <path d="M 322 156 C 284 114 254 70 192 62 C 130 54 98 124 38 144" fill="none" stroke="#E3CE9C" stroke-width="25" stroke-linecap="round"/>
  <path d="M 322 156 C 284 114 254 70 192 62 C 130 54 98 124 38 144" fill="none" stroke="#F9EDD2" stroke-width="17" stroke-linecap="round"/>
  <path d="M236 40.0 Q237.3 44.7 242.0 46 Q237.3 47.3 236 52.0 Q234.7 47.3 230.0 46 Q234.7 44.7 236 40.0 Z" fill="#FFD98A" opacity=".95"/><path d="M154 29.2 Q155.04 32.96 158.8 34 Q155.04 35.04 154 38.8 Q152.96 35.04 149.2 34 Q152.96 32.96 154 29.2 Z" fill="#FFFFFF" opacity=".95"/>
  <path d="M0 216 q46 -14 88 -3 q38 10 78 -4 q44 -14 86 -1 q40 12 82 -4 L354 224 L0 224 Z" fill="#3DBFA4"/>
</svg>`

// Goal ring geometry (mockup's own numbers: r=16, stroke=6, viewBox 44×44).
const GOAL_R = 16
const GOAL_CIRC = 2 * Math.PI * GOAL_R

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
  // Streak display gate — see the file doc comment's product-ethics note.
  const showStreak = band === 3 && stats.streak > 0

  // ── The one decision the app makes FOR the child (unchanged logic; `kind`
  //    is a new UI-only tag on the same result, for module-themed styling) ──
  const nextUp = useMemo<NextUp>(() => {
    if (lastLesson) return { href: `/child/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, emoji: LESSON_TYPE_EMOJI[lastLesson.type] ?? '📚', say: `بیا درس ${lastLesson.title} رو تمام کنیم!`, kind: 'lesson' }
    if (reviewWords.length >= 3) return { href: '/child/review', label: 'مرور کلمه‌ها', title: `${reviewWords.length} کلمه منتظرند`, emoji: '🔄', say: 'بیا کلمه‌هایی که یاد گرفتی رو مرور کنیم!', kind: 'review' }
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

  // The 3×3 friends/module grid — see the file doc comment for every href
  // and badge decision below.
  const grid = useMemo<GridItem[]>(() => ([
    { module: 'lessons', title: 'درس‌ها', href: '/child/lesson',
      sub: `روزی راهنماته${lessons.length ? ` · ${toPersianDigits(lessons.length)} درس` : ''}` },
    { module: 'letters', title: 'حروف الفبا', href: '#alphabet',
      sub: `بومی راهنماته${letters.length ? ` · ${toPersianDigits(letters.length)} حرف` : ''}` },
    { module: 'phonics', title: 'صداها', href: '/child/phonics', sub: 'گوش کن و بگو' },
    { module: 'review', title: 'مرور', href: '/child/review', sub: 'لاکی راهنماته',
      badge: reviewWords.length > 0 ? 'امروز' : undefined },
    { module: 'speak', title: 'گفتار', href: '/child/speak', sub: 'آوا راهنماته' },
    { module: 'write', title: 'نوشتن', href: '/child/write', sub: 'شکل حرف‌ها' },
    { module: 'math', title: 'ریاضی', href: '/child/math', sub: 'خرسی راهنماته' },
    { module: 'games', title: 'بازی‌ها', href: '/child/games/memory', sub: 'تندپا راهنماته' },
    { module: 'rewards', title: 'جایزه‌ها', href: '/child/rewards', sub: 'سیمرغ راهنماته' },
  ]), [lessons.length, letters.length, reviewWords.length])

  if (showPicker) {
    return (
      <div className="fixed inset-0 z-50 child-bg flex flex-col items-center justify-center p-6 gap-8">
        <h1 className="font-display text-h1 font-black text-text-primary persian-text">کی می‌خواد بازی کنه؟ 🎮</h1>
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

  return (
    <div className="min-h-screen child-bg pb-nav">
      <AnimatePresence>
        {showTutorial && <Tutorial childName={child?.name} onClose={() => setShowTutorial(false)} />}
      </AnimatePresence>

      <div className="px-4 sm:px-6 lg:px-10 pt-5 pb-4 space-y-6">

        {/* ── Header: identity strip, not the old full-bleed gradient hero.
             No lock button here — ChildRail/BottomNav's hold-to-parent door
             is the one gate on this route (see file doc comment). ── */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => speakPersian(nextUp.say)} className="flex items-center gap-2.5" aria-label="کودک‌بوک — بگو چی کار کنیم">
            <Mascot size={44} mood="proud" />
            <span className="font-display font-black text-card-title text-text-primary">کودک‌بوک</span>
          </button>
          <div className="flex items-center gap-2">
            {showStreak && (
              <div className="flex items-center gap-1.5 h-10 px-3 rounded-pill bg-white shadow-card">
                {/* Icon color: `-ink`, not `-bright` -- a Lucide stroke icon in the
                    bright tone alone measures ~2.3:1 on this white pill (WCAG
                    1.4.11 needs >=3:1 for a graphical UI object); `-ink` is the
                    token this exact page already uses one line down for the
                    adjacent streak-count text, and clears >=7:1 here too
                    (2026-09-22 fresh-redesign contrast pass). */}
                <span style={{ color: 'var(--ramp-phonics-ink)' }}><Icon name="streak" size="sm" strokeWidth={2.4} /></span>
                <span className="font-bold text-sm" style={{ color: 'var(--ramp-phonics-ink)' }}>{toPersianDigits(stats.streak)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 h-10 px-3 rounded-pill bg-white shadow-card">
              {/* Same fix as the streak icon above: `-bright` measured ~1.7:1 on
                white, the worst contrast bug found in this pass. `-ink`
                matches the xp-count text right beside it. */}
              <span style={{ color: 'var(--ramp-brand-ink)' }}><Icon name="star" size="sm" strokeWidth={2.4} /></span>
              <span className="font-bold text-sm" style={{ color: 'var(--ramp-brand-ink)' }}>{toPersianDigits(stats.xp)}</span>
            </div>
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center overflow-hidden border-4 shrink-0"
              style={{ background: 'var(--ramp-stories-soft)', borderColor: 'var(--ramp-stories-bright)' }} aria-hidden="true">
              {mediaUrl(child?.avatar_url) ? (
                <img src={mediaUrl(child?.avatar_url)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display font-black text-lg" style={{ color: 'var(--ramp-stories-ink)' }}>{child?.name?.[0] ?? '؟'}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Continue/journey card — the app's one decision, illustrated. ── */}
        <Link href={nextUp.href} aria-label={`${nextUp.label}: ${nextUp.title}`}>
          <motion.div whileTap={{ scale: 0.98 }}
            className="rounded-[2.25rem] overflow-hidden shadow-raised bg-white">
            <div className="h-[74px] px-4 sm:px-5 flex items-center justify-between gap-3 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <IconChip module={nextUpModule} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-secondary">{nextUp.label}</p>
                  <p className="font-display font-black text-card-title text-text-primary truncate">{nextUp.title}</p>
                </div>
              </div>
              {nextUpProgress && (
                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 w-28">
                  <span className="text-xs font-bold text-text-secondary">
                    {toPersianDigits(nextUpProgress.idx + 1)} از {toPersianDigits(nextUpProgress.total)}
                  </span>
                  <div className="h-2 w-full rounded-pill overflow-hidden" style={{ background: `var(--ramp-${nextUpModule}-soft)` }}>
                    <div className="h-full rounded-pill" style={{ background: `var(--ramp-${nextUpModule}-bright)`, width: `${((nextUpProgress.idx + 1) / nextUpProgress.total) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="relative h-56 sm:h-64 lg:h-72 overflow-hidden">
              <div className="absolute inset-0" aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: CONTINUE_SCENE_SVG.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" width="100%" height="100%" ') }} />
              {/* چرخی — fixed road/journey mascot, always here regardless of
                  nextUp (see kit.tsx's MODULE comment + file doc comment). */}
              <div className="absolute left-[8%] sm:left-[14%] top-[18%]" aria-hidden="true">
                <CharacterAvatar slug="charkhi" size={64} mood="happy" />
              </div>
              {/* nextUp's own host character, swapped by kind. */}
              {MODULE[nextUpModule].character && (
                <div className="absolute right-[8%] sm:right-[14%] top-[10%]" aria-hidden="true">
                  <CharacterAvatar slug={MODULE[nextUpModule].character!} size={112} mood="encouraging" />
                </div>
              )}
              {/* A styled span, not a real <button> — the whole card above
                  is already one <Link>, and a <button> nested inside an <a>
                  is invalid HTML (same reasoning kit.tsx's own ChunkyButton
                  was built on; this is that same technique, parametrized by
                  nextUp's module ramp instead of ChunkyButton's fixed
                  brand hue). */}
              <div className="absolute bottom-4 right-4 sm:right-5">
                <span style={clayVars(nextUpModule)} className="clay inline-flex items-center justify-center gap-1.5 font-bold min-h-[56px] px-6 text-lg">
                  بزن بریم! 🎈
                </span>
              </div>
            </div>
          </motion.div>
        </Link>

        {/* ── Three real stat tiles ── */}
        <div className={`grid gap-3 sm:gap-4 ${showStreak ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: 'var(--ramp-brand-bright)' }}>
            <svg viewBox="0 0 44 44" width={42} height={42} className="shrink-0" aria-hidden="true">
              <circle cx={22} cy={22} r={GOAL_R} fill="none" stroke="var(--ramp-brand-ink)" strokeWidth={6} opacity={0.22} />
              <circle cx={22} cy={22} r={GOAL_R} fill="none" stroke="var(--ramp-brand-ink)" strokeWidth={6} strokeLinecap="round"
                strokeDasharray={`${GOAL_CIRC * goalPct} ${GOAL_CIRC}`}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '22px 22px' }} />
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-bold opacity-70" style={{ color: 'var(--ramp-brand-ink)' }}>هدف امروز</p>
              <p className="font-display font-black text-sm sm:text-base truncate" style={{ color: 'var(--ramp-brand-ink)' }}>
                {toPersianDigits(todayMin)} از {toPersianDigits(goalMin)} دقیقه
              </p>
            </div>
          </div>

          {showStreak && (
            <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: 'var(--ramp-phonics-soft)' }}>
              <span className="shrink-0" style={{ color: 'var(--ramp-phonics-ink)' }}><Icon name="streak" size="xl" strokeWidth={2.2} /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold opacity-70" style={{ color: 'var(--ramp-phonics-ink)' }}>پشت سر هم</p>
                <p className="font-display font-black text-sm sm:text-base truncate" style={{ color: 'var(--ramp-phonics-ink)' }}>{toPersianDigits(stats.streak)} روز</p>
              </div>
            </div>
          )}

          <div className="rounded-3xl p-4 flex items-center gap-3" style={{ background: 'var(--ramp-letters-soft)' }}>
            <span className="shrink-0" style={{ color: 'var(--ramp-letters-ink)' }}><Icon name="star" size="xl" strokeWidth={2.2} /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold opacity-70" style={{ color: 'var(--ramp-letters-ink)' }}>کلمه‌های یادگرفته</p>
              <p className="font-display font-black text-sm sm:text-base truncate" style={{ color: 'var(--ramp-letters-ink)' }}>{toPersianDigits(stats.words)}</p>
            </div>
          </div>
        </div>

        {/* ── Friends/module grid ── */}
        <div className="flex items-end justify-between">
          <h2 className="font-display font-black text-card-title text-text-primary">دوستات منتظرتن</h2>
          <Link href="/child/rooms" className="text-sm font-bold text-brand-text inline-flex items-center gap-1">
            کتابخانه‌ی کامل <Icon name="prev" size="sm" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="دوستات منتظرتن">
          {grid.map(g => (
            <div key={g.module} role="listitem">
              <ModuleCard module={g.module} title={g.title} sub={g.sub} href={g.href} badge={g.badge} big />
            </div>
          ))}
          {/* Re-placement's entry point — سیمرغ by name, so سیمرغ hosts it,
              same as apps/mobile/app/home.tsx's own conditional 10th tile. */}
          {reprobeDue && (
            <div role="listitem">
              <ModuleCard module="rewards" title="بازی سیمرغ" sub="سیمرغ دلش می‌خواد باهات بازی کنه!"
                href="/onboarding/placement?mode=reprobe" big />
            </div>
          )}
        </div>

        {/* ── Friends carousel: not in the mockup, kept for reachability
             (see file doc comment) ── */}
        {friends.length > 0 && (
          <section>
            <h2 className="font-bold text-text-primary text-base mb-3">دوست‌های من 🦊</h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth" role="list" aria-label="دوست‌های من">
              {friends.map(f => (
                <Link key={f.slug} href={`/child/friends/${f.slug}`} role="listitem"
                  aria-label={`برو پیش ${f.name_persian}`} className="flex-shrink-0 snap-start">
                  <motion.div whileTap={{ scale: 0.93 }}
                    className="w-28 bg-white rounded-2xl shadow-card flex flex-col items-center gap-1 py-3">
                    <CharacterAvatar slug={f.slug} size={64} mood="idle" />
                    <p className="font-bold text-text-primary text-sm">{f.name_persian}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Alphabet — tap to hear; the "حروف الفبا" grid card's real
             destination (#alphabet), not in the mockup, kept for
             reachability (see file doc comment) ── */}
        {letters.length > 0 && (
          <section id="alphabet" className="scroll-mt-20">
            <h2 className="font-bold text-text-primary text-base mb-3">الفبا — ضربه بزن و بشنو 🔤</h2>
            <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-1 snap-x scroll-smooth" role="list" aria-label="الفبا">
              {letters.map(l => (
                <button key={l.id} role="listitem"
                  onClick={() => { playTap(); speakOrPlay(l.audio_url, l.name_persian) }}
                  aria-label={`بشنو: ${l.name_persian}`}
                  className="flex-shrink-0 snap-start">
                  <motion.div whileTap={{ scale: 0.88 }}
                    className="w-20 h-24 bg-white rounded-2xl shadow-card flex flex-col items-center justify-center gap-1">
                    <span className="text-4xl font-bold leading-none" style={{ color: 'var(--ramp-letters-ink)' }}>{l.character}</span>
                    <span className="text-[11px] text-text-secondary persian-text">{l.name_persian}</span>
                  </motion.div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
