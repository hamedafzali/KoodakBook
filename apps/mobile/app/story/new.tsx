import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ApiResponse } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { clay, colors, fonts, radii, ramps, scenery, spacing, textSize, textStart, ui, type Ramp } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayButton, ClaySurface, HostAvatar } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { Sparkle } from '@/components/Illustrations'

// The picker's hue: web's /child/story/new is purple, and Stories' «بساز»
// card uses the same ramp, so the entry and the room match.
const MAGIC: Ramp = ramps.games

// Theme is sent to the backend as free text; the emoji/label are just the UI
// (same list as web's /child/story/new).
const THEMES = [
  { key: 'حیوانات', emoji: '🦊', label: 'حیوانات' },
  { key: 'فضا و ستاره‌ها', emoji: '🚀', label: 'فضا' },
  { key: 'دریا و ماهی‌ها', emoji: '🐠', label: 'دریا' },
  { key: 'خانواده', emoji: '👨‍👩‍👧', label: 'خانواده' },
  { key: 'دوستی', emoji: '🤝', label: 'دوستی' },
  { key: 'ماجراجویی', emoji: '🗺️', label: 'ماجراجویی' },
  { key: 'جنگل', emoji: '🌳', label: 'جنگل' },
  { key: 'جشن تولد', emoji: '🎂', label: 'تولد' },
]

const WAIT_TITLE = 'در حال نوشتن داستان تو…'

export default function NewStory() {
  const insets = useSafeAreaInsets()
  const [theme, setTheme] = useState(THEMES[0].key)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A ref, not just `generating`: two taps inside one frame both saw
  // generating === false and could post the (slow, costly) request twice.
  const inFlight = useRef(false)
  // Generation takes a while and the child can leave (back gesture) while it
  // runs; without this the finished request still called router.replace and
  // yanked them to the story from wherever they had gone.
  // Set true at effect start too: a Fast Refresh / StrictMode replay runs the
  // cleanup and then the effect again, which would otherwise leave it false
  // and silently drop the finished request.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function generate() {
    if (generating || inFlight.current) return
    inFlight.current = true
    setGenerating(true)
    setError(null)
    // The waiting screen replaces the picker with no focus change.
    AccessibilityInfo.announceForAccessibility(WAIT_TITLE)
    let res: ApiResponse<{ id: string }>
    try {
      const childId = await getActiveChildId()
      if (!mounted.current) return
      if (!childId) { router.replace('/children'); return }
      res = await api.post<{ id: string }>('/api/ai/stories/generate', { child_id: childId, theme })
    } catch {
      // api never rejects, but SecureStore can: without this the child sat
      // on the waiting screen forever with the guard still set.
      res = { data: null, error: 'ساختن داستان موفق نبود. دوباره تلاش کن' }
    }
    if (!mounted.current) return
    inFlight.current = false
    if (res.data?.id) {
      router.replace(`/story/${res.data.id}`)
    } else {
      setError(res.error ?? 'ساختن داستان موفق نبود. دوباره تلاش کن')
      setGenerating(false)
    }
  }

  // Building the story takes a while — show a friendly waiting screen that
  // says what is being written (the child's own pick, nothing invented).
  if (generating) {
    const picked = THEMES.find((t) => t.key === theme) ?? THEMES[0]
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        {/* پشمک, the stories host, "thinking" = waiting (Clay.tsx rules),
            in the picker's disc with the chosen theme at its shoulder. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <HostAvatar ramp={MAGIC} size={148} character="pashmak" emotion="thinking" />
          <View style={styles.waitTheme}>
            <Text style={styles.waitThemeEmoji} maxFontSizeMultiplier={1}>{picked.emoji}</Text>
          </View>
          {/* Two twinkles at the disc's top shoulders: the magic being made. */}
          <View style={styles.waitSparkleA}><Sparkle size={30} color={MAGIC.bright} /></View>
          <View style={styles.waitSparkleB}><Sparkle size={20} color={ramps.rewards.bright} /></View>
        </View>
        <Text style={styles.waitTitle} accessibilityRole="header">{WAIT_TITLE}</Text>
        <Text style={styles.waitSub}>یک لحظه صبر کن، دارم برایت یک داستان می‌سازم!</Text>
        <ClaySurface ramp={MAGIC} tone="soft" edge={clay.edgeSm} radius={radii.pill} faceStyle={styles.waitChip}>
          <ActivityIndicator color={MAGIC.ink} size="small" accessibilityLabel="در حال بارگذاری" />
          <Text style={styles.waitChipText}>موضوع: {picked.label}</Text>
        </ClaySurface>
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Flush: the scroll content already pads 16pt, the header's own
            inset would put the back disc a second 16pt further in. */}
        <ScreenHeader title="یک داستان برای من بساز" subtitle="یک موضوع انتخاب کن" style={styles.header} fallback="/stories" />

        {/* پشمک invites: the host first (reading start), then one line. */}
        <ClaySurface ramp={MAGIC} tone="soft" radius={radii.lg} faceStyle={styles.introFace}>
          <HostAvatar ramp={MAGIC} size={64} character="pashmak" emotion="encouraging" />
          <View style={styles.introText}>
            <Text style={styles.introTitle}>درباره‌ی چی باشه؟</Text>
            <Text style={styles.introSub}>تو انتخاب کن، من برات یک داستان تازه می‌نویسم.</Text>
          </View>
        </ClaySurface>

        {/* A single choice: radios, so a screen reader says which one is on.
            Chosen = raised bright clay with the shared selected ring (ramp
            deep) plus a ✓ badge, not colour alone; the rest are soft clay.
            Emoji (in a white disc) over label: a row left «ماجراجویی» ~50pt
            on a 320pt phone, not enough for the one word. */}
        <View style={styles.grid} accessibilityRole="radiogroup">
          {THEMES.map((t) => {
            const on = theme === t.key
            return (
              <Pressable
                key={t.key}
                accessibilityRole="radio"
                accessibilityLabel={t.label}
                accessibilityState={{ checked: on, selected: on }}
                style={styles.option}
                onPress={() => setTheme(t.key)}
              >
                {({ pressed }) => (
                  <ClaySurface ramp={MAGIC} tone={on ? 'bright' : 'soft'} selected={on} pressed={pressed} radius={radii.md} style={styles.fill} faceStyle={styles.optionFace}>
                    <View style={[styles.optionDisc, { borderColor: on ? MAGIC.deep : MAGIC.bright }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <Text style={styles.optionEmoji} maxFontSizeMultiplier={1}>{t.emoji}</Text>
                    </View>
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{t.label}</Text>
                    {on ? (
                      // ✓ at the card's top corner (physical `right`, swapped
                      // by RN under RTL to the reading end). Decorative: the
                      // radio's state says it.
                      <View style={styles.optionCheck} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        <Icon name="check" color={ui.onDeep} size={14} strokeWidth={3.2} />
                      </View>
                    ) : null}
                  </ClaySurface>
                )}
              </Pressable>
            )
          })}
        </View>

        {error ? <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}

        <ClayButton ramp={MAGIC} label="بساز!" emoji="✨" accessibilityLabel="بساز" onPress={generate} />
      </ScrollView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  content: { paddingHorizontal: spacing.md, gap: spacing.md + 2 },
  header: { paddingHorizontal: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  // 40% + flexGrow (same as the story grid): two 48% options plus the gap
  // overflow a 320pt phone's row. Two per row everywhere else.
  option: { width: '40%', flexGrow: 1 },
  fill: { flex: 1 },
  optionFace: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm + 4, minHeight: 112,
  },
  optionDisc: {
    width: 56, height: 56, borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  optionEmoji: { fontSize: 28 },
  optionLabel: { fontSize: textSize.body, fontFamily: fonts.bold, color: MAGIC.ink, textAlign: 'center' },
  optionLabelOn: { fontFamily: fonts.display },
  optionCheck: {
    position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: radii.pill,
    backgroundColor: MAGIC.deep, alignItems: 'center', justifyContent: 'center',
  },
  introFace: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs, padding: spacing.sm + spacing.xs },
  introText: { flex: 1, gap: 2 },
  introTitle: { fontSize: textSize.body, fontFamily: fonts.display, color: MAGIC.ink, textAlign: textStart },
  introSub: { fontSize: textSize.caption, fontFamily: fonts.medium, color: ui.text, textAlign: textStart },
  // colors.text, not danger: danger sits at the AA edge on the page gradient.
  error: { color: colors.text, fontSize: textSize.small, fontFamily: fonts.bold, textAlign: 'center' },
  waitTitle: { fontSize: textSize.cardTitle, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  waitSub: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center' },
  waitTheme: {
    position: 'absolute', bottom: 0, right: 0, width: 52, height: 52, borderRadius: radii.pill,
    backgroundColor: MAGIC.bright, borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  waitThemeEmoji: { fontSize: 24 },
  waitSparkleA: { position: 'absolute', top: -6, left: -10 },
  waitSparkleB: { position: 'absolute', top: 18, right: -14 },
  waitChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm,
  },
  waitChipText: { fontSize: textSize.small, fontFamily: fonts.bold, color: MAGIC.ink },
})
