import { useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import type { EmotionName } from 'pixel-wizards-charachters'
import { CharacterArt, ClayButton, TextButton } from '@/components/Clay'
import { markTutorialSeen } from '@/lib/prefs'
import { toPersianDigits } from '@koodakbook/shared'
import { colors, elevation, fonts, radii, ramps, scenery, spacing, textSize, ui } from '@/lib/theme'

// First-run walkthrough (web: components/child/Tutorial.tsx). Shown once, then
// the seen flag is stored so it never reappears.
//
// 2026-09-25 (illustration pass): each slide shows its real character instead
// of an emoji -- the first slide literally says «من سیمرغم» ("I'm Simorgh")
// and used to show 🦅. Rooms get their hosts from web's kit.tsx MODULE
// mapping (lessons -> روزی, stories -> پشمک, rewards -> سیمرغ). `emoji` stays
// as the fallback if a slide ever has no character.
//
// 2026-09-26 consistency pass: the action is Home's own ClayButton (brand
// ramp -- the same amber and ink the flat button had), the title is the child
// heading voice (display cut, scenery.ink), and the dialog is modal to screen
// readers, with the step count spoken and the dots hidden.
const STEPS: { emoji: string; character?: string; emotion?: EmotionName; title: string; body: string }[] = [
  { emoji: '🦅', character: 'simorgh', emotion: 'happy', title: 'سلام! من سیمرغم', body: 'با هم فارسی یاد می‌گیریم. آماده‌ای؟' },
  { emoji: '📚', character: 'roozi', emotion: 'encouraging', title: 'درس‌ها', body: 'روی کارت‌ها ضربه بزن تا کلمه‌ها را بشنوی و بازی کنی.' },
  { emoji: '📖', character: 'pashmak', emotion: 'encouraging', title: 'داستان‌ها', body: 'داستان‌های قشنگ بخوان و گوش کن.' },
  { emoji: '🏆', character: 'simorgh', emotion: 'proud', title: 'جایزه‌ها', body: 'هر چه بیشتر تمرین کنی، جایزه‌های بیشتری می‌گیری!' },
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
        <View style={styles.card} accessibilityViewIsModal>
          {current.character
            ? <CharacterArt character={current.character} emotion={current.emotion} size={120} />
            : <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">{current.emoji}</Text>}
          <Text style={styles.title} accessibilityRole="header">
            {step === 0 && childName ? `سلام ${childName}! 👋` : current.title}
          </Text>
          <Text style={styles.body}>{current.body}</Text>

          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`${toPersianDigits(step + 1)} از ${toPersianDigits(STEPS.length)}`}
          >
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <ClayButton
            ramp={ramps.brand}
            label={isLast ? 'بریم بازی کنیم!' : 'بعدی'}
            emoji={isLast ? '🎈' : undefined}
            icon={isLast ? undefined : 'chevron'}
            iconPosition="end"
            accessibilityLabel={isLast ? 'بریم بازی کنیم' : 'بعدی'}
            onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
            style={styles.button}
          />
          {/* Tertiary action: the shared TextButton (44pt, underlined). */}
          {!isLast && <TextButton label="رد کن" onPress={finish} size="caption" />}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: ui.scrim, alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 28, alignItems: 'center', gap: 10, width: '100%', maxWidth: 340, ...elevation.modal },
  emoji: { fontSize: 64 },
  title: { fontSize: textSize.h2, fontFamily: fonts.display, color: scenery.ink, textAlign: 'center' },
  // colors.text: body copy a child (or a parent reading aloud) actually reads.
  body: { fontSize: textSize.small, fontFamily: fonts.regular, color: colors.text, textAlign: 'center', lineHeight: 26 },
  dots: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  // ui.track, not the cold grey colors.border: warm like every other track.
  dot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: ui.track },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  button: { alignSelf: 'stretch', marginTop: spacing.xs },
})
