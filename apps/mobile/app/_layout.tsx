import { useCallback, useEffect } from 'react'
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps, type Theme } from 'expo-router'
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_700Bold,
  Vazirmatn_900Black,
} from '@expo-google-fonts/vazirmatn'
// Vazirmatn_900Black is child headings only (matches web's --font-display,
// docs/design-system.md) -- never used for body text or the letter glyph.
// One typeface app-wide as of the redesign; hierarchy comes from weight
// (900 display vs 400/500/700 body/UI), not a second family.
import { setAudioModeAsync } from 'expo-audio'
import { ensurePrefs } from '@/lib/prefs'
import { fonts, page, ramps, scenery, spacing, textSize } from '@/lib/theme'

// Hydrate family prefs (daily goal, translation language) into their cache.
void ensurePrefs()

// Persian is RTL everywhere. In Expo Go, app.json's extra.forcesRTL is what
// applies RTL: Expo Go resets RTL preferences when it opens a project, so this
// call alone left the app LTR there (seen on the iOS Simulator, 2026-09-25).
// In a native build this call persists RTL, but only from the NEXT launch.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

// Hold the splash until Vazirmatn is ready so no screen flashes system fonts.
SplashScreen.preventAutoHideAsync()
// A short cross-dissolve instead of a hard cut from the flat splash to the
// first screen's gradient. It does not delay anything: the app underneath is
// already live and interactive while the splash fades (native builds only;
// Expo Go shows its own loader instead).
SplashScreen.setOptions({ fade: true, duration: 250 })

/*
 * Every navigator's colours. Without this, React Navigation's DefaultTheme
 * paints rgb(242,242,242) grey:
 *   - as the default background of every screen of a NESTED Stack (the root
 *     Stack's contentStyle does not reach app/parent/_layout.tsx's Stack);
 *   - behind the screens, as each native ScreenStack's own container
 *     background (react-native-screens `nativeContainerStyle`), which a
 *     contentStyle can't reach at all and which shows through during push/pop
 *     and fade transitions and on Android's slide/fade animations.
 * With the theme on page.base, no navigator anywhere can show a frame of grey.
 */
const NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: page.base, card: page.base, text: scenery.ink },
}

/*
 * The entry screens and the four BottomNav tabs are only ever reached with
 * router.replace (the auth gate's redirect, login <-> signup, Home's redirects
 * to the child picker and to placement, BottomNav): each is a new scene, not a
 * drill-down. Tab switches fade in both directions, like a tab bar. A replace
 * animates like a push by default, so at startup the gate's spinner visibly
 * slid away under Home's identical loading spinner. A fade between two
 * identical loading frames is invisible, and between scenes it reads as a
 * scene change.
 */
const SCENE_ROUTES = [
  'index', 'login', 'signup', 'onboarding', 'children', 'placement',
  // BottomNav tabs (components/BottomNav.tsx TABS)
  'home', 'lessons', 'stories', 'rewards',
]

/*
 * Startup, 2026-09-25 theme-flash fix. The first frame must already be the
 * app's real background. What used to happen, in order:
 *   1. native splash, #FFF8EA (app.json)
 *   2. SplashScreen.hideAsync() fired on the first JS render, handing over to
 *      LaunchScreen -- a separate illustrated sky/terrain scene -- which was
 *      then HELD for at least 1100ms by a setTimeout, even though fonts
 *      usually load in under 100ms (the "old colours for about a second")
 *   3. React Navigation's default card, rgb(242,242,242) grey, behind every
 *      screen (the Stack set no contentStyle)
 *   4. the auth gate (app/index.tsx) on flat colors.bg, #fdf6ec
 *   5. only then Home's warm gradient
 * Now: the native splash (page.base) stays up until fonts are ready AND this
 * root has laid out, then hides straight onto screens that paint page.base /
 * page.gradient. No timer, no intermediate scene. LaunchScreen.tsx is no
 * longer on the startup path.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_700Bold,
    Vazirmatn_900Black,
  })
  // A font that fails to load falls back to the system font rather than
  // leaving the splash up forever.
  const ready = fontsLoaded || !!fontError

  // Configure the audio session once mounted (not at module-eval, when the
  // native module may not be ready) so clips play even with the silent switch.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {})
  }, [])

  // Hide the native splash only once the real root has laid out, so there is
  // no frame between the splash and the app's own background.
  const onLayoutRoot = useCallback(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // The native splash is still covering the screen while this is null.
  if (!ready) return null

  return (
    <View style={{ flex: 1, backgroundColor: page.base }} onLayout={onLayoutRoot}>
      {/* Dark icons on the cream page, explicitly (Android edge-to-edge picks
          the status bar style from the system theme otherwise). */}
      <StatusBar style="dark" />
      <ThemeProvider value={NAV_THEME}>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: page.base },
            ...(SCENE_ROUTES.includes(route.name) ? { animation: 'fade' as const } : null),
          })}
        />
      </ThemeProvider>
    </View>
  )
}

/*
 * Last-resort crash screen for the whole app. Without it a render error in
 * production unmounts everything (a blank page, or the splash left up if it
 * happens before the first layout) and in development shows expo-router's
 * white default. Same page, ink and clay button as the rest of the app; the
 * button re-renders the tree.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View
      style={styles.crash}
      onLayout={() => { SplashScreen.hideAsync().catch(() => {}) }}
      accessibilityLiveRegion="polite"
    >
      <StatusBar style="dark" />
      {/* Home's wordmark: even the crash page is recognisably KoodakBook. */}
      <Text style={styles.crashMark} maxFontSizeMultiplier={1.3} accessibilityLabel="کودک‌بوک">کودک‌بوک</Text>
      <Text style={styles.crashTitle} accessibilityRole="header">یک مشکلی پیش آمد</Text>
      <Text style={styles.crashBody}>دوباره امتحان کن</Text>
      <Pressable
        onPress={() => { void retry() }}
        accessibilityRole="button"
        accessibilityLabel="دوباره امتحان کن"
        style={({ pressed }) => [styles.crashButton, pressed && styles.crashButtonPressed]}
      >
        <Text style={styles.crashButtonText}>دوباره</Text>
      </Pressable>
    </View>
  )
}

// Plain Views (not Clay/ScreenBackground): this screen must render even when
// the error came from one of those components.
const styles = StyleSheet.create({
  crash: {
    flex: 1, backgroundColor: page.base, alignItems: 'center', justifyContent: 'center',
    padding: spacing.lg, gap: spacing.md,
  },
  crashMark: { fontFamily: fonts.display, fontSize: textSize.h2, color: ramps.brand.ink, textAlign: 'center' },
  crashTitle: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: scenery.ink, textAlign: 'center' },
  crashBody: { fontFamily: fonts.regular, fontSize: textSize.small, color: scenery.ink, textAlign: 'center' },
  crashButton: {
    minHeight: 56, minWidth: 160, paddingHorizontal: spacing.lg, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: ramps.brand.bright, borderBottomWidth: 6, borderColor: ramps.brand.deep,
  },
  crashButtonPressed: { borderBottomWidth: 2, marginTop: 4 },
  crashButtonText: { fontFamily: fonts.bold, fontSize: textSize.body, color: ramps.brand.ink },
})
