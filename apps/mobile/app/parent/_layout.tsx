import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { setParentUnlocked } from '@/lib/parentGate'
import { colors } from '@/lib/theme'

export default function ParentLayout() {
  // Leaving the parent area re-locks it — popping back to child mode means the
  // next visit faces the PIN again (the child may now be holding the phone).
  useEffect(() => () => setParentUnlocked(false), [])
  // The parent register's own page colour behind every parent screen (the
  // root layout's navigation theme would otherwise give this nested Stack the
  // child page.base, and before that theme existed, React Navigation's grey).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
}
