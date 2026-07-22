import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { colors, fonts } from '@/lib/theme'

interface Turn { role: 'child' | 'character'; text: string; created_at: string }

/**
 * Read-only transcript view for parents (web: /parent/conversations) — every
 * word the characters exchanged with each child, selectable by child + friend.
 */
export default function Conversations() {
  const insets = useSafeAreaInsets()
  const [children, setChildren] = useState<Child[]>([])
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [childId, setChildId] = useState('')
  const [slug, setSlug] = useState('')
  const [turns, setTurns] = useState<Turn[] | null>(null)

  useEffect(() => {
    Promise.all([api.get<Child[]>('/api/children'), api.get<AppCharacter[]>('/api/characters')]).then(
      ([c, ch]) => {
        setChildren(c.data ?? [])
        setCharacters(ch.data ?? [])
        if (c.data?.[0]) setChildId(c.data[0].id)
        if (ch.data?.[0]) setSlug(ch.data[0].slug)
      }
    )
  }, [])

  useEffect(() => {
    if (!childId || !slug) return
    setTurns(null)
    api.get<Turn[]>(`/api/characters/${slug}/chat/${childId}`).then((r) => setTurns(r.data ?? []))
  }, [childId, slug])

  const child = children.find((c) => c.id === childId)
  const character = characters.find((c) => c.slug === slug)

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>گفت‌وگوها 💬</Text>
          <Text style={styles.subtitle}>هرچه شخصیت‌ها با کودک گفته‌اند — قابل بازبینی</Text>
        </View>
      </View>

      {/* Child + character pickers (horizontal chip rows) */}
      <View style={styles.pickers}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {children.map((c) => (
            <Pressable key={c.id} style={[styles.pick, childId === c.id && styles.pickActive]} onPress={() => setChildId(c.id)}>
              <Text style={[styles.pickText, childId === c.id && { color: '#fff' }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {characters.map((c) => (
            <Pressable key={c.slug} style={[styles.pick, slug === c.slug && styles.pickActive]} onPress={() => setSlug(c.slug)}>
              <Text style={[styles.pickText, slug === c.slug && { color: '#fff' }]}>{c.name_persian}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {turns === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : turns.length === 0 ? (
        <Text style={styles.empty}>
          هنوز گفت‌وگویی بین {child?.name ?? 'کودک'} و {character?.name_persian ?? 'این شخصیت'} انجام نشده.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.thread, { paddingBottom: insets.bottom + 24 }]}>
          {turns.map((t, i) => (
            <View key={i} style={[styles.bubble, t.role === 'child' ? styles.childBubble : styles.charBubble]}>
              <Text style={styles.meta}>
                {t.role === 'child' ? child?.name ?? 'کودک' : character?.name_persian}
              </Text>
              <Text style={styles.bubbleText}>{t.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  pickers: { gap: 8, paddingBottom: 8 },
  pickerRow: { gap: 8, paddingHorizontal: 20 },
  pick: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: '#e5e7eb',
  },
  pickActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pickText: { fontSize: 13, fontFamily: fonts.medium, color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, marginTop: 40, paddingHorizontal: 30, lineHeight: 22 },
  thread: { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  childBubble: { alignSelf: 'flex-start', backgroundColor: '#fef3c7' },
  charBubble: { alignSelf: 'flex-end', backgroundColor: colors.card },
  meta: { fontSize: 10, fontFamily: fonts.regular, color: colors.muted, marginBottom: 2 },
  bubbleText: { fontSize: 14, fontFamily: fonts.regular, color: colors.text, lineHeight: 24 },
})
