import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, tones } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/** دنیای اعداد — mobile hub for the math games (web: /child/math). */
const GAMES = [
  { key: 'counting', emoji: '🍎', title: 'شمارش', sub: 'ضربه بزن و بشمار', href: '/math/counting' as const, tone: tones.emerald },
  { key: 'digits', emoji: '۳', title: 'رقم‌های فارسی', sub: '۷ همان 7 است!', href: '/math/digits' as const, tone: tones.sky },
  { key: 'bazaar', emoji: '🛒', title: 'بازار', sub: 'با تومان خرید کن', href: '/math/bazaar' as const, tone: tones.amber },
]

export default function MathHub() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      <ScreenHeader title="دنیای اعداد 🔢" />

      {GAMES.map((g) => (
        <Pressable
          key={g.key}
          style={[
            styles.card,
            { backgroundColor: g.tone.fill, borderBottomColor: g.tone.edge, borderBottomWidth: 4 },
            !g.href && { opacity: 0.55 },
          ]}
          disabled={!g.href}
          onPress={() => g.href && router.push(g.href)}
        >
          <Text style={{ fontSize: 40 }}>{g.emoji}</Text>
          <View>
            <Text style={[styles.gameTitle, { color: g.tone.ink }]}>{g.title}</Text>
            <Text style={[styles.gameSub, { color: g.tone.ink, opacity: 0.75 }]}>{g.sub}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
    <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 20, padding: 18 },
  gameTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
  gameSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
})
