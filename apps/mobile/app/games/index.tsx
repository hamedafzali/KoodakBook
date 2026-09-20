import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenBackground from '@/components/ScreenBackground'
import { colors, fonts, tones } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

const GAMES = [
  { key: 'memory', emoji: '🃏', title: 'بازی حافظه', sub: 'جفت هر کلمه را پیدا کن', href: '/games/memory' as const, tone: tones.violet },
  { key: 'marpele', emoji: '🎲', title: 'مارپله', sub: 'تنها، با خواهر و برادر، یا با دوستان بازی کن', href: '/games/marpele' as const, tone: tones.orange },
  { key: 'marpele-online', emoji: '🌐', title: 'مارپله آنلاین', sub: 'با دوستانت از راه دور بازی کن', href: '/games/marpele-online' as const, tone: tones.teal },
]

export default function GamesHub() {
  const insets = useSafeAreaInsets()
  return (
    <ScreenBackground variant="warm">
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}>
        <ScreenHeader title="بازی‌ها 🃏" />

        {GAMES.map((g) => (
          <Pressable
            key={g.key}
            style={[styles.card, { backgroundColor: g.tone.fill, borderBottomColor: g.tone.edge, borderBottomWidth: 4 }]}
            onPress={() => router.push(g.href)}
          >
            <Text style={{ fontSize: 44 }}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.gameTitle, { color: g.tone.ink }]}>{g.title}</Text>
              <Text style={[styles.gameSub, { color: g.tone.ink, opacity: 0.75 }]}>{g.sub}</Text>
            </View>
            <Text style={{ fontSize: 20, color: g.tone.ink }}>←</Text>
          </Pressable>
        ))}
      </ScrollView>
      <BottomNav />
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 22, padding: 18 },
  gameTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  gameSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
})
