import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { colors, fonts } from '@/lib/theme'

// Theme is sent to the backend as free text; the emoji/label are just the UI
// (same list as web's /child/story/new).
const THEMES = [
  { key: 'حیوانات', emoji: '🦊', label: 'حیوانات' },
  { key: 'فضا و ستاره‌ها', emoji: '🚀', label: 'فضا' },
  { key: 'دریا و ماهی‌ها', emoji: '🐠', label: 'دریا' },
  { key: 'خانواده', emoji: '👨‍👩‍👧', label: 'خانواده' },
  { key: 'دوستی', emoji: '🤝', label: 'دوستی' },
  { key: 'ماجراجویی', emoji: '🗺️', label: 'ماجراجویی' },
  { key: 'جنگل', emoji: '🌳', label: 'جنگل' },
  { key: 'جشن تولد', emoji: '🎂', label: 'تولد' },
]

export default function NewStory() {
  const insets = useSafeAreaInsets()
  const [theme, setTheme] = useState(THEMES[0].key)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    if (generating) return
    setGenerating(true)
    setError(null)
    const childId = await getActiveChildId()
    if (!childId) { router.replace('/children'); return }
    const res = await api.post<{ id: string }>('/api/ai/stories/generate', { child_id: childId, theme })
    if (res.data?.id) {
      router.replace(`/story/${res.data.id}`)
    } else {
      setError(res.error ?? 'ساختن داستان موفق نبود. دوباره تلاش کن')
      setGenerating(false)
    }
  }

  // Building the story takes a while — show a friendly waiting screen.
  if (generating) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 56 }}>✨</Text>
        <Text style={styles.waitTitle}>در حال نوشتن داستان تو... ✨</Text>
        <Text style={styles.waitSub}>یک لحظه صبر کن، دارم برایت یک داستان می‌سازم!</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>یک داستان برای من بساز ✨</Text>
          <Text style={styles.subtitle}>یک موضوع انتخاب کن</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {THEMES.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.option, theme === t.key && styles.optionActive]}
            onPress={() => setTheme(t.key)}
          >
            <Text style={{ fontSize: 30 }}>{t.emoji}</Text>
            <Text style={[styles.optionLabel, theme === t.key && { color: colors.primary }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={generate}>
        <Text style={styles.buttonText}>بساز! ✨</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, gap: 10, padding: 24,
  },
  content: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb',
    padding: 14, minHeight: 64,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionLabel: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  error: { color: colors.danger, fontFamily: fonts.regular, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontFamily: fonts.bold },
  waitTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  waitSub: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
})
