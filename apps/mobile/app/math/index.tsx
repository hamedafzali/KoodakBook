import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, ramps } from '@/lib/theme'
import ScreenHeader from '@/components/ScreenHeader'
import BottomNav from '@/components/BottomNav'

/** دنیای اعداد — mobile hub for the math games (web: /child/math). */
const GAMES = [
  { key: 'counting', emoji: '🍎', title: 'شمارش', sub: 'ضربه بزن و بشمار', href: '/math/counting' as const, tint: ramps.math.soft },
  { key: 'digits', emoji: '۳', title: 'رقم‌های فارسی', sub: '۷ همان 7 است!', href: '/math/digits' as const, tint: ramps.math.soft },
  { key: 'bazaar', emoji: '🛒', title: 'بازار', sub: 'با تومان خرید کن', href: '/math/bazaar' as const, tint: ramps.math.soft },
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
          style={[styles.card, { backgroundColor: g.tint }, !g.href && { opacity: 0.55 }]}
          disabled={!g.href}
          onPress={() => g.href && router.push(g.href)}
        >
          <Text style={{ fontSize: 40 }}>{g.emoji}</Text>
          <View>
            <Text style={styles.gameTitle}>{g.title}</Text>
            <Text style={styles.gameSub}>{g.sub}</Text>
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
