import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, SvgXml } from 'react-native-svg'
import type {
  Child, DashboardSummary, Lesson, Letter, ReviewItem, SceneSlug, Story, StrandLevels,
} from '@koodakbook/shared'
import {
  ALL_UNLOCKED, LESSON_TYPE_EMOJI, LESSON_TYPE_LABEL, SCENE_SLUGS, isLessonUnlocked, isStoryUnlocked,
  resolveLevel, toPersianDigits,
} from '@koodakbook/shared'
import ScreenBackground from '@/components/ScreenBackground'
import Tutorial from '@/components/Tutorial'
import ModuleCard from '@/components/ModuleCard'
import Icon from '@/components/Icon'
import SceneBackdrop from '@/components/SceneBackdrop'
import { CharacterArt, ClayButton, ClaySurface, DeepActionCard, HostAvatar, ProgressTrack, SectionHeading, lighten } from '@/components/Clay'
import { GiftBox, ParentLock, PlayBadge, RewardStar } from '@/components/Illustrations'
import HoldToParent from '@/components/HoldToParent'
import { LESSON_SECTION_ORDER } from '@/lib/lessonOrder'
import { LESSON_ROOM_STYLE, STORY_ROOM_STYLE, lessonRoomStyle, type RoomStyle } from '@/lib/roomStyle'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { childAge } from '@/lib/math'
import { mediaUrl, thumbUrl } from '@/lib/media'
import { ensurePrefs, getDailyGoal, hasSeenTutorial } from '@/lib/prefs'
import { playClip } from '@/lib/sound'
import { useChildSession } from '@/lib/useChildSession'
import { clay, colors, elevation, fonts, radii, ramps, scenery, spacing, textSize, textStart, naturalLineHeight, ui, type Ramp } from '@/lib/theme'
import BottomNav from '@/components/BottomNav'

/*
 * Home screen, redesigned against the 2026-09-21 mockup (MobileHome.dc.html):
 * an illustrated "continue" journey card, a real daily-goal ring, and the
 * activity grid restyled as chunky character-hosted room cards. Every data
 * hook below (child/lessons/stories/letters/stats/reviewCount/strandLevels/
 * doneLessons/doneStories/lastLesson/lastStory/tutorial/reprobeDue) is
 * unchanged from the previous build -- this is a visual pass, not a feature
 * cut. Three deliberate honesty calls, documented so a future editor doesn't
 * "fix" them back toward the mockup's literal numbers:
 *
 *  - The mockup's continue-card shows a fixed "۱ از ۵" and a locked/completed
 *    pair of level badges implying a multi-chapter road the backend doesn't
 *    model (a story/lesson has no sub-level list). `nextUpProgress` below
 *    computes a REAL "X از Y" from the child's actual peer set at the same
 *    stage when one exists, and the locked/checkmark road-node badges are
 *    dropped rather than faked.
 *  - The mockup's goal card shows a fixed "۱۲ از ۲۰ دقیقه". `todayMin` is
 *    computed for real from `recent_sessions` (mirrors the exact filter/sum
 *    apps/web/src/app/parent/dashboard/page.tsx already uses for its
 *    heatmap); the goal denominator is the family's real saved setting
 *    (`getDailyGoal()`, mobile's existing `lib/prefs.ts`), not the mockup's
 *    literal 20. `recent_sessions` is capped at 5 server-side (dashboard.ts)
 *    so a child with 6+ sessions today will under-count -- a latent limit
 *    the web dashboard's own heatmap already has, not new here.
 *  - The header's own hold-to-parent lock button is dropped: `BottomNav`
 *    (mounted below, shared by four screens) already carries that gate, and
 *    the mockup's own header has no lock icon either -- one gate, not a
 *    duplicated one.
 *
 * 2026-09-25 visual-foundation pass (Design Implementation Phase 1). Data and
 * nextUp logic untouched; what changed is the hierarchy and the material:
 *  - One obvious action. The continue card became a single large clay card
 *    whose "بزن بریم!" button is a full-width 56pt clay button IN the layout,
 *    replacing the small pill that was absolutely positioned at a fixed
 *    physical `left` inside the illustration (and its 11px label pill). The
 *    whole card stays one tap target; the button face sinks when it's pressed.
 *  - «بعد از این»: up to two smaller cards for review and a story, only when
 *    they're real and not already what the big card shows (see alsoForYou).
 *  - Every surface is components/Clay.tsx now (the same material web uses),
 *    and sizes/spacing/radii come from theme tokens instead of ad hoc numbers.
 *  - An error state: a failed /api/children used to leave the spinner up
 *    forever. It now shows a retry.
 *  - "هدف امروز" had ink at 72% opacity on the saffron fill; full ink now.
 *
 * 2026-09-25 illustration pass (1B), following the rules in Clay.tsx:
 *  - Hero cast now matches web's continue card: the activity's host (focal,
 *    104pt, encouraging) plus چرخی, web's always-present journey companion
 *    (60pt, happy). Before, mobile drew only the host, so a phonics nextUp
 *    (no host) showed an empty scene.
 *  - The alphabet gets its host, بومی: web's kit.tsx MODULE maps letters ->
 *    boomi, and HOST_NAME above already had the name, but mobile never drew
 *    him anywhere.
 *  - Every host disc is the shared HostAvatar.
 *
 * 2026-09-25 Design Direction 2 -- moved toward the owner's concept image
 * (design-screenshots/ChatGPTDesign.png), adapted to real data only:
 *  - Hero: full-bleed illustrated world (the continue-scene art, now the
 *    page's top) with the brand wordmark, the greeting and a large سیمرغ.
 *    The concept's castle/mountains don't exist as KoodakBook art; not drawn.
 *  - Continue card: deep clay in nextUp's ramp, white text (charter: white
 *    only on deep), the content's real thumbnail/cover when it has one, the
 *    real position as dots, and a forward arrow. nextUp itself is untouched.
 *  - Learning path, story picks, level and a parent-area card: see the memos
 *    and the render for what each is built from. The concept's bell, "new"
 *    badges, audio durations and 5-tab nav have no data/route here: omitted.
 *  - «بعد از این» is folded in: its story now lives in the story row, and the
 *    review count shows on the review room card.
 *
 * 2026-09-27 robustness pass (hero, wordmark and data untouched in look):
 *  - Path and story rows now run edge to edge with widths that always leave a
 *    half card at the edge (peekCardWidth), «همه ›» links named by their
 *    destination, and screen-reader positions («مورد ۲ از ۶»).
 *  - Empty and failed lists are designed notes (NoteCard), never a missing
 *    section; a failed list retries without bringing the loading gate back.
 *  - «نیمه‌کاره» on stories the child opened and hasn't finished.
 *  - Large text: no fixed-height text boxes; logo, glyph and emoji capped.
 *
 * 2026-09-28 visual-fidelity pass (Agent B), closer to the reference
 * (REFERENCE_ChatGPTDesign.png) with the approved wordmark, header, سیمرغ
 * hero and warm world kept. Data, nextUp, load() and the startup gate are
 * untouched; only derived memos and the render changed:
 *  - Hero: new HERO_SCENE_SVG (pale-blue-to-cream sky, far mountains,
 *    clouds, a warm glow behind a larger سیمرغ; the sky-crossing road arch
 *    and dot pattern removed); the header's end is one white pill; the page
 *    body is a rounded sheet rising over the hills behind the continue card.
 *  - Continue card: always the shared deep indigo DeepActionCard (Agent A's,
 *    Clay.tsx), whatever nextUp is; the room's name and a REAL completion bar
 *    (the room's done/total, the number its path card shows) replace the
 *    position dots (the old `nextUpProgress`/`nextUpStep`).
 *  - Path: pastel tiles per room with done ✓ / current ▶ + ring / locked 🔒.
 *  - Stories: white cards, scene fallback, play badge, «جدید»/«صوتی» from
 *    real data. Progress: a reward card (star, real level bar) + a quieter
 *    goal strip. Parent: lavender, lock icon, «نگه دارید» pill.
 *  - Line icons (components/Icon.tsx) for every chevron, lock and badge;
 *    Agent J's Illustrations for the star, gift, parent lock and play badge.
 */

const HOST_NAME: Record<string, string> = {
  roozi: 'روزی', boomi: 'بومی', pashmak: 'پشمک', laki: 'لاکی',
  ava: 'آوا', khersi: 'خرسی', tondpa: 'تندپا', simorgh: 'سیمرغ',
}

// Ramp + cast host per room -- ported 1:1 from web's kit.tsx `MODULE` record
// (pixel-wizards-charachters roles reconciled to this same mapping this
// session; see the library's CHARACTERS doc comment). `write`/`phonics`/
// `friends` have no host in kit.tsx either -- not every room gets one.
const TILES = [
  { key: 'stories', emoji: '📖', title: 'قصه‌ها', href: '/stories' as const, ramp: ramps.stories, character: 'pashmak' as string | undefined },
  { key: 'lessons', emoji: '📚', title: 'درس‌ها', href: '/lessons' as const, ramp: ramps.lessons, character: 'roozi' as string | undefined },
  { key: 'review', emoji: '🔄', title: 'مرور', href: '/review' as const, ramp: ramps.review, character: 'laki' as string | undefined },
  { key: 'rewards', emoji: '🏆', title: 'جایزه‌ها', href: '/rewards' as const, ramp: ramps.rewards, character: 'simorgh' as string | undefined },
  { key: 'friends', emoji: '🦊', title: 'دوست‌ها', href: '/friends' as const, ramp: ramps.phonics, character: undefined as string | undefined },
  { key: 'math', emoji: '🔢', title: 'ریاضی', href: '/math' as const, ramp: ramps.math, character: 'khersi' as string | undefined },
  { key: 'games', emoji: '🃏', title: 'بازی‌ها', href: '/games' as const, ramp: ramps.games, character: 'tondpa' as string | undefined },
  { key: 'phonics', emoji: '🎵', title: 'صداها', href: '/phonics' as const, ramp: ramps.phonics, character: undefined as string | undefined },
  { key: 'speak', emoji: '🎤', title: 'بگو ببینم!', href: '/speak' as const, ramp: ramps.speak, character: 'ava' as string | undefined },
  { key: 'write', emoji: '✍️', title: 'بنویس', href: '/write' as const, ramp: ramps.write, character: undefined as string | undefined },
] as const

// Learning-path identity per lesson type (ramp, host, emoji) comes from
// lib/roomStyle.ts, the one source shared with lessons.tsx (values identical
// to the PATH_STYLE / PATH_STORIES this file used to hold).

const NEXTUP_STYLE: Record<'lesson' | 'review' | 'story' | 'phonics', { ramp: Ramp; character?: string }> = {
  lesson: { ramp: ramps.lessons, character: 'roozi' },
  review: { ramp: ramps.review, character: 'laki' },
  story: { ramp: ramps.stories, character: 'pashmak' },
  phonics: { ramp: ramps.phonics },
}

// Pastel card faces (the reference's lavender/peach/mint tiles) are each
// room's own bright stop mixed toward white with Clay.tsx's `lighten`, so no
// room needs a new hex.

// How far the continue card rises into the hero, and how far the page's
// rounded sheet does (the reference's white body lip behind the card).
const CARD_RISE = 56
const SHEET_RISE = 24

// A story counts as «جدید» on Home when the child has never opened it (no
// progress row) AND it was added in the last NEW_STORY_DAYS days (its real
// created_at). The 14 days is a presentation choice, not a curriculum rule,
// pending product sign-off; change it here.
const NEW_STORY_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// The hero world (2026-09-28, toward the reference): the same hills, trees
// and palette as the approved scene, under a soft sky that runs from pale
// blue into the warm cream, with far mountains, clouds and a warm glow
// behind سیمرغ. The winding road that crossed the whole sky (it read as a
// rainbow arch behind the bird) and the dot pattern are gone. Not mirrored
// (scene art, Clay.tsx rules): the app runs RTL, where سیمرغ stands at the
// LEFT, so the glow is drawn there.
//
// Text never sits on the hills (simulator, 2026-09-28: «امروز چی یاد
// بگیریم؟» ran onto the dark trees at 402pt, and ~30pt into the hills at
// 320). Two rules keep it off at every width and text size:
//  - The scene is drawn at a FIXED scale, the screen width / 400 (a
//    400x360 box pinned to the hero's bottom; a taller hero shows more flat
//    HERO_SKY above it, a shorter one crops sky at the top). Before, it was
//    slice-fit to the hero, so the hills' height moved with the hero's shape.
//  - On the text side (the right, scene x >= ~185) the hills and trees stay
//    below y ~286: a band at most HILL_BAND of the 360 units, and the
//    greeting is padded to end above that band (see greetingClear).
const HERO_SKY = '#CDEBFA'
const HILL_BAND = 78
const tree = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="34" rx="14.5" ry="3.4" fill="#0F5C4A" opacity=".13"/><rect x="-4.5" y="2" width="9" height="30" rx="4.5" fill="#8A5A24"/><circle cx="0" cy="-9" r="19" fill="#127A55"/><circle cx="-12.3" cy="0" r="11.8" fill="#0E6244"/><circle cx="11.2" cy="-1.1" r="10.6" fill="#159C69"/><circle cx="-6.7" cy="-18" r="8.4" fill="#35C08C" opacity=".55"/></g>`
const cloud = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#FFFFFF"><ellipse cx="0" cy="6" rx="38" ry="11"/><circle cx="-16" cy="-1" r="13"/><circle cx="4" cy="-7" r="17"/><circle cx="22" cy="2" r="10"/></g>`
const sparkle = (x: number, y: number, r: number, fill: string) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${fill}" opacity=".95"/>`
const HERO_SCENE_SVG = `<svg viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="kbHeroSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${HERO_SKY}"/>
      <stop offset=".56" stop-color="#FFF6E4"/>
      <stop offset="1" stop-color="#FFEFD6"/>
    </linearGradient>
    <radialGradient id="kbHeroGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFE3A3" stop-opacity=".8"/>
      <stop offset="1" stop-color="#FFE3A3" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="400" height="360" fill="url(#kbHeroSky)"/>
  <circle cx="96" cy="196" r="150" fill="url(#kbHeroGlow)"/>
  <g opacity=".92">${cloud(318, 150, 0.9)}${cloud(46, 118, 0.62)}</g>
  <g opacity=".7">${cloud(214, 92, 0.5)}</g>
  <path d="M206 118 q3.6 -2.7 7.2 0 q3.6 -2.7 7.2 0" fill="none" stroke="#B99A63" stroke-width="1.7" stroke-linecap="round" opacity=".5"/><path d="M232 106 q2.8 -2.1 5.6 0 q2.8 -2.1 5.6 0" fill="none" stroke="#B99A63" stroke-width="1.3" stroke-linecap="round" opacity=".4"/>
  ${sparkle(176, 170, 6, '#FFD98A')}${sparkle(22, 176, 4.5, '#FFFFFF')}
  <path d="M0 238 Q30 214 58 222 Q92 168 130 204 Q150 190 170 206 Q214 148 258 206 Q290 184 316 200 Q352 160 400 214 L400 360 L0 360 Z" fill="#DCE4F6"/>
  <path d="M92 190 Q100 180 110 184 L104 194 Z M226 162 Q236 150 246 162 L236 170 Z" fill="#FFFFFF" opacity=".7"/>
  <path d="M0 248 Q80 220 150 266 Q180 288 232 293 Q320 300 400 293 L400 360 L0 360 Z" fill="#CFEDE2"/>
  <path d="M0 280 Q70 254 140 286 Q220 318 400 306 L400 360 L0 360 Z" fill="#8FE2CC"/>
  ${tree(382, 318, 0.6)}${tree(358, 326, 0.48)}${tree(24, 290, 0.8)}
  <path d="M0 316 q110 -30 214 -2 q84 22 186 -10 L400 360 L0 360 Z" fill="#57D6BC"/>
  <path d="M0 340 q46 -14 88 -3 q38 10 78 -4 q44 -14 86 -1 q40 12 148 -6 L400 360 L0 360 Z" fill="#3DBFA4"/>
</svg>`

const FLAME_PATH = 'M13 2c.5 4-2 5.5-3.5 7.5C8 11.5 7 13 7 15a5 5 0 0 0 10 0c0-2.2-1-3.6-2-5-.6 1.2-1.3 1.8-2 2 .8-3-.6-7 0-10Z'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

interface NextUp { href: string; label: string; title: string; emoji: string; kind: keyof typeof NEXTUP_STYLE }

// Goal ring geometry (mockup's own numbers: r=16, stroke=6, viewBox 44x44).
const GOAL_R = 16
const GOAL_CIRC = 2 * Math.PI * GOAL_R

export default function Home() {
  const insets = useSafeAreaInsets()
  const [child, setChild] = useState<Child | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [letters, setLetters] = useState<Letter[]>([])
  const [stats, setStats] = useState({ words: 0, streak: 0, xp: 0 })
  const [reviewCount, setReviewCount] = useState(0)
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [doneLessons, setDoneLessons] = useState<Set<string>>(new Set())
  const [doneStories, setDoneStories] = useState<Set<string>>(new Set())
  const [lastLesson, setLastLesson] = useState<Lesson | null>(null)
  const [lastStory, setLastStory] = useState<Story | null>(null)
  const [recentSessions, setRecentSessions] = useState<DashboardSummary['recent_sessions']>([])
  const [showTutorial, setShowTutorial] = useState(false)
  const [reprobeDue, setReprobeDue] = useState(false)
  // A failed /api/children used to leave `child` null and the spinner up
  // forever. `reloadKey` re-runs the load from the retry button.
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Per-list failures once the page is up (Agent C, 2026-09-27): an empty
  // lessons or stories list after a FAILED request shows a retry note, never
  // the "nothing here yet" empty state, which would be a false claim.
  const [lessonsFailed, setLessonsFailed] = useState(false)
  const [storiesFailed, setStoriesFailed] = useState(false)
  // Every story with a progress row that isn't completed: the child opened it
  // and hasn't finished. Marks those covers «نیمه‌کاره» (real progress data).
  const [startedStories, setStartedStories] = useState<Set<string>>(new Set())
  // A continue-card thumbnail whose image failed to load: fall back to the
  // room's host instead of an empty box (same rule as the story covers).
  const [failedThumb, setFailedThumb] = useState<string | null>(null)

  // Record a learning session so the parent dashboard's streak/time is real.
  useChildSession(child?.id ?? null)

  // First-run walkthrough, once ever (flag in SecureStore). Checked once per
  // mount, not on every focus: the flag only changes when Tutorial itself
  // finishes (markTutorialSeen, which also updates the in-memory cache), and
  // Tutorial is a Modal, so Home can't lose focus with it half-done. The
  // tabs router.replace() Home, so each visit is a fresh mount anyway.
  // ensurePrefs() is idempotent and never rejects (lib/prefs.ts).
  useEffect(() => {
    let alive = true
    ensurePrefs().then(() => { if (alive && !hasSeenTutorial()) setShowTutorial(true) })
    return () => { alive = false }
  }, [])

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        // Every redirect below comes after an await: never navigate from a
        // Home the child has already left (the focus cleanup sets cancelled).
        if (cancelled) return
        if (!childId) { router.replace('/children'); return }
        const childRes = await api.get<Child[]>('/api/children')
        if (cancelled) return
        if (!childRes.data) { setLoadError(true); return }
        setLoadError(false)
        const active = childRes.data?.find((c) => c.id === childId)
        if (childRes.data && !active) { router.replace('/children'); return }
        // First entry for a new child → run the placement probe.
        if (active && active.placement_done === false) { router.replace('/placement'); return }
        if (!active) return

        const [lessonsRes, storiesRes, lettersRes, dashRes, reviewRes, progRes, placeRes, reprobeRes] = await Promise.all([
          api.get<Lesson[]>('/api/lessons'),
          api.get<Story[]>('/api/stories'),
          api.get<Letter[]>('/api/letters'),
          api.get<DashboardSummary>(`/api/dashboard/${active.id}`),
          api.get<ReviewItem[]>(`/api/progress/${active.id}/review`),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${active.id}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${active.id}`),
          // Checked once per session load, never polled (design doc §1/§2) — a
          // skippable game card, not an interstitial; reprobeDue never expires.
          api.get<{ due: boolean }>(`/api/placement/${active.id}/reprobe-due`),
        ])
        if (cancelled) return
        // `child` is set here, with everything else, not before the fetch:
        // setting it first rendered the whole page for ~0.5-1s with empty
        // data -- the phonics fallback continue card (orange), no path, no
        // stories, level شاگرد, no streak -- and then everything swapped at
        // once when the data landed (the reported startup "old theme"
        // flash, reproduced on the iOS Simulator 2026-09-25). Until then the
        // loading state below stays up, on the same warm background as the
        // splash and the auth gate. All of these updates land in one render.
        // On later focus refreshes `child` is already set, so the page keeps
        // showing its current data while it refetches.
        setChild(active)
        setLessonsFailed(!lessonsRes.data)
        setStoriesFailed(!storiesRes.data)
        if (lessonsRes.data) setLessons(lessonsRes.data)
        if (storiesRes.data) setStories(storiesRes.data)
        if (lettersRes.data) setLetters(lettersRes.data)
        if (dashRes.data) {
          setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
          setRecentSessions(dashRes.data.recent_sessions ?? [])
        }
        if (reviewRes.data) setReviewCount(reviewRes.data.length)
        if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
        setReprobeDue(reprobeRes.data?.due ?? false)
        if (progRes.data) {
          setDoneLessons(new Set(progRes.data.lessons.filter((l) => l.completed).map((l) => l.lesson_id)))
          setDoneStories(new Set(progRes.data.stories.filter((s) => s.completed).map((s) => s.story_id)))
          setStartedStories(new Set(progRes.data.stories.filter((s) => !s.completed).map((s) => s.story_id)))
          const lastLessonId = progRes.data.lessons.filter((l) => !l.completed).at(-1)?.lesson_id
          setLastLesson(lastLessonId ? lessonsRes.data?.find((l) => l.id === lastLessonId) ?? null : null)
          const lastStoryId = progRes.data.stories.filter((s) => !s.completed).at(-1)?.story_id
          setLastStory(lastStoryId ? storiesRes.data?.find((s) => s.id === lastStoryId) ?? null : null)
        }
      }
      // getActiveChildId() reads SecureStore, which can reject (keychain
      // unavailable); uncaught, that left the spinner up forever. A rejection
      // anywhere in load() now shows the same retry as a failed request.
      load().catch(() => { if (!cancelled) setLoadError(true) })
      return () => { cancelled = true }
    }, [reloadKey])
  )

  // The one decision the app makes FOR the child (web's nextUp).
  const nextUp = useMemo<NextUp>(() => {
    if (lastLesson) return { href: `/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, emoji: LESSON_TYPE_EMOJI[lastLesson.type] ?? '📚', kind: 'lesson' }
    if (reviewCount >= 3) return { href: '/review', label: 'مرور کلمه‌ها', title: `${toPersianDigits(reviewCount)} کلمه منتظرند`, emoji: '🔄', kind: 'review' }
    if (lastStory) return { href: `/story/${lastStory.id}`, label: 'ادامه‌ی قصه', title: lastStory.title_persian, emoji: '📖', kind: 'story' }
    const nl = lessons.find((l) => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
    if (nl) return { href: `/lesson/${nl.id}`, label: 'درس تازه', title: nl.title, emoji: LESSON_TYPE_EMOJI[nl.type] ?? '📚', kind: 'lesson' }
    const ns = stories.find((s) => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
    if (ns) return { href: `/story/${ns.id}`, label: 'قصه‌ی تازه', title: ns.title_persian, emoji: '📖', kind: 'story' }
    return { href: '/phonics', label: 'بازی صداها', title: 'زبر، زیر، پیش', emoji: '🎵', kind: 'phonics' }
  }, [lastLesson, lastStory, reviewCount, lessons, stories, strandLevels, doneLessons, doneStories])

  const nextUpStyle = NEXTUP_STYLE[nextUp.kind]

  // The card's room, picture and progress, looked up from nextUp's href
  // without touching nextUp itself (2026-09-28). Progress is the room's REAL
  // completion -- the same done/total its learning-path card shows (lessons
  // of that type; all stories) -- so the reference's bar is a true count, not
  // a position drawn as a bar. Review and phonics have no such count: no bar.
  const nextUpRoom = useMemo<{
    key: string; title: string; style: RoomStyle; thumb: string | null; done: number; total: number
  } | null>(() => {
    if (nextUp.kind === 'lesson') {
      const cur = lessons.find((l) => `/lesson/${l.id}` === nextUp.href)
      if (!cur) return null
      const peers = lessons.filter((l) => l.type === cur.type)
      return {
        key: cur.type, title: LESSON_TYPE_LABEL[cur.type] ?? cur.type, style: lessonRoomStyle(cur.type),
        thumb: thumbUrl(cur.thumbnail_url, 80) ?? null,
        done: peers.filter((l) => doneLessons.has(l.id)).length, total: peers.length,
      }
    }
    if (nextUp.kind === 'story') {
      const cur = stories.find((st) => `/story/${st.id}` === nextUp.href)
      if (!cur) return null
      return {
        key: 'stories', title: 'قصه‌ها', style: STORY_ROOM_STYLE, thumb: thumbUrl(cur.cover_url, 80) ?? null,
        done: stories.filter((st) => doneStories.has(st.id)).length, total: stories.length,
      }
    }
    return null
  }, [nextUp, lessons, stories, doneLessons, doneStories])
  const nextUpRamp = nextUpRoom?.style.ramp ?? nextUpStyle.ramp
  const nextUpCharacter = nextUpRoom ? nextUpRoom.style.character : nextUpStyle.character
  const nextUpThumb = nextUpRoom?.thumb && nextUpRoom.thumb !== failedThumb ? nextUpRoom.thumb : null
  const nextUpCount = nextUpRoom && nextUpRoom.total > 0
    ? `${toPersianDigits(nextUpRoom.done)} از ${toPersianDigits(nextUpRoom.total)}`
    : null

  // Learning path: one card per lesson type in the shared provisional order
  // (lib/lessonOrder.ts), then stories. Real done/total counts and real unlock
  // state from data this screen already loads. No step numbers or arrows:
  // the teaching order isn't decided yet, so the path must not claim one.
  const pathModules = useMemo(() => {
    const out: { key: string; href: string; title: string; ramp: Ramp; character?: string; emoji: string; done: number; total: number; locked: boolean }[] = []
    for (const type of LESSON_SECTION_ORDER) {
      const ls = lessons.filter((l) => l.type === type)
      if (ls.length === 0) continue
      out.push({
        key: type, href: '/lessons', title: LESSON_TYPE_LABEL[type] ?? type, ...LESSON_ROOM_STYLE[type],
        done: ls.filter((l) => doneLessons.has(l.id)).length, total: ls.length,
        locked: !ls.some((l) => isLessonUnlocked(l, strandLevels)),
      })
    }
    if (stories.length > 0) {
      out.push({
        key: 'stories', href: '/stories', title: 'قصه‌ها', ...STORY_ROOM_STYLE,
        done: stories.filter((s) => doneStories.has(s.id)).length, total: stories.length,
        locked: !stories.some((s) => isStoryUnlocked(s, strandLevels)),
      })
    }
    return out
  }, [lessons, stories, doneLessons, doneStories, strandLevels])

  // Stories for this child: unlocked and not finished (the same rule nextUp
  // uses), the one in progress first, never the one already on the big card.
  // Not "featured": nothing in the data curates stories, so the section
  // doesn't claim to.
  const storyPicks = useMemo(() => {
    const open = stories.filter((s) => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id) && `/story/${s.id}` !== nextUp.href)
    const current = lastStory ? open.find((s) => s.id === lastStory.id) : undefined
    return (current ? [current, ...open.filter((s) => s.id !== current.id)] : open).slice(0, 6)
  }, [stories, strandLevels, doneStories, lastStory, nextUp.href])

  // Real level from real xp (dashboard, already loaded) -- the same helper
  // and the same all-ages visibility as web's child home.
  const level = resolveLevel(stats.xp)

  // Minutes played today, same filter/sum apps/web/src/app/parent/dashboard/
  // page.tsx's heatmap already uses on `recent_sessions` — see the file doc
  // comment for the 5-session cap caveat.
  const todayMin = useMemo(() => {
    const todayStr = new Date().toDateString()
    const secs = (recentSessions ?? [])
      .filter((s) => new Date(s.started_at).toDateString() === todayStr)
      .reduce((sum, s) => sum + (s.duration_sec ?? 0), 0)
    return Math.round(secs / 60)
  }, [recentSessions])
  const goalMin = getDailyGoal()
  const goalPct = goalMin > 0 ? Math.min(1, todayMin / goalMin) : 0

  const goalText = `${toPersianDigits(todayMin)} از ${toPersianDigits(goalMin)} دقیقه`
  const { width: winW, fontScale } = useWindowDimensions()
  // Large system text (>= 130%): titles that are capped at 2 lines get a 3rd
  // instead of ending in «…» sooner.
  const bigText = fontScale >= 1.3
  // سیمرغ's size (2026-09-28, larger, as in the reference): 172 on a
  // 400pt phone, 43% of the width below that (138 at 320), and 20% smaller at
  // large text so the greeting column keeps its room.
  const heroArt = Math.round(Math.min(172, winW * 0.43) * (bigText ? 0.8 : 1))
  // Continue-card picture and arrow shrink below 360pt so the title keeps
  // ~124pt at 320 (it would have ~100pt at full size).
  const narrow = winW < 360
  const thumbSize = narrow ? 64 : 84
  const nowMs = Date.now()
  // The hero scene at a fixed scale (see HILL_BAND): its box is the screen
  // width x 0.9, and the greeting ends at least the hill band (plus a few pt)
  // above the hero's bottom, of which the hero's own paddingBottom already
  // covers CARD_RISE - 12. 402pt: 35; 320pt: 19. When سیمرغ is taller than
  // the text (most phones at default size) this changes nothing visible.
  const sceneH = Math.round(winW * 0.9)
  const greetingClear = Math.max(0, Math.ceil(HILL_BAND * (winW / 400)) - (CARD_RISE - 12))
  // Re-runs load() with the page kept on screen (`child` is already set, so
  // the loading gate doesn't come back): the per-list retry notes use it.
  const retry = () => setReloadKey((k) => k + 1)
  // Row card widths (see rowCardWidth). When every item fits at least at
  // the peek width, the cards share the row exactly (3 path cards: 111 at
  // 390, 115 at 402); otherwise peek sizing: path 112 at 320pt, 100 at
  // 390/402; stories 112 at 320, 140 at 390, 145 at 402. Large text widens
  // the path cards: a title is one word («آواشناسی») that can't wrap, so it
  // shrinks to fit instead of breaking mid-word or ending in «…»
  // (numberOfLines 1 + adjustsFontSizeToFit).
  const pathW = bigText
    ? rowCardWidth(winW, pathModules.length, 124, 156)
    : rowCardWidth(winW, pathModules.length, 100, 124)
  const storyW = rowCardWidth(winW, storyPicks.length, 112, 156)

  if (!child) {
    return (
      <ScreenBackground variant="warm">
        {loadError ? (
          <>
            <View style={[styles.state, { paddingTop: insets.top }]}>
              <CharacterArt character="simorgh" emotion="encouraging" size={120} />
              <Text style={styles.stateTitle}>نتونستیم صفحه رو بیاریم</Text>
              <Text style={styles.stateBody}>اینترنت رو نگاه کن و دوباره امتحان کن.</Text>
              <ClayButton
                ramp={ramps.brand}
                label="دوباره امتحان کن"
                onPress={() => { setLoadError(false); setReloadKey((k) => k + 1) }}
                style={styles.stateButton}
              />
            </View>
            <BottomNav current="home" />
          </>
        ) : (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
          </View>
        )}
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {showTutorial && <Tutorial childName={child.name} onClose={() => setShowTutorial(false)} />}

        {/* 1. Hero: the illustrated world, full-bleed under the status bar,
            with the brand, the child and سیمرغ. Text sits at the reading start
            (a row: first child = right under RTL); سیمرغ at the end, larger
            and a little higher than before, so he fills the sky beside the
            greeting as in the reference. The bottom CARD_RISE of the hero is
            where the continue card and the page's sheet overlap it. */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          {/* The wrapper is what fills the hero: SvgXml's own width/height
              props override absoluteFill and resolved to the hero's padded
              content box (~370x215 on a 402pt phone), leaving the lower
              third and the start-side strip without art (seen on iOS). */}
          <View style={[styles.heroScene, { height: sceneH }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SvgXml xml={HERO_SCENE_SVG} width="100%" height="100%" preserveAspectRatio="xMidYMax slice" />
          </View>
          <View style={styles.heroTop}>
            {/* The approved wordmark, unchanged in look (one step larger). A
                logotype, so its Dynamic Type growth is capped (WCAG 1.4.4
                exempts logos): at 200% it pushed the avatar off a 320pt row. */}
            <Text style={styles.wordmark} numberOfLines={1} maxFontSizeMultiplier={1.3} accessibilityLabel="کودک‌بوک">کودک‌بوک</Text>
            {/* The child's corner, on one white pill (the reference's
                header pill): streak (8+) and the switch-child avatar. */}
            <View style={styles.headerEnd}>
              {childAge(child) > 7 && stats.streak > 0 && (
                <View style={styles.streakPill} accessible accessibilityLabel={`${toPersianDigits(stats.streak)} روز پشت سر هم`}>
                  <Svg viewBox="0 0 24 24" width={16} height={16}>
                    <Path d={FLAME_PATH} fill={ramps.phonics.ink} stroke={ramps.phonics.deep} strokeWidth={1.3} />
                  </Svg>
                  <Text style={styles.streakText} maxFontSizeMultiplier={1.3}>{toPersianDigits(stats.streak)}</Text>
                </View>
              )}
              <Pressable
                onPress={() => router.replace('/children')}
                hitSlop={8}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${child.name}، عوض کردن کودک`}
              >
                {mediaUrl(child.avatar_url) ? (
                  <Image source={{ uri: mediaUrl(child.avatar_url)! }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarInitial} maxFontSizeMultiplier={1.2}>{child.name?.[0] ?? '🧒'}</Text>
                )}
              </Pressable>
            </View>
          </View>
          <View style={styles.heroMain}>
            {/* One heading stop for the three lines, read as one sentence. */}
            <View
              style={[styles.greeting, { paddingBottom: greetingClear }]}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${greeting()}، ${child.name}! امروز چی یاد بگیریم؟`}
            >
              <Text style={styles.hi}>{greeting()}</Text>
              <Text style={styles.name} numberOfLines={2}>{child.name}!</Text>
              <Text style={styles.heroLine}>امروز چی یاد بگیریم؟</Text>
            </View>
            <View style={styles.heroArt}>
              <CharacterArt character="simorgh" emotion="happy" size={heroArt} />
            </View>
          </View>
        </View>

        {/* The page's sheet: a rounded, lighter body that rises over the
            hills (the reference's white lip behind the continue card). */}
        <View style={[styles.body, { paddingBottom: insets.bottom + 96 }]}>
          {/* 2. THE action: nextUp, one tap target, ALWAYS the shared deep
              indigo DeepActionCard (Clay.tsx; deepAction in theme.ts) --
              whatever nextUp is. White text only on that deep face. */}
          <DeepActionCard
            style={styles.continueWrap}
            onPress={() => router.push(nextUp.href)}
            accessibilityLabel={`${nextUp.label}: ${nextUp.title}${nextUpRoom && nextUpCount ? `، ${nextUpRoom.title}، ${nextUpCount} تمام شده` : ''}`}
            eyebrow={nextUp.label}
            title={nextUp.title}
            subtitle={nextUpRoom && nextUpCount ? nextUpRoom.title : undefined}
            progress={nextUpRoom && nextUpRoom.total > 0 ? { done: nextUpRoom.done, total: nextUpRoom.total } : undefined}
            titleLines={bigText ? 3 : 2}
            compact={narrow}
            thumbSize={thumbSize}
            thumbnail={
              // The room's own pastel behind its picture, so the card still
              // says which room it is while the card itself stays indigo.
              <View style={[styles.thumbFill, { backgroundColor: lighten(nextUpRamp.bright, 0.55) }]}>
                {nextUpThumb ? (
                  <Image
                    source={{ uri: nextUpThumb }}
                    style={{ width: thumbSize, height: thumbSize }}
                    contentFit="cover"
                    onError={() => setFailedThumb(nextUpThumb)}
                  />
                ) : nextUpCharacter ? (
                  <CharacterArt character={nextUpCharacter} emotion="encouraging" size={thumbSize - 8} />
                ) : (
                  <Text style={styles.thumbEmoji} maxFontSizeMultiplier={1}>{nextUp.emoji}</Text>
                )}
              </View>
            }
          />

          {/* 3. Learning path (see pathModules): pastel room tiles in each
              room's own colour, its host, and one of three states -- done (a
              ✓ badge, full bar), the room nextUp is in (a ring and a ▶
              badge), or locked (a lock and «هنوز قفل», never faded). Still
              unnumbered: the teaching order isn't decided. The row bleeds to
              the screen edges (hScroll) and starts at the heading's inset. */}
          <View style={styles.section}>
            <SectionRow title="مسیر یادگیری" allLabel="همه‌ی درس‌ها" onAll={() => router.push('/lessons')} />
            {lessonsFailed && lessons.length === 0 && (
              <NoteCard ramp={ramps.lessons} character="roozi" text="نتونستیم درس‌ها رو بیاریم." action={{ label: 'دوباره امتحان کن', onPress: retry }} />
            )}
            {pathModules.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow}>
                {pathModules.map((m, i) => {
                  const complete = !m.locked && m.total > 0 && m.done === m.total
                  const current = !m.locked && !complete && m.key === nextUpRoom?.key
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => router.push(m.href)}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.locked
                        ? `${m.title}، هنوز قفل است`
                        : `${m.title}، ${toPersianDigits(m.done)} از ${toPersianDigits(m.total)} تمام شده${complete ? '، همه تمام شده' : ''}${current ? '، درس بعدی از اینجاست' : ''}`}${itemOf(i, pathModules.length)}`}
                    >
                      {({ pressed }) => (
                        <ClaySurface
                          ramp={m.ramp} tone="soft" pressed={pressed} selected={current} radius={radii.md} style={styles.fill}
                          faceStyle={[styles.pathFace, { width: pathW, backgroundColor: lighten(m.ramp.bright, 0.74) }]}
                        >
                          <View>
                            <HostAvatar ramp={m.ramp} size={64} character={m.character} emoji={m.emoji} />
                            {(complete || current) && (
                              <View style={[styles.pathBadge, { backgroundColor: m.ramp.deep }]}>
                                <Icon name={complete ? 'check' : 'play'} color={ui.onDeep} size={12} strokeWidth={3} />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.pathTitle, { color: m.ramp.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{m.title}</Text>
                          {m.locked ? (
                            <View style={styles.lockedRow}>
                              <Icon name="lock" color={ui.lockedText} size={14} />
                              <Text style={styles.pathMeta}>هنوز قفل</Text>
                            </View>
                          ) : (
                            <>
                              {/* White track on the pastel, the room's deep fill;
                                  decorative: the card's label says the count. */}
                              <ProgressTrack value={m.done} total={m.total || 1} ramp={m.ramp} trackColor={ui.surface} decorative style={styles.pathTrack} />
                              <Text style={styles.pathMeta}>{toPersianDigits(m.done)} از {toPersianDigits(m.total)}</Text>
                            </>
                          )}
                        </ClaySurface>
                      )}
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : !lessonsFailed ? (
              <NoteCard ramp={ramps.lessons} character="roozi" text="هنوز درسی اینجا نیست." />
            ) : null}
          </View>

          {/* 4. Stories for this child (see storyPicks): the real cover, or
              the story's scene (the same pick as the stories screen) when it
              has none or the image fails. Badges from real data only:
              «نیمه‌کاره» = opened, not finished; «جدید» = never opened and
              added in the last NEW_STORY_DAYS days. «صوتی» only when the
              story has narration (audio_url). No durations: none in the data.
              No stories to show is a designed note, a failed load a retry. */}
          <View style={styles.section}>
            <SectionRow title="قصه‌هایی برای تو" allLabel="همه‌ی قصه‌ها" onAll={() => router.push('/stories')} />
            {storyPicks.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow}>
                {storyPicks.map((st, i) => {
                  const started = startedStories.has(st.id)
                  const added = Date.parse(st.created_at)
                  const fresh = !started && Number.isFinite(added) && nowMs - added < NEW_STORY_DAYS * DAY_MS
                  const audio = !!st.audio_url
                  return (
                    <Pressable
                      key={st.id}
                      onPress={() => router.push(`/story/${st.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`قصه: ${st.title_persian}${started ? '، نیمه‌کاره' : ''}${fresh ? '، جدید' : ''}${audio ? '، صوتی' : ''}${itemOf(i, storyPicks.length)}`}
                    >
                      {({ pressed }) => (
                        <ClaySurface
                          ramp={ramps.stories} tone="soft" pressed={pressed} radius={radii.md} edge={clay.edgeSm}
                          style={[styles.fill, styles.cardShadow]} faceStyle={[styles.storyFace, { width: storyW }]}
                        >
                          <View style={styles.storyCover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                            <StoryCoverArt story={st} />
                            {(started || fresh) && (
                              // A row, so the badge sits at the reading start (right).
                              <View style={styles.badgeRow} pointerEvents="none">
                                <View style={[styles.badge, fresh && styles.badgeNew]}>
                                  <Text style={[styles.badgeText, fresh && styles.badgeNewText]} maxFontSizeMultiplier={1.3}>{fresh ? 'جدید' : 'نیمه‌کاره'}</Text>
                                </View>
                              </View>
                            )}
                            {/* The play badge at the reading END (logical
                                `end`: the bottom-left under RTL), as on the
                                stories screen. Play is never mirrored. */}
                            <View style={styles.playBadge} pointerEvents="none">
                              <PlayBadge size={32} color={ramps.stories.deep} />
                            </View>
                          </View>
                          <View style={styles.storyBody}>
                            <Text style={styles.storyTitle} numberOfLines={bigText ? 3 : 2}>{st.title_persian}</Text>
                            {audio && (
                              <View style={styles.storyMeta}>
                                <Icon name="volume" color={ui.textMuted} size={14} />
                                <Text style={styles.storyMetaText}>صوتی</Text>
                              </View>
                            )}
                          </View>
                        </ClaySurface>
                      )}
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : storiesFailed && stories.length === 0 ? (
              <NoteCard ramp={ramps.stories} character="pashmak" text="نتونستیم قصه‌ها رو بیاریم." action={{ label: 'دوباره امتحان کن', onPress: retry }} />
            ) : (
              // Stories exist but none is open right now (all read, the only
              // open one is on the big card, or the rest are locked), or
              // there are none yet. Both sentences are true in their case.
              <NoteCard
                ramp={ramps.stories}
                character="pashmak"
                text={stories.length === 0 ? 'هنوز قصه‌ای اینجا نیست.' : 'فعلاً قصه‌ی تازه‌ی دیگه‌ای نیست.'}
              />
            )}
          </View>

          {/* 5. Progress: the reference's reward card, from real data only --
              the level from real xp (resolveLevel), its real bar and «N
              امتیاز تا سطح بعد»; the cheer praises only when xp > 0. Then
              today's goal (real minutes against the family's real setting),
              quieter than before (soft, not saffron). */}
          <View style={styles.section}>
            <SectionHeading title="پیشرفت من" />
            <Pressable
              onPress={() => router.push('/rewards')}
              accessibilityRole="button"
              accessibilityLabel={level.isMax
                ? `سطح ${level.label}، بالاترین سطح. جایزه‌ها`
                : `سطح ${level.label}، ${toPersianDigits(level.toNext)} امتیاز تا سطح بعد. جایزه‌ها`}
            >
              {({ pressed }) => (
                <ClaySurface ramp={ramps.rewards} tone="soft" pressed={pressed} radius={radii.lg} style={styles.cardShadow} faceStyle={styles.rewardFace}>
                  {/* The gift sits on the star disc's corner (not at the card's
                      end), so the text column keeps the width: the cheer used
                      to wrap to a lone «می‌ری.» on a 402pt phone. */}
                  <View>
                    <View style={styles.starDisc}>
                      <RewardStar size={48} />
                    </View>
                    <View style={styles.giftCorner}>
                      <GiftBox size={28} />
                    </View>
                  </View>
                  <View style={styles.rewardText}>
                    {/* Two deliberate lines, never one that breaks by chance. */}
                    {stats.xp > 0 ? (
                      <>
                        <Text style={styles.rewardCheer}>آفرین {child.name}!</Text>
                        <Text style={styles.rewardCheerSub}>داری جلو می‌ری.</Text>
                      </>
                    ) : (
                      <Text style={styles.rewardCheer}>امتیاز جمع کن!</Text>
                    )}
                    <Text style={styles.rewardLevel}>سطح: {level.label}</Text>
                    <ProgressTrack value={level.pct / 100} ramp={ramps.rewards} trackColor={lighten(ramps.rewards.bright, 0.6)} decorative style={styles.pathTrack} />
                    <Text style={styles.rewardMeta}>
                      {level.isMax ? 'بالاترین سطح!' : `${toPersianDigits(level.toNext)} امتیاز تا سطح بعد`}
                    </Text>
                  </View>
                  <Icon name="chevron" color={ramps.rewards.ink} size={20} strokeWidth={2.4} />
                </ClaySurface>
              )}
            </Pressable>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`هدف امروز: ${goalText}`}
              accessibilityValue={{ min: 0, max: goalMin, now: Math.min(todayMin, goalMin) }}
            >
              <ClaySurface ramp={ramps.brand} tone="soft" radius={radii.md} edge={clay.edgeSm} faceStyle={styles.goalFace}>
                <Svg viewBox="0 0 44 44" width={40} height={40}>
                  <Circle cx={22} cy={22} r={GOAL_R} fill="none" stroke={ramps.brand.bright} strokeWidth={6} opacity={0.35} />
                  <Circle
                    cx={22} cy={22} r={GOAL_R} fill="none" stroke={ramps.brand.deep} strokeWidth={6} strokeLinecap="round"
                    strokeDasharray={`${GOAL_CIRC * goalPct} ${GOAL_CIRC}`}
                    rotation={-90} origin="22, 22"
                  />
                </Svg>
                <View style={styles.goalText}>
                  <Text style={styles.goalLabel}>هدف امروز</Text>
                  <Text style={styles.goalValue}>{goalText}</Text>
                </View>
              </ClaySurface>
            </View>
          </View>

          {/* 6. Alphabet: tap to hear, hosted by بومی. */}
          {letters.length > 0 && (
            <View style={styles.section}>
              <View style={styles.hostedHeading}>
                <HostAvatar ramp={ramps.letters} size={52} character="boomi" />
                <SectionHeading eyebrow="ضربه بزن و بشنو" title="الفبا" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={styles.hRow}>
                {letters.map((l, i) => (
                  <Pressable
                    key={l.id}
                    onPress={() => playClip(l.audio_url)}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.name_persian}، بشنو${itemOf(i, letters.length)}`}
                  >
                    {({ pressed }) => (
                      <ClaySurface ramp={ramps.letters} tone="soft" pressed={pressed} radius={radii.md} edge={clay.edgeSm} style={styles.fill} faceStyle={styles.letterFace}>
                        {/* Already 36pt: capped so large text doesn't blow the
                            glyph past its tile; the name below still scales. */}
                        <Text style={styles.letterChar} maxFontSizeMultiplier={1.25}>{l.character}</Text>
                        <Text style={styles.letterName} numberOfLines={1}>{l.name_persian}</Text>
                      </ClaySurface>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 7. Every room, as before (the review room now shows its count). */}
          <View style={styles.section}>
            <SectionHeading eyebrow="هر کدوم یک دوست داره" title="دوستات منتظرتن" />
            <View style={styles.grid}>
              {TILES.map((tile) => (
                <ModuleCard
                  key={tile.key}
                  title={tile.title}
                  sub={tile.key === 'review' && reviewCount > 0
                    ? `${toPersianDigits(reviewCount)} کلمه منتظرند`
                    : tile.character ? `${HOST_NAME[tile.character]} راهنماته` : undefined}
                  ramp={tile.ramp}
                  character={tile.character}
                  emoji={tile.emoji}
                  onPress={() => router.push(tile.href)}
                />
              ))}
              {/* Re-placement's entry point — سیمرغ by name, so سیمرغ hosts it. */}
              {reprobeDue && (
                <ModuleCard
                  title="بازی سیمرغ"
                  ramp={ramps.rewards}
                  character="simorgh"
                  onPress={() => router.push('/placement?mode=reprobe')}
                />
              )}
            </View>
          </View>

          {/* 8. Parent area. The SAME gate as BottomNav's door: HoldToParent's
              ~0.7s press-and-hold, then the PIN. A tap does nothing but show
              the hint, so this card is no easier for a child than the door.
              Quiet lavender (the reference's parent card), flat -- no clay,
              no character -- so it never competes with the continue card. */}
          <HoldToParent style={styles.parentCard} accessibilityLabel="بخش والدین، گزارش پیشرفت و تنظیمات، با پین">
            <View style={styles.parentRow}>
              <ParentLock size={52} />
              <View style={styles.parentText}>
                <Text style={styles.parentTitle}>بخش والدین</Text>
                {/* What's behind the door (parent/progress, parent/settings). */}
                <Text style={styles.parentSub}>گزارش پیشرفت و تنظیمات</Text>
                <View style={styles.parentPillRow}>
                  <View style={styles.parentPill}>
                    <Icon name="lock" color={ramps.review.ink} size={12} strokeWidth={2.4} />
                    <Text style={styles.parentHold}>برای ورود نگه دارید · با پین</Text>
                  </View>
                </View>
              </View>
              <Icon name="chevron" color={ramps.review.ink} size={20} strokeWidth={2.4} />
            </View>
          </HoldToParent>
        </View>
      </ScrollView>
      <BottomNav current="home" />
    </ScreenBackground>
  )
}

/** Section title with a "همه ›" (see all) link at the row's end. The link's
 *  spoken name is its destination («همه‌ی قصه‌ها»), and it is at least
 *  44x44 before hitSlop. The title shrinks (wraps) first at large text. */
function SectionRow({ title, allLabel, onAll }: { title: string; allLabel: string; onAll: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTitle}>
        <SectionHeading title={title} />
      </View>
      <Pressable onPress={onAll} hitSlop={8} style={styles.allLink} accessibilityRole="link" accessibilityLabel={allLabel}>
        {({ pressed }) => (
          <>
            <Text style={[styles.allText, pressed && styles.allPressed]}>همه</Text>
            <Icon name="chevron" color={scenery.ink} size={16} strokeWidth={2.6} />
          </>
        )}
      </Pressable>
    </View>
  )
}

/** Same scene pick as the stories screen (app/stories.tsx sceneFor), so a
 *  story without a cover looks the same on both screens. */
function sceneFor(id: string): SceneSlug {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SCENE_SLUGS[h % SCENE_SLUGS.length]
}

/** A story's own cover, or its scene when it has none OR the image fails to
 *  load (a broken URL used to leave a pale empty box). Never made-up art. */
function StoryCoverArt({ story }: { story: Story }) {
  const uri = thumbUrl(story.cover_url, 200)
  const [failedUri, setFailedUri] = useState<string | null>(null)
  if (!uri || failedUri === uri) return <SceneBackdrop scene={sceneFor(story.id)} style={styles.storyScene} />
  return <Image source={{ uri }} style={styles.storyCoverImage} contentFit="cover" transition={150} onError={() => setFailedUri(uri)} />
}

/** A section's designed empty or error state: the section's host (thinking =
 *  waiting), one honest sentence, and a retry for errors. Soft fill with a
 *  dashed rim, so it reads as "nothing here right now", not a card to open
 *  and not a broken, blank section. */
function NoteCard({ ramp, character, text, action }: {
  ramp: Ramp
  character: string
  text: string
  action?: { label: string; onPress: () => void }
}) {
  return (
    <View style={[styles.note, { backgroundColor: ramp.soft, borderColor: ramp.bright }]}>
      <HostAvatar ramp={ramp} size={48} character={character} emotion="thinking" />
      <View style={styles.noteText}>
        <Text style={[styles.noteBody, { color: ramp.ink }]} accessibilityLiveRegion={action ? 'polite' : undefined}>{text}</Text>
        {action && (
          <Pressable onPress={action.onPress} hitSlop={4} style={styles.noteAction} accessibilityRole="button">
            <Text style={[styles.noteActionText, { color: ramp.ink }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

/** Width for the cards of a horizontal row (they scroll edge to edge, see
 *  hScroll) so the last card in view is cut at about half at the screen edge,
 *  the cue that the row scrolls, at every phone width. With a fixed 120 a
 *  402pt phone showed exactly three whole path cards and nothing after them,
 *  which reads as "that's all". Picks the width in [minW, maxW] whose cut is
 *  closest to half; ties go to the wider card. */
function peekCardWidth(visible: number, minW: number, maxW: number) {
  let best = maxW
  let bestScore = Infinity
  for (let w = maxW; w >= minW; w--) {
    const pitch = w + GAP
    const cut = visible - Math.floor(visible / pitch) * pitch
    const score = cut < w ? Math.abs(cut / w - 0.5) : 1
    if (score < bestScore) { best = w; bestScore = score }
  }
  return best
}

/** A row's card width. If all `n` cards fit between the two 16pt insets at
 *  no less than the peek width, they fill the row exactly (equal widths, the
 *  same gaps; floored, so at most n-1 pt goes to the end inset) -- a short
 *  row must not end in an empty strip (iOS 402pt, 3 path cards at 100pt left
 *  ~70pt bare, 2026-09-27). Otherwise the row scrolls: peekCardWidth. */
function rowCardWidth(winW: number, n: number, minW: number, maxW: number) {
  const peek = peekCardWidth(winW - spacing.md, minW, maxW)
  if (n < 1) return peek
  const fit = Math.floor((winW - 2 * spacing.md - (n - 1) * GAP) / n)
  return fit >= peek ? fit : peek
}

/** A horizontal row item's position for screen readers («، مورد ۲ از ۶»).
 *  "مورد" (item), never "مرحله" (step): the path's order isn't decided. */
function itemOf(i: number, n: number) {
  return n > 1 ? `، مورد ${toPersianDigits(i + 1)} از ${toPersianDigits(n)}` : ''
}

// The rhythm between sibling items inside a section (cards in a row, heading
// to content): 12, between the scale's 8 and 16.
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  // flexGrow: a short page still ends in the sheet, not in bare gradient.
  scrollContent: { flexGrow: 1 },
  // The sheet: rises SHEET_RISE over the hero's hills with the reference's
  // rounded lip, on ui.surfaceSoft (the page gradient's lightest stop).
  body: {
    flexGrow: 1, marginTop: -SHEET_RISE, paddingHorizontal: spacing.md, gap: spacing.lg,
    backgroundColor: ui.surfaceSoft, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
  },
  section: { gap: GAP },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { flexShrink: 1 },
  allLink: {
    minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingHorizontal: spacing.xs,
  },
  allText: { fontFamily: fonts.bold, fontSize: textSize.small, color: scenery.ink },
  allPressed: { opacity: 0.6 },
  // Horizontal rows run edge to edge (cancelling body's inset) and start at
  // the same 16pt inset as the headings, at both ends. paddingVertical:
  // room for the active path card's ring and the cards' soft shadow.
  hScroll: { marginHorizontal: -spacing.md },
  hRow: { gap: GAP, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  // A row stretches its items to the tallest one, but ClaySurface doesn't
  // fill its Pressable on its own: without `fill` (and flex: 1 on the face)
  // a locked path card (no progress bar) or a one-line story title ends
  // 14-23pt above its neighbours. Same pattern as ModuleCard's grid.
  fill: { flex: 1 },
  cardShadow: elevation.card,

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  stateTitle: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: scenery.ink, textAlign: 'center' },
  // colors.text, not muted: muted drops to ~4.4:1 at the gradient's darker end.
  stateBody: { fontFamily: fonts.regular, fontSize: textSize.small, color: colors.text, textAlign: 'center' },
  stateButton: { width: '100%', maxWidth: 320 },

  // Hero: the bottom (CARD_RISE - 12) is where the card and sheet overlap
  // it; سیمرغ's feet end 12pt behind the card's top edge, as in the
  // reference, and the greeting always ends above it.
  hero: { minHeight: 280, paddingHorizontal: spacing.md, paddingBottom: CARD_RISE - 12, overflow: 'hidden', backgroundColor: HERO_SKY },
  // Pinned to the hero's bottom at a fixed aspect (height set inline).
  heroScene: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  wordmark: { fontFamily: fonts.display, fontSize: textSize.h2, color: ramps.brand.ink, flexShrink: 1 },
  headerEnd: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, padding: spacing.xs,
    borderRadius: radii.pill, backgroundColor: ui.surface, ...elevation.raised,
  },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 40, paddingHorizontal: GAP,
    borderRadius: radii.pill, backgroundColor: ramps.phonics.soft, borderWidth: 2, borderColor: ramps.phonics.bright,
  },
  streakText: { fontFamily: fonts.bold, fontSize: textSize.small, color: ramps.phonics.ink },
  avatarButton: {
    width: 44, height: 44, borderRadius: radii.pill, backgroundColor: ramps.stories.soft,
    borderWidth: 3, borderColor: ramps.stories.bright, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarPressed: { opacity: 0.7 },
  avatar: { width: 44, height: 44 },
  avatarInitial: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: ramps.stories.ink },
  heroMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  greeting: { flex: 1, paddingTop: spacing.md },
  // Rises a little beside the header pill (the art has headroom above the
  // crest), so the big bird doesn't make the hero taller.
  heroArt: { marginTop: -spacing.sm },
  // Hero text is colors.text / scenery.ink, never muted: depending on the
  // status-bar height and text size any line can land over the hills, where
  // muted measures 2.28:1 (colors.text >= 5.62:1 on every sky and hill band;
  // >= 10:1 on the new pale-blue sky).
  hi: { fontFamily: fonts.medium, fontSize: textSize.small, color: colors.text, textAlign: textStart },
  name: { fontFamily: fonts.display, fontSize: textSize.h1, lineHeight: naturalLineHeight(textSize.h1), color: scenery.ink, textAlign: textStart },
  heroLine: { fontFamily: fonts.medium, fontSize: textSize.small, color: colors.text, textAlign: textStart },

  continueWrap: { marginTop: -(CARD_RISE - SHEET_RISE) },
  // Fills DeepActionCard's clipped thumbnail square with the room's pastel.
  thumbFill: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: textSize.h1 },

  pathFace: { flex: 1, padding: GAP, paddingTop: spacing.md - 2, alignItems: 'center', gap: spacing.xs + 2 },
  // On the host disc's bottom end corner (logical `end`).
  pathBadge: {
    position: 'absolute', bottom: -2, end: -2, width: 24, height: 24, borderRadius: radii.pill,
    borderWidth: 2, borderColor: ui.surface, alignItems: 'center', justifyContent: 'center',
  },
  pathTitle: { fontFamily: fonts.display, fontSize: textSize.small, textAlign: 'center' },
  // White on the pastel face: the unfilled part reads clearly, the room's
  // deep stop fills it.
  pathTrack: { alignSelf: 'stretch' },
  // ui.textMuted: >= 5.2:1 on every pastel face (colors.muted is not
  // measured for them).
  pathMeta: { fontFamily: fonts.medium, fontSize: textSize.caption, color: ui.textMuted },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  storyFace: { flex: 1, backgroundColor: ui.surface },
  storyCover: { height: 104, alignItems: 'center', justifyContent: 'center', backgroundColor: ramps.stories.soft },
  storyCoverImage: { width: '100%', height: 104 },
  storyScene: { width: '100%', height: 104, borderRadius: 0 },
  storyBody: { padding: GAP, paddingTop: spacing.sm, gap: 2 },
  storyTitle: { fontFamily: fonts.bold, fontSize: textSize.small, color: scenery.ink, textAlign: textStart },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  storyMetaText: { fontFamily: fonts.medium, fontSize: textSize.caption, color: ui.textMuted },
  badgeRow: { position: 'absolute', top: spacing.sm, left: 0, right: 0, paddingHorizontal: spacing.sm, flexDirection: 'row' },
  badge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill,
    backgroundColor: colors.card, borderWidth: 2, borderColor: ramps.stories.bright,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: textSize.micro, color: ramps.stories.ink },
  // «جدید»: the reference's green pill; white on lessons.deep is 7.3:1.
  badgeNew: { backgroundColor: ramps.lessons.deep, borderColor: ramps.lessons.deep },
  badgeNewText: { color: ui.onDeep },
  playBadge: { position: 'absolute', bottom: spacing.sm - 2, end: spacing.sm - 2 },

  rewardFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP + 2 },
  // The reference's warm disc behind the star.
  starDisc: {
    width: 60, height: 60, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: ramps.brand.soft, borderWidth: 3, borderColor: ramps.rewards.bright,
  },
  rewardText: { flex: 1, gap: spacing.xs },
  rewardCheer: { fontFamily: fonts.display, fontSize: textSize.small, color: ramps.rewards.ink, textAlign: textStart },
  rewardLevel: { fontFamily: fonts.bold, fontSize: textSize.caption, color: ramps.rewards.ink, textAlign: textStart },
  rewardMeta: { fontFamily: fonts.medium, fontSize: textSize.caption, color: ui.textMuted, textAlign: textStart },
  rewardCheerSub: { fontFamily: fonts.medium, fontSize: textSize.small, color: ramps.rewards.ink, textAlign: textStart },
  // Bottom end corner of the star disc (logical `end`).
  giftCorner: { position: 'absolute', bottom: -6, end: -8 },

  goalFace: { minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: GAP },
  goalText: { flexShrink: 1 },
  goalLabel: { fontFamily: fonts.bold, fontSize: textSize.caption, color: ramps.brand.ink, textAlign: textStart },
  goalValue: { fontFamily: fonts.display, fontSize: textSize.small, color: ramps.brand.ink, textAlign: textStart },

  // Host disc first in the row = the reading start under RTL.
  hostedHeading: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  // Minimums, not fixed sizes: the name under the glyph scales with system
  // text, and a fixed 88pt box clipped it at large sizes.
  letterFace: { flex: 1, minWidth: 72, minHeight: 88, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', gap: 2 },
  // The glyph being taught is content, not UI text, so it sits outside the
  // type ladder; Vazirmatn bold, never the display cut (theme.ts `fonts`).
  // naturalLineHeight: 56 in the 88pt tile (glyph 56 + gap 2 + name 17 = 75).
  letterChar: { fontFamily: fonts.bold, fontSize: 36, lineHeight: naturalLineHeight(36), color: ramps.letters.ink },
  letterName: { fontFamily: fonts.regular, fontSize: textSize.micro, color: colors.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },

  // HoldToParent centres its button; stretch overrides that to full width,
  // and alignItems 'stretch' lets the row below lay out normally. The
  // reference's lavender: review.soft face, a light review rim.
  parentCard: {
    alignSelf: 'stretch', alignItems: 'stretch', borderRadius: radii.lg, padding: spacing.md,
    backgroundColor: ramps.review.soft, borderWidth: 1.5, borderColor: lighten(ramps.review.bright, 0.55),
  },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  parentText: { flex: 1, gap: 2 },
  parentTitle: { fontFamily: fonts.bold, fontSize: textSize.body, color: ramps.review.ink, textAlign: textStart },
  parentSub: { fontFamily: fonts.regular, fontSize: textSize.caption, color: ui.textMuted, textAlign: textStart },
  // A row, so the pill sits at the reading start and only as wide as its text.
  parentPillRow: { flexDirection: 'row', marginTop: spacing.xs },
  parentPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1,
    paddingHorizontal: GAP, paddingVertical: spacing.xs, borderRadius: radii.pill, backgroundColor: lighten(ramps.review.bright, 0.72),
  },
  parentHold: { fontFamily: fonts.bold, fontSize: textSize.caption, color: ramps.review.ink, textAlign: textStart, flexShrink: 1 },

  note: {
    flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP,
    borderRadius: radii.md, borderWidth: 2, borderStyle: 'dashed',
  },
  noteText: { flex: 1 },
  noteBody: { fontFamily: fonts.bold, fontSize: textSize.small, textAlign: textStart },
  noteAction: { minHeight: 44, justifyContent: 'center' },
  noteActionText: { fontFamily: fonts.display, fontSize: textSize.small, textDecorationLine: 'underline', textAlign: textStart },
})
