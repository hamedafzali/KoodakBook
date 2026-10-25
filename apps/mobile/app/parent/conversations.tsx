import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, Child } from '@koodakbook/shared'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import { ParentButton, ParentChip, ParentHeader, ParentNote, ParentPage, parentUI } from '@/components/ParentUI'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, radii, spacing, textSize, textStart } from '@/lib/theme'

interface Turn { role: 'child' | 'character'; text: string; created_at: string }

/**
 * Read-only transcript view for parents (web: /parent/conversations) — every
 * word the characters exchanged with each child, selectable by child + friend.
 */
export default function Conversations() {
  const insets = useSafeAreaInsets()
  // The child picked on the parent hub (?child=<id>), else the first child.
  const { child: childParam } = useLocalSearchParams<{ child?: string }>()
  const allowed = isParentUnlocked()
  const [children, setChildren] = useState<Child[] | null>(null)
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [childId, setChildId] = useState('')
  const [slug, setSlug] = useState('')
  const [turns, setTurns] = useState<Turn[] | null>(null)
  // A failed load used to read as "no children" / "no conversation yet".
  const [listError, setListError] = useState<string | null>(null)
  const [turnsError, setTurnsError] = useState<string | null>(null)
  const [listKey, setListKey] = useState(0)
  const [turnsKey, setTurnsKey] = useState(0)

  // A deep link straight here must face the PIN like the hub does.
  useFocusEffect(useCallback(() => {
    if (!isParentUnlocked()) router.replace('/parent')
  }, []))

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    Promise.all([api.get<Child[]>('/api/children'), api.get<AppCharacter[]>('/api/characters')]).then(
      ([c, ch]) => {
        if (cancelled) return
        if (!c.data || !ch.data) { setListError(c.error || ch.error || PARENT_FALLBACK_ERROR); return }
        setChildren(c.data)
        setCharacters(ch.data)
        const initial = c.data.find((x) => x.id === childParam) ?? c.data[0]
        if (initial) setChildId(initial.id)
        if (ch.data[0]) setSlug(ch.data[0].slug)
      }
    )
    return () => { cancelled = true }
  }, [allowed, childParam, listKey])

  useEffect(() => {
    if (!childId || !slug) return
    let cancelled = false
    setTurns(null); setTurnsError(null)
    api.get<Turn[]>(`/api/characters/${slug}/chat/${childId}`).then((r) => {
      if (cancelled) return
      if (r.data) setTurns(r.data)
      else setTurnsError(r.error || PARENT_FALLBACK_ERROR)
    })
    return () => { cancelled = true }
  }, [childId, slug, turnsKey])

  if (!allowed) return <View style={styles.container} />
  if (!children) {
    return (
      <ParentLoadState
        title="گفت‌وگوها" subtitle={SUBTITLE} error={listError}
        onRetry={() => { setListError(null); setListKey((k) => k + 1) }}
      />
    )
  }

  const child = children.find((c) => c.id === childId)
  const character = characters.find((c) => c.slug === slug)

  return (
    <ParentPage>
      <ParentHeader title="گفت‌وگوها" subtitle={SUBTITLE} />

      {/* Child + character pickers (horizontal chip rows) */}
      <View style={styles.pickers}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {children.map((c) => (
            <ParentChip key={c.id} role="button" label={c.name} selected={childId === c.id} onPress={() => setChildId(c.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {characters.map((c) => (
            <ParentChip key={c.slug} role="button" label={c.name_persian} selected={slug === c.slug} onPress={() => setSlug(c.slug)} />
          ))}
        </ScrollView>
      </View>

      {turnsError ? (
        <View style={styles.turnsError}>
          <ParentNote text={turnsError} tone="error" />
          <ParentButton label="دوباره تلاش کنید" tone="secondary" compact onPress={() => setTurnsKey((k) => k + 1)} />
        </View>
      ) : children.length === 0 ? (
        <Text style={styles.empty}>هنوز پروفایل کودکی ساخته نشده.</Text>
      ) : turns === null ? (
        <ActivityIndicator color={parentUI.accentText} style={{ marginTop: spacing.xl }} accessibilityLabel="در حال بارگذاری" />
      ) : turns.length === 0 ? (
        <Text style={styles.empty}>
          هنوز گفت‌وگویی بین {child?.name ?? 'کودک'} و {character?.name_persian ?? 'این شخصیت'} انجام نشده.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.thread, { paddingBottom: insets.bottom + spacing.lg }]}>
          {turns.map((t, i) => (
            // A row per bubble: a row's flex-start/flex-end follow RTL, a
            // column's alignSelf does not (the ModuleCard bug, Clay.tsx).
            <View key={i} style={[styles.bubbleRow, { justifyContent: t.role === 'child' ? 'flex-start' : 'flex-end' }]}>
              <View style={[styles.bubble, t.role === 'child' ? styles.childBubble : styles.charBubble]}>
                <Text style={styles.meta}>
                  {t.role === 'child' ? child?.name ?? 'کودک' : character?.name_persian}
                </Text>
                <Text style={styles.bubbleText}>{t.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </ParentPage>
  )
}

const SUBTITLE = 'هرچه شخصیت‌ها با کودک گفته‌اند — قابل بازبینی'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: parentUI.page },
  pickers: { gap: spacing.sm, paddingBottom: spacing.sm },
  pickerRow: { gap: spacing.sm, paddingHorizontal: spacing.md + 4 },
  empty: {
    textAlign: 'center', color: parentUI.muted, fontFamily: fonts.regular, fontSize: textSize.caption + 1,
    marginTop: spacing.xl + 8, paddingHorizontal: spacing.xl - 2, lineHeight: 22,
  },
  thread: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '85%', borderRadius: radii.md, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm },
  childBubble: { backgroundColor: parentUI.accentSoft },
  charBubble: { backgroundColor: parentUI.surface, borderWidth: 1, borderColor: parentUI.line },
  meta: { fontSize: textSize.micro, fontFamily: fonts.bold, color: parentUI.muted, marginBottom: 2, textAlign: textStart },
  turnsError: { alignItems: 'center', gap: spacing.sm + 2, marginTop: spacing.xl + 8, paddingHorizontal: spacing.xl - 2 },
  bubbleText: { fontSize: textSize.caption + 1, fontFamily: fonts.regular, color: parentUI.text, lineHeight: 24, textAlign: textStart },
})
