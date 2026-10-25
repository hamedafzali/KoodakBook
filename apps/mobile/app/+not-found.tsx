import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClayButton } from '@/components/Clay'
import { colors, fonts, ramps, scenery, spacing, textSize } from '@/lib/theme'

/**
 * Unknown route (a stale or mistyped koodakbook:// link, including on a cold
 * start). expo-router's default here is a white, English "Unmatched Route"
 * page, the one screen that broke the app's page and type. The button goes
 * through the auth gate ('/'), which sends a signed-in family Home and anyone
 * else to login.
 */
export default function NotFound() {
  return (
    <ScreenBackground variant="warm">
      <View style={styles.center}>
        {/* سیمرغ, puzzled; CharacterArt is already hidden from screen readers. */}
        <CharacterArt character="simorgh" emotion="thinking" size={120} />
        <Text style={styles.title} accessibilityRole="header">این صفحه پیدا نشد</Text>
        <Text style={styles.body}>بیا برگردیم به خانه</Text>
        <ClayButton ramp={ramps.brand} label="برگشت به خانه" emoji="🏠" onPress={() => router.replace('/')} style={styles.button} />
      </View>
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: scenery.ink, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: textSize.small, color: colors.text, textAlign: 'center' },
  button: { width: '100%', maxWidth: 360 },
})
