import { useCallback, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child, DashboardSummary } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { Ionicons } from '@expo/vector-icons'
import PinGate, { PIN_BACKDROP } from '@/components/PinGate'
import AppUpdateCard from '@/components/AppUpdateCard'
import { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import { CharacterArt } from '@/components/Clay'
import {
  ParentButton, ParentCard, ParentChip, ParentDivider, ParentHeader, ParentNote, ParentPage, ParentRow, parentUI,
} from '@/components/ParentUI'
import { api } from '@/lib/api'
import { goBack } from '@/lib/navigation'
import { isParentUnlocked, setParentUnlocked } from '@/lib/parentGate'
import { fonts, ramps, scenery, spacing, textSize, textStart, ui } from '@/lib/theme'

type Me = { id: string; email: string; plan: string; has_pin: boolean }

/**
 * Parent hub (web: /parent/dashboard) behind the account PIN gate. First run
 * (no PIN yet) forces the set-PIN flow, like web. Leaving the parent area
 * re-locks it (see parent/_layout.tsx).
 */
export default function ParentHub() {
  const insets = useSafeAreaInsets()
  const { reset } = useLocalSearchParams<{ reset?: string }>()
  const [me, setMe] = useState<Me | null>(null)
  const [unlocked, setUnlocked] = useState(isParentUnlocked())
  const [children, setChildren] = useState<Child[]>([])
  // Distinguishes "still loading the children list" from "loaded, and it's
  // empty" -- without this, a brand-new parent with zero children never gets
  // `selected` set, the summary fetch below never fires, and `!summary`
  // rendered a bare spinner forever with no message and no way out
  // (2026-09-20 audit, Critical #2).
  const [childrenLoaded, setChildrenLoaded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  // Each load's failure is its own state (with a retry) instead of: an
  // endless spinner for /api/auth/me and for the summary, and a failed
  // /api/children dressed up as the day-zero "no children yet" page.
  const [meError, setMeError] = useState<string | null>(null)
  const [childrenError, setChildrenError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [loadKey, setLoadKey] = useState(0)
  const [summaryKey, setSummaryKey] = useState(0)
  // Team replies the parent hasn't opened (app/parent/feedback.tsx).
  const [unreadReplies, setUnreadReplies] = useState(0)
  const retryLoad = () => { setMeError(null); setChildrenError(null); setLoadKey((k) => k + 1) }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      // Re-sync lock state on focus — «تغییر پین» re-locks then returns here,
      // and the gate must reappear (in reset mode via ?reset=1).
      setUnlocked(isParentUnlocked())
      api.get<Me>('/api/auth/me').then((res) => {
        if (cancelled) return
        if (res.data) setMe(res.data)
        else setMeError(res.error || PARENT_FALLBACK_ERROR)
      })
      api.get<Child[]>('/api/children').then((res) => {
        if (cancelled) return
        if (res.data) {
          setChildrenError(null)
          setChildren(res.data)
          setSelected((cur) => (cur && res.data!.some((c) => c.id === cur) ? cur : res.data![0]?.id ?? null))
          setChildrenLoaded(true)
        } else {
          setChildrenError(res.error || PARENT_FALLBACK_ERROR)
        }
      })
      return () => { cancelled = true }
    }, [loadKey])
  )

  useFocusEffect(
    useCallback(() => {
      if (!selected || !unlocked) return
      let cancelled = false
      setSummary(null); setSummaryError(null)
      api.get<DashboardSummary>(`/api/dashboard/${selected}`).then((res) => {
        if (cancelled) return
        if (res.data) setSummary(res.data)
        else setSummaryError(res.error || PARENT_FALLBACK_ERROR)
      })
      return () => { cancelled = true }
    }, [selected, unlocked, summaryKey])
  )

  // Refetched on focus, so coming back from the feedback screen clears it.
  useFocusEffect(
    useCallback(() => {
      if (!unlocked) return
      let cancelled = false
      api.get<{ unread: number }>('/api/feedback/mine').then((res) => {
        if (!cancelled) setUnreadReplies(res.data?.unread ?? 0)
      })
      return () => { cancelled = true }
    }, [unlocked])
  )

  if (!me) {
    // Before the PIN, on the gate's own dark backdrop: entering the parent
    // area used to show a cream frame and then the dark gate.
    const bg = unlocked ? parentUI.page : PIN_BACKDROP
    return (
      <View style={[styles.center, { backgroundColor: bg, padding: spacing.lg, gap: spacing.md - 2 }]}>
        {meError ? (
          <>
            <Text
              style={[styles.loadError, !unlocked && { color: ui.errorSoft }]}
              accessibilityLiveRegion="polite"
            >
              {meError}
            </Text>
            <ParentButton label="دوباره تلاش کنید" onPress={retryLoad} style={styles.stateButton} />
            <ParentButton
              label="برگشت" tone="secondary" onPress={() => goBack('/home')} style={styles.stateButton}
            />
          </>
        ) : (
          <ActivityIndicator color={unlocked ? parentUI.accentText : ui.onDeep} accessibilityLabel="در حال بارگذاری" />
        )}
      </View>
    )
  }

  if (!unlocked) {
    return (
      <PinGate
        hasPin={me.has_pin}
        initialReset={reset === '1'}
        onUnlocked={() => { setParentUnlocked(true); setUnlocked(true); setMe({ ...me, has_pin: true }) }}
      />
    )
  }

  // Day zero: no child profile yet. Matches web's /parent/dashboard empty
  // state (سیمرغ منتظر همراهش است) rather than leaving a parent staring at
  // a spinner that never resolves (2026-09-20 audit, Critical #2).
  if (!childrenError && childrenLoaded && children.length === 0) {
    return (
      <ParentPage>
        <ParentHeader title="حالت والدین" subtitle={`${me.email} · پلن ${me.plan}`} fallback="/home" />
        <View style={[styles.center, { gap: spacing.md, padding: spacing.lg }]}>
          <CharacterArt character="simorgh" emotion="encouraging" size={96} />
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text style={styles.emptyTitle} accessibilityRole="header">سیمرغ منتظر همراهش است</Text>
            <Text style={styles.emptySub}>یک پروفایل برای فرزندتان بسازید تا اولین قصه شروع شود</Text>
          </View>
          <ParentButton label="ایجاد پروفایل" onPress={() => router.push('/onboarding')} style={styles.stateButton} />
        </View>
      </ParentPage>
    )
  }

  return (
    <ParentPage>
      <ParentHeader
        title="حالت والدین"
        subtitle={`${me.email} · پلن ${me.plan}`}
        // This IS the parent area's own root, not a sub-screen of it -- if
        // there's no history (deep link, or this is genuinely the first
        // screen in its stack), back should leave parent mode entirely
        // rather than "fall back" into itself.
        fallback="/home"
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >

      {/* Child selector + that child's summary, shown together once the
          summary is in: the chips used to render empty, then fill, then
          push the stats down when they landed (a partial first frame). */}
      {childrenError || summaryError ? (
        <View style={styles.inlineError}>
          <ParentNote text={childrenError ?? summaryError ?? ''} tone="error" />
          <ParentButton
            label="دوباره تلاش کنید"
            tone="secondary"
            compact
            onPress={childrenError ? retryLoad : () => setSummaryKey((k) => k + 1)}
          />
        </View>
      ) : null}
      {!childrenError && !summary && !summaryError ? (
        <ActivityIndicator color={parentUI.accentText} style={{ marginVertical: spacing.xl }} accessibilityLabel="در حال بارگذاری" />
      ) : null}
      {children.length > 0 && (summary || summaryError) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {children.map((c) => (
            <ParentChip
              key={c.id}
              label={c.name}
              role="button"
              selected={selected === c.id}
              onPress={() => setSelected(c.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {summary && !childrenError && !summaryError ? (
        <>
          <View style={styles.statsGrid}>
            <Stat icon="flame" label="روزهای پیاپی" value={summary.streak_days} />
            <Stat icon="pencil" label="کلمه‌های یادگرفته" value={summary.words_learned} />
            <Stat icon="book" label="قصه‌های تمام‌شده" value={summary.stories_completed} />
            <Stat icon="school" label="درس‌های تمام‌شده" value={summary.lessons_completed} />
          </View>

          <ParentCard>
            <Text style={styles.cardTitle} accessibilityRole="header">وضعیت کلمه‌ها</Text>
            <MasteryRow label="تازه دیده" value={summary.mastery_breakdown.introduced} tint={scenery.faint} />
            <MasteryRow label="در حال تمرین" value={summary.mastery_breakdown.practicing} tint={ramps.brand.bright} />
            <MasteryRow label="یادگرفته" value={summary.mastery_breakdown.mastered} tint={ramps.lessons.bright} />
            <MasteryRow label="ماندگار شده" value={summary.mastery_breakdown.consolidated} tint={ramps.letters.bright} />
          </ParentCard>

          {summary.recent_badges.length > 0 && (
            <ParentCard>
              <Text style={styles.cardTitle} accessibilityRole="header">نشان‌های اخیر</Text>
              {summary.recent_badges.map((b) => (
                <View key={b.id} style={styles.badgeRow}>
                  <Ionicons name="medal" size={15} color={parentUI.accentText} />
                  <Text style={styles.badgeRowText}>{b.badge?.title ?? ''}</Text>
                </View>
              ))}
            </ParentCard>
          )}
        </>
      ) : null}

      {/* Android direct-install builds only: a newer release is out. */}
      <AppUpdateCard />

      {/* Menu — the rest of the parent area */}
      <ParentCard style={styles.menu}>
        <ParentRow icon="trending-up" label="پیشرفت کامل" sub="کلمات، درس‌ها، داستان‌ها، جلسات" onPress={() => router.push(selected ? { pathname: '/parent/progress', params: { child: selected } } : '/parent/progress')} />
        <ParentDivider />
        <ParentRow icon="person" label="کودکان" sub="افزودن کودک، نام کاربری ورود بچه‌ها" onPress={() => router.push('/parent/children')} />
        <ParentDivider />
        <ParentRow icon="people" label="دوستان" sub="کد دوستی و تأیید — برای بازی آنلاین" onPress={() => router.push('/parent/friends')} />
        <ParentDivider />
        <ParentRow icon="chatbubbles" label="گفت‌وگوها" sub="بازبینی چت کودک با شخصیت‌ها" onPress={() => router.push(selected ? { pathname: '/parent/conversations', params: { child: selected } } : '/parent/conversations')} />
        <ParentDivider />
        <ParentRow icon="share-social" label="اشتراک‌گذاری پیشرفت" onPress={() => router.push(selected ? { pathname: '/parent/share', params: { child: selected } } : '/parent/share')} />
        <ParentDivider />
        <ParentRow icon="card" label="پلن و اشتراک" onPress={() => router.push('/parent/plan')} />
        <ParentDivider />
        <ParentRow icon="settings" label="تنظیمات" sub="هدف روزانه، زبان ترجمه، پین، خروج" onPress={() => router.push('/parent/settings')} />
        <ParentDivider />
        <ParentRow
          icon="chatbubble-ellipses"
          label="پیشنهاد، مشکل یا سؤال"
          sub={unreadReplies > 0 ? `${toPersianDigits(String(unreadReplies))} جواب تازه از تیم کودک‌بوک` : 'مستقیم برای تیم کودک‌بوک بنویسید'}
          onPress={() => router.push('/parent/feedback')}
        />
      </ParentCard>
      </ScrollView>
    </ParentPage>
  )
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${toPersianDigits(value)}`}>
      <Ionicons name={icon} size={22} color={parentUI.accentText} />
      <Text style={styles.statValue}>{toPersianDigits(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function MasteryRow({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.masteryRow} accessible accessibilityLabel={`${label}: ${toPersianDigits(value)}`}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.masteryLabel}>{label}</Text>
      <Text style={styles.masteryValue}>{toPersianDigits(value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: parentUI.page },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.md },
  stateButton: { alignSelf: 'stretch', maxWidth: 320, width: '100%' },
  emptyTitle: { fontSize: textSize.body, fontFamily: fonts.bold, color: parentUI.text, textAlign: 'center' },
  emptySub: { fontSize: textSize.caption + 1, fontFamily: fonts.medium, color: parentUI.muted, textAlign: 'center', maxWidth: 280 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  stat: {
    width: '48%', flexGrow: 1, backgroundColor: parentUI.surface, borderRadius: parentUI.radius,
    borderWidth: 1, borderColor: parentUI.line, padding: spacing.md - 2, alignItems: 'center', gap: 2,
  },
  statValue: { fontSize: textSize.h2, fontFamily: fonts.bold, color: parentUI.text },
  statLabel: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, textAlign: 'center' },
  cardTitle: { fontSize: textSize.small, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  masteryLabel: { flex: 1, fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.text, textAlign: textStart },
  masteryValue: { fontSize: textSize.caption + 1, fontFamily: fonts.bold, color: parentUI.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeRowText: { flex: 1, fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.text, textAlign: textStart },
  menu: { paddingVertical: 0, gap: 0 },
  loadError: { color: ui.error, fontFamily: fonts.regular, fontSize: textSize.caption + 1, textAlign: 'center', lineHeight: 22 },
  inlineError: { gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
})
