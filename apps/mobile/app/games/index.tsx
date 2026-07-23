import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenBackground from '@/components/ScreenBackground'
import { colors, fonts } from '@/lib/theme'

const GAMES = [
  { key: 'memory', emoji: '🃏', title: 'بازی حافظه', sub: 'جفت هر کلمه را پیدا کن', href: '/games/memory' as const, tint: '#e0e7ff' },
  { key: 'marpele', emoji: '🎲', title: 'مارپله', sub: 'تنها، با خواهر و برادر، یا با دوستان بازی کن', href: '/games/marpele' as const, tint: '#dcfce7' },
]

export default function GamesHub() {
  const insets = useSafeAreaInsets()
  return (
    <ScreenBackground variant="warm">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.back}>→</Text>
          </Pressable>
          <Text style={styles.title}>بازی‌ها 🃏</Text>
        </View>

        {GAMES.map((g) => (
          <Pressable key={g.key} style={[styles.card, { backgroundColor: g.tint }]} onPress={() => router.push(g.href)}>
            <Text style={{ fontSize: 44 }}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.gameTitle}>{g.title}</Text>
              <Text style={styles.gameSub}>{g.sub}</Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.muted }}>←</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 22, padding: 18 },
  gameTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  gameSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
})
