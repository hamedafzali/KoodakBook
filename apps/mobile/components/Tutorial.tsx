import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { markTutorialSeen } from '@/lib/prefs'
import { colors, fonts } from '@/lib/theme'

// First-run walkthrough (web: components/child/Tutorial.tsx). Shown once, then
// the seen flag is stored so it never reappears.
const STEPS = [
  { emoji: '🦅', title: 'سلام! من سیمرغم', body: 'با هم فارسی یاد می‌گیریم. آماده‌ای؟' },
  { emoji: '📚', title: 'درس‌ها', body: 'روی کارت‌ها ضربه بزن تا کلمه‌ها را بشنوی و بازی کنی.' },
  { emoji: '📖', title: 'داستان‌ها', body: 'داستان‌های قشنگ بخوان و گوش کن.' },
  { emoji: '🏆', title: 'جایزه‌ها', body: 'هر چه بیشتر تمرین کنی، جایزه‌های بیشتری می‌گیری!' },
]

export default function Tutorial({ childName, onClose }: { childName?: string; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  function finish() {
    markTutorialSeen()
    onClose()
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.title}>
            {step === 0 && childName ? `سلام ${childName}! 👋` : current.title}
          </Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <Pressable style={styles.button} onPress={() => (isLast ? finish() : setStep((s) => s + 1))}>
            <Text style={styles.buttonText}>{isLast ? 'بریم بازی کنیم! 🎈' : 'بعدی ←'}</Text>
          </Pressable>
          {!isLast && (
            <Pressable onPress={finish} hitSlop={8}>
              <Text style={styles.skip}>رد کن</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: colors.card, borderRadius: 28, padding: 28, alignItems: 'center', gap: 10, width: '100%', maxWidth: 340 },
  emoji: { fontSize: 64 },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  button: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 40, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: fonts.bold },
  skip: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 4 },
})
