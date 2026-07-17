import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ChildBadge } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { colors, fonts } from '@/lib/theme'

/** جایزه‌ها — the badges the child has earned (web: /child/rewards). */
export default function Rewards() {
  const insets = useSafeAreaInsets()
  const [badges, setBadges] = useState<ChildBadge[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        if (!childId) { router.replace('/children'); return }
        const res = await api.get<ChildBadge[]>(`/api/badges/${childId}`)
        if (cancelled) return
        if (res.data) setBadges(res.data)
        else setError(res.error)
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  if (!badges) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>جایزه‌ها 🏆</Text>
          <Text style={styles.subtitle}>{toPersianDigits(badges.length)} نشان گرفتی</Text>
        </View>
      </View>

      <FlatList
        data={badges}
        keyExtractor={(b) => b.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
            <Text style={{ fontSize: 44 }}>🌱</Text>
            <Text style={styles.empty}>هنوز نشانی نگرفتی — قصه بخوان و درس یاد بگیر!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {mediaUrl(item.badge?.image_url) ? (
              <Image source={{ uri: mediaUrl(item.badge!.image_url)! }} style={styles.image} contentFit="contain" />
            ) : (
              <Text style={{ fontSize: 52 }}>🏅</Text>
            )}
            <Text style={styles.badgeTitle}>{item.badge?.title ?? ''}</Text>
            {item.badge?.description && (
              <Text style={styles.description} numberOfLines={2}>{item.badge.description}</Text>
            )}
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  grid: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', paddingHorizontal: 30, lineHeight: 22 },
  card: {
    width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 18,
    padding: 16, alignItems: 'center', gap: 6,
  },
  image: { width: 80, height: 80 },
  badgeTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  description: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
