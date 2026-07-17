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
