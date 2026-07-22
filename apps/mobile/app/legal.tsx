import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LEGAL_PRIVACY, LEGAL_TERMS } from '@koodakbook/shared'
import { colors, fonts } from '@/lib/theme'

/** Privacy + terms (web: /privacy, /terms). Content shared from @koodakbook/shared. */
export default function Legal() {
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
        <Text style={styles.title}>قوانین و حریم خصوصی</Text>
      </View>

      <Text style={styles.intro}>
        کودک‌بوک برای کودکان ساخته شده و ما این را یک مسئولیت می‌دانیم، نه یک بند حقوقی.
      </Text>

      <Text style={styles.sectionTitle}>حریم خصوصی 🔐</Text>
      {LEGAL_PRIVACY.map((s) => (
        <View key={s.h} style={styles.block}>
          <Text style={styles.blockHead}>{s.h}</Text>
          {s.body.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.sectionTitle}>شرایط استفاده 📄</Text>
      {LEGAL_TERMS.map((s) => (
        <View key={s.h} style={styles.block}>
          <Text style={styles.blockHead}>{s.h}</Text>
          <Text style={styles.bodyText}>{s.t}</Text>
        </View>
      ))}

      <Text style={styles.version}>KoodakBook v0.1.0</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  intro: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, lineHeight: 22 },
  sectionTitle: { fontSize: 18, fontFamily: fonts.bold, color: colors.text, marginTop: 12 },
  block: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 6 },
  blockHead: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 14, color: colors.muted },
  bulletText: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.text, lineHeight: 22 },
  bodyText: { fontSize: 13, fontFamily: fonts.regular, color: colors.text, lineHeight: 22 },
  version: { textAlign: 'center', fontSize: 12, fontFamily: fonts.regular, color: colors.muted, marginTop: 8 },
})
