import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { colors, fonts } from '@/lib/theme'

/**
 * The child's landing hub — a simplified mobile take on web's /child/home.
 * Only قصه‌ها is live yet; the rest are visible-but-locked so the app already
 * feels like KoodakBook and kids see what's coming.
 */
const TILES = [
  { key: 'stories', emoji: '📖', title: 'قصه‌ها', href: '/stories' as const, tint: '#dcfce7' },
  { key: 'lessons', emoji: '📚', title: 'درس‌ها', href: null, tint: '#dbeafe' },
  { key: 'review', emoji: '🔄', title: 'مرور', href: null, tint: '#fef3c7' },
  { key: 'rewards', emoji: '🏆', title: 'جایزه‌ها', href: null, tint: '#fce7f3' },
  { key: 'friends', emoji: '🦊', title: 'دوست‌ها', href: null, tint: '#ffedd5' },
  { key: 'math', emoji: '🔢', title: 'ریاضی', href: null, tint: '#ede9fe' },
]

export default function Home() {
  const insets = useSafeAreaInsets()
  const [child, setChild] = useState<Child | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const res = await api.get<Child[]>('/api/children')
        if (cancelled) return
        const active = res.data?.find((c) => c.id === childId)
        // Active child no longer exists (deleted on web) — repick.
        if (res.data && !active) { router.replace('/children'); return }
        if (active) setChild(active)
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  if (!child) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/children')} hitSlop={8} style={styles.avatarButton}>
          {mediaUrl(child.avatar_url) ? (
            <Image source={{ uri: mediaUrl(child.avatar_url)! }} style={styles.avatar} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 28 }}>🧒</Text>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>سلام {child.name} 👋</Text>
          <Text style={styles.sub}>امروز چی کار کنیم؟</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {TILES.map((tile) => (
          <Pressable
            key={tile.key}
            style={[styles.tile, { backgroundColor: tile.tint }, !tile.href && styles.tileLocked]}
            disabled={!tile.href}
            onPress={() => tile.href && router.push(tile.href)}
          >
            <Text style={styles.tileEmoji}>{tile.emoji}</Text>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            {!tile.href && <Text style={styles.soon}>به زودی</Text>}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarButton: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 52, height: 52 },
  hello: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  sub: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '48%', flexGrow: 1, aspectRatio: 1.15, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tileLocked: { opacity: 0.55 },
  tileEmoji: { fontSize: 44 },
  tileTitle: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  soon: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted },
})
