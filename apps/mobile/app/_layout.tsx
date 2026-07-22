import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { I18nManager } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_700Bold,
} from '@expo-google-fonts/vazirmatn'
import { setAudioModeAsync } from 'expo-audio'
import LaunchScreen from '@/components/LaunchScreen'
import { ensurePrefs } from '@/lib/prefs'

// Hydrate family prefs (daily goal, translation language) into their cache.
void ensurePrefs()

// Persian is RTL everywhere. app.json's extra.supportsRTL covers native
// builds; this runtime call covers Expo Go (takes effect after one reload).
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

// Hold the splash until Vazirmatn is ready so no screen flashes system fonts.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_700Bold,
  })
  // Hold the branded launch screen for a beat so it registers as a real moment
  // (fonts often load in <100ms, which would flash it past).
  const [minShown, setMinShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinShown(true), 1100)
    return () => clearTimeout(t)
  }, [])

  // Configure the audio session once mounted (not at module-eval, when the
  // native module may not be ready) so clips play even with the silent switch.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {})
  }, [])

  // Hand off from the native splash to our own branded launch screen right
  // away, so font-loading shows the illustration rather than a blank/text flash.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  if (!fontsLoaded || !minShown) return <LaunchScreen />

  return <Stack screenOptions={{ headerShown: false }} />
}
