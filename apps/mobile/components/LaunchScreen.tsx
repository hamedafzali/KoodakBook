import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import ScreenBackground from './ScreenBackground'
import { StoryScene } from './AuthScene'

/**
 * Branded launch screen shown while fonts load (was a blank/text screen). Uses
 * the SVG story illustration + system font (Vazirmatn isn't loaded yet) on the
 * warm gradient, so the app opens on-brand instead of a flash of plain text.
 */
export default function LaunchScreen() {
  return (
    <ScreenBackground variant="warm" decor>
      <View style={styles.center}>
        <StoryScene />
        <Text style={styles.title}>کودک‌ بوک</Text>
        <Text style={styles.tag}>هر شب یک قصه‌ی فارسی</Text>
        <ActivityIndicator color="#f59e0b" style={{ marginTop: 18 }} />
      </View>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  // System font — Vazirmatn hasn't loaded when this shows; Persian renders fine.
  title: { fontSize: 34, fontWeight: 'bold', color: '#3b2f2f', marginTop: 8 },
  tag: { fontSize: 15, color: '#7a6a58' },
})
