import { useEffect } from 'react'
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
import { ensurePrefs } from '@/lib/prefs'

// Hydrate family prefs (daily goal, translation language) into their cache.
void ensurePrefs()

// Configure the audio session so story/word clips actually play — without this
// iOS honours the silent switch and produces no sound at all.
setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {})

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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return <Stack screenOptions={{ headerShown: false }} />
}
