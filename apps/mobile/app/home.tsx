import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type {
  Child, DashboardSummary, Lesson, Letter, ReviewItem, Story, StrandLevels,
} from '@koodakbook/shared'
import {
  ALL_UNLOCKED, LESSON_TYPE_EMOJI, isLessonUnlocked, isStoryUnlocked,
  resolveLevel, toPersianDigits,
} from '@koodakbook/shared'
import HoldToParent from '@/components/HoldToParent'
import ScreenBackground from '@/components/ScreenBackground'
import Tutorial from '@/components/Tutorial'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { ensurePrefs, hasSeenTutorial } from '@/lib/prefs'
import { playClip } from '@/lib/sound'
import { useChildSession } from '@/lib/useChildSession'
import { colors, fonts } from '@/lib/theme'

const TILES = [
  { key: 'stories', emoji: '📖', title: 'قصه‌ها', href: '/stories' as const, tint: '#dcfce7' },
  { key: 'lessons', emoji: '📚', title: 'درس‌ها', href: '/lessons' as const, tint: '#dbeafe' },
  { key: 'review', emoji: '🔄', title: 'مرور', href: '/review' as const, tint: '#fef3c7' },
  { key: 'rewards', emoji: '🏆', title: 'جایزه‌ها', href: '/rewards' as const, tint: '#fce7f3' },
  { key: 'friends', emoji: '🦊', title: 'دوست‌ها', href: '/friends' as const, tint: '#ffedd5' },
  { key: 'math', emoji: '🔢', title: 'ریاضی', href: '/math' as const, tint: '#ede9fe' },
  { key: 'games', emoji: '🃏', title: 'بازی‌ها', href: '/games/memory' as const, tint: '#e0e7ff' },
  { key: 'phonics', emoji: '🎵', title: 'صداها', href: '/phonics' as const, tint: '#ffe4e6' },
  { key: 'speak', emoji: '🎤', title: 'بگو ببینم!', href: '/speak' as const, tint: '#fce7f3' },
  { key: 'write', emoji: '✍️', title: 'بنویس', href: '/write' as const, tint: '#e0f2fe' },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صبح بخیر'
  if (h < 17) return 'ظهر بخیر'
  return 'شب بخیر'
}

interface NextUp { href: string; label: string; title: string; emoji: string }

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
  const [showTutorial, setShowTutorial] = useState(false)

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

        const [lessonsRes, storiesRes, lettersRes, dashRes, reviewRes, progRes, placeRes] = await Promise.all([
          api.get<Lesson[]>('/api/lessons'),
          api.get<Story[]>('/api/stories'),
          api.get<Letter[]>('/api/letters'),
          api.get<DashboardSummary>(`/api/dashboard/${active.id}`),
          api.get<ReviewItem[]>(`/api/progress/${active.id}/review`),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[]; stories: { story_id: string; completed: boolean }[] }>(`/api/progress/${active.id}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${active.id}`),
        ])
        if (cancelled) return
        if (lessonsRes.data) setLessons(lessonsRes.data)
        if (storiesRes.data) setStories(storiesRes.data)
        if (lettersRes.data) setLetters(lettersRes.data)
        if (dashRes.data) setStats({ words: dashRes.data.words_learned, streak: dashRes.data.streak_days, xp: dashRes.data.xp ?? 0 })
        if (reviewRes.data) setReviewCount(reviewRes.data.length)
        if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
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
    if (lastLesson) return { href: `/lesson/${lastLesson.id}`, label: 'ادامه‌ی درس', title: lastLesson.title, emoji: LESSON_TYPE_EMOJI[lastLesson.type] ?? '📚' }
    if (reviewCount >= 3) return { href: '/review', label: 'مرور کلمه‌ها', title: `${toPersianDigits(reviewCount)} کلمه منتظرند`, emoji: '🔄' }
    if (lastStory) return { href: `/story/${lastStory.id}`, label: 'ادامه‌ی قصه', title: lastStory.title_persian, emoji: '📖' }
    const nl = lessons.find((l) => isLessonUnlocked(l, strandLevels) && !doneLessons.has(l.id))
    if (nl) return { href: `/lesson/${nl.id}`, label: 'درس تازه', title: nl.title, emoji: LESSON_TYPE_EMOJI[nl.type] ?? '📚' }
    const ns = stories.find((s) => isStoryUnlocked(s, strandLevels) && !doneStories.has(s.id))
    if (ns) return { href: `/story/${ns.id}`, label: 'قصه‌ی تازه', title: ns.title_persian, emoji: '📖' }
    return { href: '/phonics', label: 'بازی صداها', title: 'زبر، زیر، پیش', emoji: '🎵' }
  }, [lastLesson, lastStory, reviewCount, lessons, stories, strandLevels, doneLessons, doneStories])

  if (!child) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScreenBackground variant="warm">
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {showTutorial && <Tutorial childName={child.name} onClose={() => setShowTutorial(false)} />}

      {/* Hero */}
      <LinearGradient colors={['#FBBF24', '#F59E0B', '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()} 👋</Text>
          <Text style={styles.heroName}>{child.name}</Text>
          <View style={styles.chips}>
            {stats.streak > 0 && <Chip text={`🔥 ${toPersianDigits(stats.streak)} روز`} />}
            {stats.words > 0 && <Chip text={`⭐ ${toPersianDigits(stats.words)} کلمه`} />}
            <Chip text={`🎓 ${resolveLevel(stats.xp).label}`} />
          </View>
        </View>
        <HoldToParent style={styles.lockButton}>
          <Text style={{ fontSize: 20 }}>🔒</Text>
        </HoldToParent>
        <Pressable onPress={() => router.replace('/children')} hitSlop={8} style={styles.avatarButton}>
          {mediaUrl(child.avatar_url) ? (
            <Image source={{ uri: mediaUrl(child.avatar_url)! }} style={styles.avatar} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 26 }}>🧒</Text>
          )}
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        {/* THE button — the app already decided what's next */}
        <Pressable style={styles.nextUp} onPress={() => router.push(nextUp.href)}>
          <Text style={styles.nextUpEmoji}>{nextUp.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextUpLabel}>{nextUp.label}</Text>
            <Text style={styles.nextUpTitle} numberOfLines={1}>{nextUp.title}</Text>
          </View>
          <View style={styles.nextUpCta}><Text style={styles.nextUpCtaText}>بازی کن! 🎈</Text></View>
        </Pressable>

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

        {/* Activity grid */}
        <View style={styles.grid}>
          {TILES.map((tile) => (
            <Pressable key={tile.key} style={[styles.tile, { backgroundColor: tile.tint }]} onPress={() => router.push(tile.href)}>
              <Text style={styles.tileEmoji}>{tile.emoji}</Text>
              <Text style={styles.tileTitle}>{tile.title}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
    </ScreenBackground>
  )
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { gap: 0 },
  hero: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 20, paddingBottom: 56,
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
  },
  greeting: { fontSize: 14, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.9)' },
  heroName: { fontSize: 30, fontFamily: fonts.bold, color: '#fff', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontFamily: fonts.medium, color: '#fff' },
  lockButton: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 6, paddingHorizontal: 8 },
  avatarButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 48, height: 48 },
  body: { paddingHorizontal: 20, gap: 20, marginTop: -36 },
  nextUp: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 24, padding: 18,
    borderWidth: 3, borderColor: '#fde047',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  nextUpEmoji: { fontSize: 46 },
  nextUpLabel: { fontSize: 13, fontFamily: fonts.bold, color: '#d97706' },
  nextUpTitle: { fontSize: 19, fontFamily: fonts.bold, color: colors.text, marginTop: 2 },
  nextUpCta: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  nextUpCtaText: { color: '#fff', fontSize: 13, fontFamily: fonts.bold },
  rowLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  lettersRow: { gap: 10, paddingRight: 4 },
  letterTile: {
    width: 76, height: 92, borderRadius: 18, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  letterChar: { fontSize: 40, fontFamily: fonts.bold, color: '#0284c7', lineHeight: 48 },
  letterName: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '48%', flexGrow: 1, aspectRatio: 1.3, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tileEmoji: { fontSize: 40 },
  tileTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
})
