import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { getToken } from '@/lib/auth'
import { ensurePrefs } from '@/lib/prefs'
import ScreenBackground from '@/components/ScreenBackground'
import { colors } from '@/lib/theme'

/** Auth gate: token → child picker, otherwise login. */
export default function Index() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    // Prefs are awaited here too (already in flight from the root layout, and
    // read in parallel with the token, so no added wait): no screen after the
    // gate can render with the in-memory defaults and then swap to the stored
    // values (Home's daily goal, the tutorial flag).
    // A keychain read that throws (e.g. an item not readable in the current
    // lock state) used to leave this spinner up forever; it now counts as
    // signed out and lands on login.
    Promise.all([getToken(), ensurePrefs()])
      .then(([t]) => setState(t ? 'in' : 'out'))
      .catch(() => setState('out'))
  }, [])

  // The first screen after the splash: same background and spinner as Home's
  // own loading state, so splash -> auth check -> Home loading -> Home never
  // changes colour (it used to sit on flat colors.bg, #fdf6ec).
  if (state === 'checking') {
    return (
      <ScreenBackground variant="warm">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.onPrimary} accessibilityLabel="در حال بارگذاری" />
        </View>
      </ScreenBackground>
    )
  }
  return <Redirect href={state === 'in' ? '/home' : '/login'} />
}
