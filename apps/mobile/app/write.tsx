import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { Letter } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { playClip, stopClip } from '@/lib/sound'
import { clay, fonts, iconSize, naturalLineHeight, radii, ramps, spacing, textSize, ui } from '@/lib/theme'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayButton, ClaySurface } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RoomBand, RoomProgress } from '@/components/RoomScene'
import BottomNav from '@/components/BottomNav'
import LoadState, { EmptyState } from '@/components/LoadState'
import { goBack } from '@/lib/navigation'

const CANVAS = 300
// The container's side padding (styles.container, spacing.md since the lead's
// 2026-09-26 inset fix; this still said 20) plus the clay frame's soft border
// (2pt each side): what the canvas has to fit inside. 320pt -> 284pt canvas.
const CANVAS_INSET = spacing.md * 2 + 2 * 2
// The child's ink: the write ramp's deep stop (was a one-off blue).
const STROKE = ramps.write.deep

/** تمرین نوشتن (web: /child/write) — trace each letter over a faint guide. */
export default function Write() {
  const insets = useSafeAreaInsets()
  const [letters, setLetters] = useState<Letter[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  const [idx, setIdx] = useState(0)
  // A fixed 300pt canvas overflowed a 320pt-wide screen (280pt of room); it
  // now shrinks to fit there and stays 300 on wider phones.
  const { width: windowW } = useWindowDimensions()
  const canvasSize = Math.floor(Math.min(CANVAS, windowW - CANVAS_INSET))
  // The page scrolls, so a vertical stroke on the canvas also dragged the
  // ScrollView and cut the stroke off. Scrolling pauses while a finger draws.
  const [drawing, setDrawing] = useState(false)
  // A letter still playing when the child leaves must not follow them.
  useEffect(() => () => stopClip(), [])

  useEffect(() => {
    // Leaving before the fetch settles used to set state on an unmounted screen.
    let alive = true
    // A failed fetch used to land on the empty «حرفی برای تمرین نیست» state.
    api.get<Letter[]>('/api/letters').then((res) => {
      if (!alive) return
      if (res.data) setLetters(res.data)
      else setError(res.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
    })
    return () => { alive = false }
  }, [reloadKey])

  const letter = letters?.[idx]

  // Say each letter as it appears; the button stays for replay.
  useEffect(() => {
    if (!letter) return
    const t = setTimeout(() => playClip(letter.audio_url), 350)
    return () => clearTimeout(t)
  }, [letter?.id])

  if (!letters) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
        </View>
      </ScreenBackground>
    )
  }
  if (letters.length === 0 || !letter) {
    // The header and nav too: this used to be a bare line with no way out.
    return (
      <ScreenBackground variant="warm">
        <RoomBand ramp={ramps.write} emoji="✍️" title="تمرین نوشتن" topInset={insets.top} />
        {/* A successful, empty list: a friendly note, not an error. The
            write room has no host, so سیمرغ, the app's guide, says it. */}
        <View style={[styles.center, styles.emptyWrap]}>
          <EmptyState
            emotion="thinking"
            title="هنوز حرفی برای نوشتن نیست"
            body="به‌زودی حرف‌های تازه می‌رسه."
          />
        </View>
        <BottomNav />
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      {/* Content scrolls; nav stays reachable even on a short device (e.g.
       * iPhone SE) instead of being pinned off-screen below the fold via
       * marginTop: 'auto' on a non-scrolling container -- web hit and fixed
       * this exact reachability problem first (2026-09-20 audit, High #13). */}
      <ScrollView
        scrollEnabled={!drawing}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 108 }]}
      >
        {/* The write room's band (components/RoomScene.tsx): Home's world
            tinted cyan, the room's ✍️ disc on the hills (no host here, Home's
            fallback), and the letter count as a track. Full-bleed. */}
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={ramps.write}
            emoji="✍️"
            title="تمرین نوشتن"
            subtitle="روی حرف کم‌رنگ بکش"
            topInset={insets.top}
          >
            <RoomProgress
              ramp={ramps.write}
              done={idx}
              total={letters.length}
              meta={`حرف ${toPersianDigits(idx + 1)} از ${toPersianDigits(letters.length)}`}
              label={`حرف ${toPersianDigits(idx + 1)} از ${toPersianDigits(letters.length)}`}
            />
          </RoomBand>
        </View>

        <Pressable
          onPress={() => playClip(letter.audio_url)}
          accessibilityRole="button"
          accessibilityLabel={`${letter.name_persian}، بشنو`}
        >
          {({ pressed }) => (
            <ClaySurface ramp={ramps.write} tone="soft" pressed={pressed} radius={radii.md} edge={clay.edgeSm} faceStyle={styles.letterChip}>
              <Text style={styles.letterChar}>{letter.character}</Text>
              <Text style={styles.letterName}>{letter.name_persian}</Text>
              <Icon name="volume" color={ramps.write.ink} size={iconSize.control} />
            </ClaySurface>
          )}
        </Pressable>

        <TracingCanvas key={letter.id} letter={letter.character} size={canvasSize} onDrawingChange={setDrawing} />

        <View style={styles.nav}>
          <ClayButton
            ramp={ramps.write}
            tone="soft"
            label="قبلی"
            icon="chevronBack"
            disabled={idx === 0}
            onPress={() => setIdx((i) => Math.max(0, i - 1))}
            style={styles.navPrev}
          />
          <ClayButton
            ramp={ramps.write}
            label="بعدی"
            icon="chevron"
            iconPosition="end"
            disabled={idx === letters.length - 1}
            onPress={() => setIdx((i) => Math.min(letters.length - 1, i + 1))}
            style={styles.navNext}
          />
        </View>
      </ScrollView>
      <BottomNav />
    </ScreenBackground>
  )
}

/** A drawing surface: strokes captured as SVG paths over a faint guide letter. */
function TracingCanvas({ letter, size, onDrawingChange }: {
  letter: string
  size: number
  onDrawingChange: (drawing: boolean) => void
}) {
  const [paths, setPaths] = useState<string[]>([])
  const [current, setCurrent] = useState('')
  const currentRef = useRef('')
  // The responder is built once; read the latest callback through a ref.
  const drawingCb = useRef(onDrawingChange)
  drawingCb.current = onDrawingChange
  // Unmounting mid-stroke (next letter, leaving) must not leave scrolling off.
  useEffect(() => () => drawingCb.current(false), [])

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Keep the stroke: don't hand the touch to the ScrollView mid-line.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          drawingCb.current(true)
          const { locationX, locationY } = e.nativeEvent
          currentRef.current = `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`
          setCurrent(currentRef.current)
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent
          currentRef.current += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`
          setCurrent(currentRef.current)
        },
        onPanResponderRelease: () => endStroke(),
        // Taken away anyway (the system, an incoming call): keep what was
        // drawn instead of leaving a half stroke that the next touch erased.
        onPanResponderTerminate: () => endStroke(),
      }),
    []
  )

  function endStroke() {
    const d = currentRef.current
    if (d) setPaths((p) => [...p, d])
    currentRef.current = ''
    setCurrent('')
    drawingCb.current(false)
  }

  const hasDrawn = paths.length > 0 || current !== ''

  return (
    <View style={styles.canvasColumn}>
      {/* Clay frame around the canvas only: the PanResponder view and the
          SVG share one size, so locationX/Y still map 1:1 onto the SVG. */}
      <ClaySurface ramp={ramps.write} tone="soft" radius={radii.md}>
      <View
        style={[styles.canvas, { width: size, height: size }]}
        accessible
        accessibilityLabel={`جای نوشتن حرف ${letter}`}
        {...responder.panHandlers}
      >
        {/* Faint guide letter behind the strokes */}
        <Text style={[styles.guide, { fontSize: size * 0.6, lineHeight: size }]} pointerEvents="none">{letter}</Text>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={STROKE} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
          {current !== '' && (
            <Path d={current} stroke={STROKE} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </Svg>
      </View>
      </ClaySurface>
      {/* Faded (disabled) until there is something to clear: the same
          idle/active cue the old grey/amber pill gave. */}
      <ClayButton
        ramp={ramps.write}
        tone="soft"
        label="پاک کن"
        emoji="🧹"
        disabled={!hasDrawn}
        onPress={() => { setPaths([]); setCurrent(''); currentRef.current = '' }}
      />
    </View>
  )
}

// Home's rhythm between sibling items: 12, between the scale's 8 and 16.
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.md, gap: spacing.md, alignItems: 'center' },
  // Full-bleed: undo the container's side padding for the band.
  bandWrap: { alignSelf: 'stretch', marginHorizontal: -spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Clear of the absolutely positioned BottomNav.
  emptyWrap: { paddingBottom: 96 },
  letterChip: {
    flexDirection: 'row', alignItems: 'center', gap: GAP, minHeight: 48,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  // naturalLineHeight: the letter being taught (آ and friends carry marks).
  letterChar: { fontSize: 26, lineHeight: naturalLineHeight(26), fontFamily: fonts.bold, color: ramps.write.ink },
  letterName: { fontSize: textSize.small, fontFamily: fonts.regular, color: ui.textMuted },
  canvasColumn: { alignItems: 'center', gap: GAP },
  canvas: {
    backgroundColor: ui.surface, borderRadius: radii.md - 2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  // The faint guide in the room's own colour (was a warm grey that read as
  // a blank box): the write ramp's bright stop, faded. Non-text art only --
  // the letter's name is spoken and shown in the chip above.
  guide: { fontFamily: fonts.bold, color: ramps.write.bright, opacity: 0.35 },
  nav: { flexDirection: 'row', gap: GAP, alignSelf: 'stretch', marginTop: spacing.sm },
  navPrev: { flex: 1 },
  navNext: { flex: 2 },
})
