import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { Letter } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { playClip } from '@/lib/sound'
import { colors, fonts } from '@/lib/theme'

const CANVAS = 300

/** تمرین نوشتن (web: /child/write) — trace each letter over a faint guide. */
export default function Write() {
  const insets = useSafeAreaInsets()
  const [letters, setLetters] = useState<Letter[] | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    api.get<Letter[]>('/api/letters').then((res) => setLetters(res.data ?? []))
  }, [])

  const letter = letters?.[idx]

  // Say each letter as it appears; the button stays for replay.
  useEffect(() => {
    if (!letter) return
    const t = setTimeout(() => playClip(letter.audio_url), 350)
    return () => clearTimeout(t)
  }, [letter?.id])

  if (!letters) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }
  if (letters.length === 0 || !letter) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>حرفی برای تمرین نیست</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>تمرین نوشتن ✏️</Text>
          <Text style={styles.subtitle}>حرف {toPersianDigits(idx + 1)} از {toPersianDigits(letters.length)}</Text>
        </View>
      </View>

      <Pressable style={styles.letterChip} onPress={() => playClip(letter.audio_url)}>
        <Text style={styles.letterChar}>{letter.character}</Text>
        <Text style={styles.letterName}>{letter.name_persian}</Text>
        <Text style={{ fontSize: 18 }}>🔊</Text>
      </Pressable>

      <TracingCanvas key={letter.id} letter={letter.character} />

      <View style={styles.nav}>
        <Pressable
          style={[styles.navButton, idx === 0 && styles.navDisabled]}
          disabled={idx === 0}
          onPress={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <Text style={styles.navText}>قبلی</Text>
        </Pressable>
        <Pressable
          style={[styles.navButton, styles.navNext, idx === letters.length - 1 && styles.navDisabled]}
          disabled={idx === letters.length - 1}
          onPress={() => setIdx((i) => Math.min(letters.length - 1, i + 1))}
        >
          <Text style={[styles.navText, { color: '#fff' }]}>بعدی ←</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** A drawing surface: strokes captured as SVG paths over a faint guide letter. */
function TracingCanvas({ letter }: { letter: string }) {
  const [paths, setPaths] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const currentRef = useRef('')

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`
          setCurrent(currentRef.current)
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent
          currentRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`
          setCurrent(currentRef.current)
        },
        onPanResponderRelease: () => {
          if (currentRef.current) setPaths((p) => [...p, currentRef.current])
          currentRef.current = ''
          setCurrent('')
        },
      }),
    []
  )

  const hasDrawn = paths.length > 0 || current !== ''

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={styles.canvas} {...responder.panHandlers}>
        {/* Faint guide letter behind the strokes */}
        <Text style={styles.guide} pointerEvents="none">{letter}</Text>
        <Svg width={CANVAS} height={CANVAS} style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#2563eb" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {current !== '' && (
            <Path d={current} stroke="#2563eb" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </Svg>
      </View>
      <Pressable
        style={[styles.clearButton, hasDrawn ? styles.clearActive : styles.clearIdle]}
        onPress={() => { setPaths([]); setCurrent(''); currentRef.current = '' }}
      >
        <Text style={[styles.clearText, { color: hasDrawn ? '#b45309' : colors.muted }]}>🧹 پاک کن</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20, gap: 16, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  empty: { color: colors.muted, fontFamily: fonts.regular },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  letterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10,
  },
  letterChar: { fontSize: 26, fontFamily: fonts.bold, color: colors.text },
  letterName: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted },
  canvas: {
    width: CANVAS, height: CANVAS, backgroundColor: colors.card, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  guide: { fontSize: CANVAS * 0.6, fontFamily: fonts.bold, color: '#e5e7eb', lineHeight: CANVAS },
  clearButton: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  clearActive: { backgroundColor: '#fef3c7' },
  clearIdle: { backgroundColor: '#f1f5f9' },
  clearText: { fontSize: 13, fontFamily: fonts.medium },
  nav: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 'auto' },
  navButton: {
    flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    borderWidth: 2, borderColor: '#e2e8f0',
  },
  navNext: { flex: 2, backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  navDisabled: { opacity: 0.4 },
  navText: { fontSize: 16, fontFamily: fonts.bold, color: colors.muted },
})
