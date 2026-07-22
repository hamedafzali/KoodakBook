import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { setParentUnlocked } from '@/lib/parentGate'

export default function ParentLayout() {
  // Leaving the parent area re-locks it — popping back to child mode means the
  // next visit faces the PIN again (the child may now be holding the phone).
  useEffect(() => () => setParentUnlocked(false), [])
  return <Stack screenOptions={{ headerShown: false }} />
}
