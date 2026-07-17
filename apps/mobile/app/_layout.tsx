import { Stack } from 'expo-router'
import { I18nManager } from 'react-native'

// Persian is RTL everywhere. app.json's extra.supportsRTL covers native
// builds; this runtime call covers Expo Go (takes effect after one reload).
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
