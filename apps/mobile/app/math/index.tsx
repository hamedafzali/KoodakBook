import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts } from '@/lib/theme'

/** دنیای اعداد — mobile hub for the math games (web: /child/math). */
const GAMES = [
  { key: 'counting', emoji: '🍎', title: 'شمارش', sub: 'ضربه بزن و بشمار', href: '/math/counting' as const, tint: '#dcfce7' },
  { key: 'digits', emoji: '۳', title: 'رقم‌ها', sub: 'به زودی', href: null, tint: '#dbeafe' },
  { key: 'bazaar', emoji: '🧺', title: 'بازار', sub: 'به زودی', href: null, tint: '#fef3c7' },
]

export default function MathHub() {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={styles.title}>دنیای اعداد 🔢</Text>
      </View>

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
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 20, padding: 18 },
  gameTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  gameSub: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
})
