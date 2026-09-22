import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AppCharacter, CharacterLine } from '@koodakbook/shared'
import { isSceneSlug } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { playClip } from '@/lib/sound'
import { characterEmoji } from '@/lib/characterEmoji'
import { colors, fonts, ramps } from '@/lib/theme'
import BottomNav from '@/components/BottomNav'
import SceneBackdrop from '@/components/SceneBackdrop'

/**
 * A friend's home (web: /child/friends/[slug]) — greeting plays on arrival,
 * tapping the character replays it, plus a door to قصه‌ها. The «حرف بزنیم»
 * conversation engine stays web-only for now.
 */
function lineFor(c: AppCharacter, trigger: string): CharacterLine | null {
  const matches = (c.lines ?? []).filter((l) => l.trigger === trigger)
  return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
}

export default function FriendHome() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()
  const [chars, setChars] = useState<AppCharacter[] | null>(null)

  useEffect(() => {
    api.get<AppCharacter[]>('/api/characters').then((r) => { if (r.data) setChars(r.data) })
  }, [])

  const character = useMemo(() => chars?.find((c) => c.slug === slug) ?? null, [chars, slug])
  const greeting = useMemo(() => (character ? lineFor(character, 'greeting') : null), [character])

  // The greeting IS the introduction — plays the moment the child arrives.
  useEffect(() => {
    if (!greeting?.audio_url) return
    const t = setTimeout(() => playClip(greeting.audio_url), 450)
    return () => clearTimeout(t)
  }, [greeting])

  if (!chars) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.onPrimary} />
      </View>
    )
  }
  if (!character) { goBack('/friends'); return null }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 92 }]}
    >
      {/* The character's own habitat, not a flat emoji-in-a-circle -- the
          single largest visual-richness gap the audit found (UX High #14).
          home_scene is a real per-character column in this scene-library
          slug space; isSceneSlug guards an unexpected/legacy value. */}
      <View style={styles.hero}>
        <SceneBackdrop
          scene={isSceneSlug(character.home_scene) ? character.home_scene : 'garden'}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <Pressable onPress={() => goBack('/friends')} hitSlop={10}>
            <Text style={styles.back}>→</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.avatarCard}
          onPress={() => greeting?.audio_url && playClip(greeting.audio_url)}
        >
          <Text style={{ fontSize: 96, lineHeight: 110 }}>{characterEmoji(character)}</Text>
        </Pressable>
      </View>

      <Text style={styles.name}>{character.name_persian}</Text>
      <Text style={styles.personality}>{character.personality}</Text>

      {greeting && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>«{greeting.text_persian}»</Text>
          {greeting.audio_url && (
            <Pressable onPress={() => playClip(greeting.audio_url)} hitSlop={8}>
              <Text style={styles.listen}>🔊 دوباره بشنو</Text>
            </Pressable>
          )}
        </View>
      )}

      <Pressable
        style={[styles.door, { backgroundColor: ramps.games.bright }]}
        onPress={() => router.push(`/games/memory?host=${character.slug}`)}
      >
        <Text style={styles.doorEmoji}>🃏</Text>
        <View>
          <Text style={[styles.doorTitle, { color: ramps.games.ink }]}>با هم بازی کنیم!</Text>
          <Text style={[styles.doorSub, { color: ramps.games.ink, opacity: 0.75 }]}>بازی حافظه با {character.name_persian}</Text>
        </View>
      </Pressable>

      <Pressable style={[styles.door, { backgroundColor: ramps.stories.bright }]} onPress={() => router.push('/stories')}>
        <Text style={styles.doorEmoji}>📖</Text>
        <View>
          <Text style={[styles.doorTitle, { color: ramps.stories.ink }]}>قصه بگو!</Text>
          <Text style={[styles.doorSub, { color: ramps.stories.ink, opacity: 0.75 }]}>برو سراغ قصه‌ها</Text>
        </View>
      </Pressable>

      <Pressable
        style={[styles.door, { backgroundColor: ramps.speak.bright }]}
        onPress={() => router.push(`/friend/${character.slug}/talk`)}
      >
        <Text style={styles.doorEmoji}>💬</Text>
        <View>
          <Text style={[styles.doorTitle, { color: ramps.speak.ink }]}>حرف بزنیم!</Text>
          <Text style={[styles.doorSub, { color: ramps.speak.ink, opacity: 0.75 }]}>{character.name_persian} گوش می‌کنه و جواب می‌ده</Text>
        </View>
      </Pressable>
    </ScrollView>
    <BottomNav />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  hero: {
    width: '100%', minHeight: 260, borderRadius: 28, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20, paddingTop: 4,
  },
  header: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', zIndex: 2 },
  back: {
    fontSize: 20, color: colors.text, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)', textAlign: 'center', textAlignVertical: 'center',
    overflow: 'hidden',
  },
  avatarCard: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 26, fontFamily: fonts.display, color: colors.text, marginTop: 6 },
  personality: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  bubble: {
    backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 8,
    alignItems: 'center', width: '100%',
  },
  bubbleText: { fontSize: 15, fontFamily: fonts.regular, color: colors.text, textAlign: 'center', lineHeight: 26 },
  listen: { fontSize: 13, fontFamily: fonts.medium, color: colors.onPrimary },
  door: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 18, marginTop: 6,
  },
  doorLocked: { backgroundColor: '#94a3b8', opacity: 0.6 },
  doorEmoji: { fontSize: 36 },
  doorTitle: { fontSize: 17, fontFamily: fonts.bold, color: '#fff' },
  doorSub: { fontSize: 12, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.85)' },
})
