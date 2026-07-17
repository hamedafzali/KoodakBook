import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { getToken } from '@/lib/auth'
import { colors } from '@/lib/theme'

/** Auth gate: token → child picker, otherwise login. */
export default function Index() {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking')

  useEffect(() => {
    getToken().then((t) => setState(t ? 'in' : 'out'))
  }, [])

  if (state === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  return <Redirect href={state === 'in' ? '/home' : '/login'} />
}
