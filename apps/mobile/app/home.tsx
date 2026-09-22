import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, SvgXml } from 'react-native-svg'
import type {
  Child, DashboardSummary, Lesson, Letter, ReviewItem, Story, StrandLevels,
} from '@koodakbook/shared'
import {
  ALL_UNLOCKED, LESSON_TYPE_EMOJI, isLessonUnlocked, isStoryUnlocked,
  toPersianDigits,
} from '@koodakbook/shared'
import ScreenBackground from '@/components/ScreenBackground'
import Tutorial from '@/components/Tutorial'
import ModuleCard from '@/components/ModuleCard'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { childAge } from '@/lib/math'
import { mediaUrl } from '@/lib/media'
import { ensurePrefs, getDailyGoal, hasSeenTutorial } from '@/lib/prefs'
import { playClip } from '@/lib/sound'
import { useChildSession } from '@/lib/useChildSession'
import { characterSvg } from '@/lib/characterSvg'
import { colors, fonts, ramps, scenery, type Ramp } from '@/lib/theme'
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

// The continue-card's colour + host by what nextUp actually is.
const NEXTUP_STYLE: Record<'lesson' | 'review' | 'story' | 'phonics', { ramp: Ramp; character?: string }> = {
  lesson: { ramp: ramps.lessons, character: 'roozi' },
  review: { ramp: ramps.review, character: 'laki' },
  story: { ramp: ramps.stories, character: 'pashmak' },
  phonics: { ramp: ramps.phonics },
}

// The mockup's story-card background scene, reused verbatim (var(--token)
// resolved to literal hex, same reasoning as LaunchScreen's SCENE_SVG) so
// the illustration is pixel-sourced from the mockup rather than redrawn.
// The mockup's own module-progress road tint and locked/checkmark level
// nodes are left out here -- see the file doc comment above.
const CONTINUE_SCENE_SVG = `<svg viewBox="0 0 354 224" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="354" height="224" fill="#FFF8EA"/>
  <rect x="0" y="98" width="354" height="126" fill="#FFEFD6"/>
  <defs><pattern id="kbDotsM" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#E8B765" opacity=".16"/></pattern></defs><rect x="0" y="0" width="354" height="110" fill="url(#kbDotsM)"/>
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

  // Record a learning session so the parent dashboard's streak/time is real.
  useChildSession(child?.id ?? null)

  // First-run walkthrough, once ever (flag in SecureStore).
  useFocusEffect(
    useCallback(() => {
      ensurePrefs().then(() => { if (!hasSeenTutorial()) setShowTutorial(true) })
    }, [])
  )

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const childRes = await api.get<Child[]>('/api/children')
        if (cancelled) return
        const active = childRes.data?.find((c) => c.id === childId)
        if (childRes.data && !active) { router.replace('/children'); return }
        // First entry for a new child → run the placement probe.
        if (active && active.placement_done === false) { router.replace('/placement'); return }
        if (!active) return
        setChild(active)

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
          const lastLessonId = progRes.data.lessons.filter((l) => !l.completed).at(-1)?.lesson_id
          setLastLesson(lastLessonId ? lessonsRes.data?.find((l) => l.id === lastLessonId) ?? null : null)
          const lastStoryId = progRes.data.stories.filter((s) => !s.completed).at(-1)?.story_id
          setLastStory(lastStoryId ? storiesRes.data?.find((s) => s.id === lastStoryId) ?? null : null)
        }
      }
      load()
      return () => { cancelled = true }
    }, [])
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

  // Real "X از Y": the child's position among peers at the same stage, only
  // shown when there IS a meaningful peer set (see the file doc comment).
  const nextUpProgress = useMemo(() => {
    if (lastLesson) {
      const peers = lessons.filter((l) => l.stage === lastLesson.stage)
      const idx = peers.findIndex((l) => l.id === lastLesson.id)
      if (idx >= 0 && peers.length > 1) return `${toPersianDigits(idx + 1)} از ${toPersianDigits(peers.length)}`
    }
    if (lastStory) {
      const peers = stories.filter((s) => s.stage === lastStory.stage)
      const idx = peers.findIndex((s) => s.id === lastStory.id)
      if (idx >= 0 && peers.length > 1) return `${toPersianDigits(idx + 1)} از ${toPersianDigits(peers.length)}`
    }
    return null
  }, [lastLesson, lastStory, lessons, stories])

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

  if (!child) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.onPrimary} />
      </View>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 96 }]}
      >
        {showTutorial && <Tutorial childName={child.name} onClose={() => setShowTutorial(false)} />}

        {/* Header — greeting + streak pill + avatar. No lock button here;
            BottomNav's hold-to-parent door is the one gate (see file doc). */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hi}>{greeting()}</Text>
            <Text style={styles.name}>{child.name}!</Text>
          </View>
          <View style={styles.headerRight}>
            {childAge(child) > 7 && stats.streak > 0 && (
              <View style={styles.streakPill}>
                <Svg viewBox="0 0 24 24" width={15} height={15}>
                  <Path d={FLAME_PATH} fill={ramps.phonics.bright} stroke={ramps.phonics.deep} strokeWidth={1.3} />
                </Svg>
                <Text style={styles.streakText}>{toPersianDigits(stats.streak)}</Text>
              </View>
            )}
            <Pressable onPress={() => router.replace('/children')} hitSlop={8} style={styles.avatarButton}>
              {mediaUrl(child.avatar_url) ? (
                <Image source={{ uri: mediaUrl(child.avatar_url)! }} style={styles.avatar} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitial}>{child.name?.[0] ?? '🧒'}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Continue card — THE button, illustrated. */}
        <Pressable style={styles.continueCard} onPress={() => router.push(nextUp.href)}>
          <View style={styles.continueHeader}>
            <View style={styles.continueHeaderLeft}>
              <View style={[styles.continueIconChip, { backgroundColor: nextUpStyle.ramp.soft, borderColor: nextUpStyle.ramp.bright }]}>
                <Text style={{ fontSize: 16 }}>{nextUp.emoji}</Text>
              </View>
              <Text style={styles.continueTitle} numberOfLines={1}>{nextUp.title}</Text>
            </View>
            {nextUpProgress && <Text style={styles.continueProgress}>{nextUpProgress}</Text>}
          </View>
          <View style={styles.continueScene}>
            <SvgXml xml={CONTINUE_SCENE_SVG} width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="xMidYMid slice" />
            {nextUpStyle.character && (
              <View style={styles.continueChar}>
                <SvgXml xml={characterSvg(nextUpStyle.character, { emotion: 'encouraging', size: 88 })} width="100%" height="100%" />
              </View>
            )}
            <View style={styles.continueCta}>
              <Text style={styles.continueCtaLabel}>{nextUp.label}</Text>
              <View style={[styles.continueCtaButton, { backgroundColor: nextUpStyle.ramp.bright, borderColor: nextUpStyle.ramp.deep }]}>
                <Text style={[styles.continueCtaButtonText, { color: nextUpStyle.ramp.ink }]}>بزن بریم!</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Daily goal — real minutes-played-today against the family's saved
            goal. The mockup's flat "0 6px 0" edge is a solid colour band,
            not a blurred platform shadow (RN's shadow props render very
            differently on iOS vs Android — same reasoning as ModuleCard's
            shell/panel split), so it's built the same way here: a deep-tone
            shell peeking out from under a bright-tone panel. */}
        <View style={styles.goalShell}>
          <View style={styles.goalCard}>
            <Svg viewBox="0 0 44 44" width={42} height={42}>
              <Circle cx={22} cy={22} r={GOAL_R} fill="none" stroke={ramps.brand.ink} strokeWidth={6} opacity={0.2} />
              <Circle
                cx={22} cy={22} r={GOAL_R} fill="none" stroke={ramps.brand.ink} strokeWidth={6} strokeLinecap="round"
                strokeDasharray={`${GOAL_CIRC * goalPct} ${GOAL_CIRC}`}
                rotation={-90} origin="22, 22"
              />
            </Svg>
            <View>
              <Text style={styles.goalLabel}>هدف امروز</Text>
              <Text style={styles.goalValue}>{toPersianDigits(todayMin)} از {toPersianDigits(goalMin)} دقیقه</Text>
            </View>
          </View>
        </View>

        {/* Alphabet — tap to hear */}
        {letters.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={styles.rowLabel}>الفبا — ضربه بزن و بشنو 🔤</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lettersRow}>
              {letters.map((l) => (
                <Pressable key={l.id} style={styles.letterTile} onPress={() => playClip(l.audio_url)}>
                  <Text style={styles.letterChar}>{l.character}</Text>
                  <Text style={styles.letterName}>{l.name_persian}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Friends / rooms grid */}
        <View style={styles.gridHeader}>
          <View>
            <Text style={styles.gridEyebrow}>هر کدوم یک دوست داره</Text>
            <Text style={styles.gridTitle}>دوستات منتظرتن</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {TILES.map((tile) => (
            <ModuleCard
              key={tile.key}
              title={tile.title}
              sub={tile.character ? `${HOST_NAME[tile.character]} راهنماته` : undefined}
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
      </ScrollView>
      <BottomNav current="home" />
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { gap: 16, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hi: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
  name: { fontFamily: fonts.display, fontSize: 22, color: scenery.ink, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: scenery.line,
  },
  streakText: { fontFamily: fonts.bold, fontSize: 14, color: ramps.phonics.ink },
  avatarButton: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: ramps.stories.soft,
    borderWidth: 3, borderColor: ramps.stories.bright, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44 },
  avatarInitial: { fontFamily: fonts.display, fontSize: 16, color: ramps.stories.ink },

  continueCard: {
    borderRadius: 28, overflow: 'hidden', backgroundColor: scenery.sky,
    borderWidth: 2, borderColor: scenery.line,
  },
  continueHeader: {
    height: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderBottomWidth: 2, borderBottomColor: scenery.line,
  },
  continueHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  continueIconChip: { width: 36, height: 36, borderRadius: 12, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  continueTitle: { fontFamily: fonts.display, fontSize: 17, color: scenery.ink, flexShrink: 1 },
  continueProgress: { fontSize: 12, fontFamily: fonts.bold, color: colors.muted },
  continueScene: { height: 200, position: 'relative' },
  continueChar: { position: 'absolute', left: '38%', top: 14, width: 96, height: 96 },
  continueCta: { position: 'absolute', left: 14, bottom: 14, alignItems: 'flex-start', gap: 6 },
  continueCtaLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  continueCtaButton: { height: 44, paddingHorizontal: 20, borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  continueCtaButtonText: { fontFamily: fonts.display, fontSize: 15 },

  goalShell: { borderRadius: 22, backgroundColor: ramps.brand.deep, paddingBottom: 6 },
  goalCard: {
    height: 62, borderRadius: 18, backgroundColor: ramps.brand.bright, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 13,
  },
  goalLabel: { fontSize: 11, fontFamily: fonts.bold, color: ramps.brand.ink, opacity: 0.72 },
  goalValue: { fontFamily: fonts.display, fontSize: 19, color: ramps.brand.ink, marginTop: 2 },

  rowLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  lettersRow: { gap: 10, paddingRight: 4 },
  letterTile: {
    width: 76, height: 92, borderRadius: 18, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  letterChar: { fontSize: 40, fontFamily: fonts.bold, color: ramps.letters.ink, lineHeight: 48 },
  letterName: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },

  gridHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -4 },
  gridEyebrow: { fontSize: 11, fontFamily: fonts.bold, color: colors.muted },
  gridTitle: { fontFamily: fonts.display, fontSize: 20, color: scenery.ink, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
})
