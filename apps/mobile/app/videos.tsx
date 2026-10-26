import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { mediaUrl, thumbUrl } from '@/lib/media'
import { Icon } from '@/components/Icon'
import ScreenBackground from '@/components/ScreenBackground'
import BottomNav from '@/components/BottomNav'
import { RoomBand } from '@/components/RoomScene'
import { ClaySurface } from '@/components/Clay'
import { PlayBadge } from '@/components/Illustrations'
import LoadState, { EmptyState } from '@/components/LoadState'
import { MODULE_ROOM_STYLE } from '@/lib/roomStyle'
import { fonts, naturalLineHeight, radii, spacing, textSize, textStart, ui } from '@/lib/theme'
import { goBack } from '@/lib/navigation'

/* «ویدیوها» — short videos for children (word songs, …), grouped into the
 * categories the admin manages (backend routes/videos.ts). Free for every
 * child. Same screen as web's /child/videos: category chips, a grid of
 * covers, and a full-screen player with ‹ › through the chosen category.
 * Playback is expo-video (native player, streams the mp4 over https). */

interface VideoCategory { id: string; slug: string; title_fa: string; emoji: string | null }
interface Video {
  id: string; category_id: string; title_fa: string; description_fa: string | null
  video_url: string; cover_url: string | null; duration_sec: number | null
}

const ROOM = MODULE_ROOM_STYLE.videos
const RAMP = ROOM.ramp
const GAP = spacing.sm + spacing.xs

function duration(sec: number | null): string {
  if (!sec) return ''
  const s = Math.round(sec)
  return `${toPersianDigits(Math.floor(s / 60))}:${toPersianDigits(String(s % 60).padStart(2, '0'))}`
}

export default function Videos() {
  const insets = useSafeAreaInsets()
  const [cats, setCats] = useState<VideoCategory[]>([])
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [cat, setCat] = useState('all')
  const [playing, setPlaying] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<{ categories: VideoCategory[]; videos: Video[] }>('/api/videos').then((r) => {
      if (cancelled) return
      if (!r.data) { setError(r.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); return }
      setError(null); setCats(r.data.categories); setVideos(r.data.videos)
    })
    return () => { cancelled = true }
  }, [attempt])

  // "All" keeps the admin's category order, then each category's own order.
  const shown = useMemo(() => {
    const list = videos ?? []
    if (cat !== 'all') return list.filter((v) => v.category_id === cat)
    const rank = new Map(cats.map((c, i) => [c.id, i]))
    return [...list].sort((a, b) => (rank.get(a.category_id) ?? 99) - (rank.get(b.category_id) ?? 99))
  }, [videos, cats, cat])

  if (error || !videos) {
    return (
      <ScreenBackground variant="warm">
        <LoadState error={error} onRetry={() => { setError(null); setAttempt((a) => a + 1) }} onBack={() => goBack('/home')} />
      </ScreenBackground>
    )
  }

  const tabs = [{ id: 'all', title_fa: 'همه', emoji: ROOM.emoji }, ...cats]

  return (
    <ScreenBackground variant="warm">
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 92 }]}>
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={RAMP}
            emoji={ROOM.emoji}
            size="compact"
            topInset={insets.top}
            title="ویدیوها"
            subtitle={videos.length > 0 ? `${toPersianDigits(videos.length)} ویدیو` : undefined}
          />
        </View>

        {cats.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}
            accessibilityRole="tablist">
            {tabs.map((c) => {
              const on = cat === c.id
              return (
                <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{ selected: on }}
                  accessibilityLabel={c.title_fa} onPress={() => setCat(c.id)}>
                  {({ pressed }) => (
                    <ClaySurface ramp={RAMP} tone={on ? 'bright' : 'soft'} pressed={pressed} radius={radii.pill} faceStyle={styles.chipFace}>
                      <Text style={styles.chipText} maxFontSizeMultiplier={1.3}>
                        {c.emoji ? `${c.emoji} ` : ''}{c.title_fa}
                      </Text>
                    </ClaySurface>
                  )}
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {shown.length === 0 ? (
          <EmptyState title="هنوز ویدیویی نیست" body="به زودی ویدیوهای تازه اضافه می‌شود!" ramp={RAMP} />
        ) : (
          <View style={styles.grid}>
            {shown.map((v, i) => (
              <Pressable key={v.id} style={styles.card} accessibilityRole="button" accessibilityLabel={`پخش ${v.title_fa}`}
                onPress={() => setPlaying(i)}>
                {({ pressed }) => (
                  <ClaySurface ramp={RAMP} tone="soft" pressed={pressed} radius={radii.md} faceStyle={styles.cardFace}>
                    <Cover v={v} />
                    <Text style={styles.cardTitle} numberOfLines={2}>{v.title_fa}</Text>
                  </ClaySurface>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {playing !== null && shown[playing] && (
        <Player list={shown} index={playing} onIndex={setPlaying} onClose={() => setPlaying(null)} />
      )}

      <BottomNav />
    </ScreenBackground>
  )
}

function Cover({ v }: { v: Video }) {
  const uri = thumbUrl(v.cover_url, 200)
  const [failed, setFailed] = useState(false)
  return (
    <View style={styles.cover} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri && !failed
        ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(true)} />
        : <Text style={styles.coverEmoji}>{ROOM.emoji}</Text>}
      <View style={styles.coverPlay}><PlayBadge size={44} color={RAMP.deep} /></View>
      {v.duration_sec ? (
        <View style={styles.duration}><Text style={styles.durationText}>{duration(v.duration_sec)}</Text></View>
      ) : null}
    </View>
  )
}

function Player({ list, index, onIndex, onClose }: {
  list: Video[]; index: number; onIndex: (i: number) => void; onClose: () => void
}) {
  const insets = useSafeAreaInsets()
  const v = list[index]
  const hasPrev = index > 0
  const hasNext = index < list.length - 1
  return (
    <Modal visible animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={onClose}
      statusBarTranslucent>
      <View style={[styles.player, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.playerTop}>
          <Text style={styles.playerTitle} numberOfLines={1}>{v.title_fa}</Text>
          <RoundButton icon="close" label="بستن" onPress={onClose} />
        </View>

        {/* Keyed by id: a fresh native player per video, released on change. */}
        <PlayerBody key={v.id} video={v} hasNext={hasNext} onNext={() => onIndex(index + 1)} />

        <View style={styles.playerNav}>
          <RoundButton icon="back" label="ویدیوی قبلی" disabled={!hasPrev} onPress={() => onIndex(index - 1)} />
          <Text style={styles.counter}>{toPersianDigits(index + 1)} از {toPersianDigits(list.length)}</Text>
          <RoundButton icon="forward" label="ویدیوی بعدی" disabled={!hasNext} onPress={() => onIndex(index + 1)} />
        </View>
      </View>
    </Modal>
  )
}

function PlayerBody({ video, hasNext, onNext }: { video: Video; hasNext: boolean; onNext: () => void }) {
  const [ended, setEnded] = useState(false)
  const player = useVideoPlayer(mediaUrl(video.video_url) ?? '', (p) => { p.play() })
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => setEnded(true))
    return () => sub.remove()
  }, [player])
  const replay = useCallback(() => { setEnded(false); player.replay() }, [player])

  return (
    <View style={styles.videoBox}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls
        fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} />
      {ended && (
        <View style={styles.endOverlay}>
          <PillButton icon="refresh" label="دوباره" onPress={replay} />
          {hasNext && <PillButton icon="forward" label="بعدی" onPress={onNext} trailingIcon />}
        </View>
      )}
    </View>
  )
}

function RoundButton({ icon, label, onPress, disabled }: {
  icon: 'close' | 'back' | 'forward'; label: string; onPress: () => void; disabled?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} hitSlop={8} style={disabled ? styles.disabled : undefined}>
      {({ pressed }) => (
        <ClaySurface ramp={RAMP} pressed={pressed} radius={radii.pill} faceStyle={styles.round}>
          <Icon name={icon} color={RAMP.ink} size={26} strokeWidth={2.6} />
        </ClaySurface>
      )}
    </Pressable>
  )
}

function PillButton({ icon, label, onPress, trailingIcon }: {
  icon: 'refresh' | 'forward'; label: string; onPress: () => void; trailingIcon?: boolean
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <ClaySurface ramp={RAMP} pressed={pressed} radius={radii.lg} faceStyle={styles.pill}>
          {!trailingIcon && <Icon name={icon} color={RAMP.ink} size={22} strokeWidth={2.6} />}
          <Text style={styles.pillText}>{label}</Text>
          {trailingIcon && <Icon name={icon} color={RAMP.ink} size={22} strokeWidth={2.6} />}
        </ClaySurface>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.md, gap: GAP },
  bandWrap: { marginHorizontal: -spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chipFace: { minHeight: 48, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.bold, fontSize: textSize.body, lineHeight: naturalLineHeight(textSize.body), color: RAMP.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { width: '40%', flexGrow: 1, maxWidth: '50%' },
  cardFace: { overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: RAMP.soft, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 40 },
  coverPlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  duration: { position: 'absolute', bottom: spacing.xs, start: spacing.xs, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: radii.xs, paddingHorizontal: 6, paddingVertical: 1 },
  durationText: { color: '#fff', fontFamily: fonts.bold, fontSize: textSize.caption, lineHeight: naturalLineHeight(textSize.caption) },
  cardTitle: {
    fontFamily: fonts.bold, fontSize: textSize.body, lineHeight: naturalLineHeight(textSize.body),
    color: ui.textStrong, textAlign: textStart, paddingHorizontal: spacing.ms, paddingVertical: spacing.sm,
  },
  player: { flex: 1, backgroundColor: '#000', paddingHorizontal: spacing.md, justifyContent: 'center', gap: spacing.md },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  playerTitle: {
    flex: 1, color: '#fff', fontFamily: fonts.display, fontSize: textSize.cardTitle,
    lineHeight: naturalLineHeight(textSize.cardTitle), textAlign: textStart,
  },
  videoBox: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md, overflow: 'hidden', backgroundColor: '#000' },
  endOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  playerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  counter: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: textSize.body, lineHeight: naturalLineHeight(textSize.body) },
  round: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  pill: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pillText: { fontFamily: fonts.bold, fontSize: textSize.body, lineHeight: naturalLineHeight(textSize.body), color: RAMP.ink },
})
