import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { colors, fonts } from '@/lib/theme'
import { characterEmoji } from '@/lib/characterEmoji'

/** دوست‌ها — the interactive characters roster (web: home's friends row). */
export default function Friends() {
  const insets = useSafeAreaInsets()
  const [chars, setChars] = useState<AppCharacter[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<AppCharacter[]>('/api/characters').then((res) => {
      if (res.data) setChars(res.data)
      else setError(res.error)
    })
  }, [])

  if (!chars) {
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
        <Text style={styles.title}>دوست‌های من 🦊</Text>
      </View>

      <FlatList
        data={chars}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.empty}>هنوز دوستی اینجا نیست</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/friend/${item.slug}`)}>
            <Text style={{ fontSize: 56 }}>{characterEmoji(item)}</Text>
            <Text style={styles.name}>{item.name_persian}</Text>
            <Text style={styles.personality} numberOfLines={2}>{item.personality}</Text>
          </Pressable>
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
  grid: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', marginTop: 60 },
  card: {
    width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 20,
    padding: 18, alignItems: 'center', gap: 6,
  },
  name: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  personality: { fontSize: 11, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
