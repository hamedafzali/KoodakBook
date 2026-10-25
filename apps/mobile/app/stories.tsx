import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp } from 'react-native'
import { Image, type ImageStyle } from 'expo-image'
import { Icon, type IconName } from '@/components/Icon'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SceneSlug, Story } from '@koodakbook/shared'
import { SCENE_SLUGS, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import SceneBackdrop from '@/components/SceneBackdrop'
import ScreenBackground from '@/components/ScreenBackground'
import { CharacterArt, ClaySurface, DeepActionCard, HostAvatar, SectionHeading, TextButton } from '@/components/Clay'
import { PlayBadge } from '@/components/Illustrations'
import { clay, colors, fonts, naturalLineHeight, radii, ramps, spacing, textSize, textStart, ui, type Ramp } from '@/lib/theme'
import BottomNav from '@/components/BottomNav'
import { RoomBand } from '@/components/RoomScene'
import { MODULE_ROOM_STYLE } from '@/lib/roomStyle'
import LoadState, { EmptyState } from '@/components/LoadState'
import { goBack } from '@/lib/navigation'

/** Deterministic illustrated cover per story id (web parity for coverless stories). */
function sceneFor(id: string): SceneSlug {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SCENE_SLUGS[h % SCENE_SLUGS.length]
}

// `last_page`: the page the reader last posted (0-based). The progress route
// returns the whole row (select *); older rows may lack it, so it's optional.
type ProgressRow = { story_id: string; completed: boolean; last_page?: number | null }

// «جدید»: a story added in the last two weeks that the child hasn't opened.
// Real data only (the story's own created_at); never shown next to
// «نیمه‌کاره» / «خوندم», which say more.
const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000
function isRecent(createdAt: string | null | undefined): boolean {
  const t = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(t) && Date.now() - t < NEW_FOR_MS && Date.now() >= t
}

// The create entry's own hue: web's AI-story picker is purple, and a
// distinct colour keeps «بساز» from reading as one more story.
const MAGIC: Ramp = ramps.games
// The stories room (ramp + host), one source with Home and the bottom nav.
const ROOM = MODULE_ROOM_STYLE.stories

/** One status pill on a cover, Home's story badge (white face, ramp rim,
 *  micro bold ink) with an optional line icon so it's never colour alone.
 *  `solid` fills it with the ramp's bright stop (ink stays dark: AA). */
function StatusPill({ ramp, label, icon, solid = false }: { ramp: Ramp; label: string; icon?: IconName; solid?: boolean }) {
  return (
    <View style={[styles.pill, { borderColor: solid ? ramp.deep : ramp.bright }, solid && { backgroundColor: ramp.bright }]}>
      {icon ? <Icon name={icon} color={ramp.ink} size={12} strokeWidth={3} /> : null}
      <Text style={[styles.pillText, { color: ramp.ink }]} maxFontSizeMultiplier={1.3}>{label}</Text>
    </View>
  )
}

/**
 * A story's own cover, or `fallback` when it has none OR its image fails to
 * load. Before (2026-09-27) a broken cover URL left an empty pale box; the
 * fallback is never a made-up cover, only the scene library / the host.
 */
function StoryCover({ story, style, fallback }: { story: Story; style: StyleProp<ImageStyle>; fallback: ReactNode }) {
  const uri = mediaUrl(story.cover_url)
  const [failedUri, setFailedUri] = useState<string | null>(null)
  if (!uri || failedUri === uri) return <>{fallback}</>
  return <Image source={{ uri }} style={style} contentFit="cover" onError={() => setFailedUri(uri)} />
}

export default function Stories() {
  const insets = useSafeAreaInsets()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [myStories, setMyStories] = useState<Story[]>([])   // child's own AI stories
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  // Started but not finished: a progress row exists (the reader posts one on
  // every page turn) and it isn't completed. Real data, same source as «خوندم».
  const [inProgress, setInProgress] = useState<Set<string>>(new Set())
  // The story Home would continue: the same rule as Home's lastStory
  // (the last not-completed progress row), so the two screens agree.
  const [lastOpenId, setLastOpenId] = useState<string | null>(null)
  // That story's last page (0-based), when the row carries it.
  const [lastOpenPage, setLastOpenPage] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  // The two secondary requests fail on their own without blocking the list.
  // Silently they looked like real data: no «خوندم» chips (as if nothing had
  // been read) or no «داستان‌های من» (as if the child had made none). Each
  // failure now shows a small note with a retry for just that part.
  const [progFailed, setProgFailed] = useState(false)
  const [mineFailed, setMineFailed] = useState(false)
  const childIdRef = useRef<string | null>(null)
  const partRetrying = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function applyProgress(rows: ProgressRow[]) {
    setCompleted(new Set(rows.filter((s) => s.completed).map((s) => s.story_id)))
    const open = rows.filter((s) => !s.completed)
    setInProgress(new Set(open.map((s) => s.story_id)))
    const last = open.at(-1)
    setLastOpenId(last?.story_id ?? null)
    setLastOpenPage(typeof last?.last_page === 'number' && last.last_page >= 0 ? last.last_page : null)
  }

  /** Refetch only the parts that failed. The flags clear first, so the note
   *  (and its button) goes away at once; the ref stops a second tap in the
   *  same frame from sending the requests twice. */
  async function retryParts() {
    const childId = childIdRef.current
    if (!childId || partRetrying.current) return
    const wantProg = progFailed
    const wantMine = mineFailed
    if (!wantProg && !wantMine) return
    partRetrying.current = true
    setProgFailed(false)
    setMineFailed(false)
    const [p, m] = await Promise.all([
      wantProg ? api.get<{ stories: ProgressRow[] }>(`/api/progress/${childId}`) : Promise.resolve(null),
      wantMine ? api.get<Story[]>(`/api/ai/stories/${childId}`) : Promise.resolve(null),
    ])
    partRetrying.current = false
    if (!mounted.current) return
    if (p) { if (p.data) applyProgress(p.data.stories); else setProgFailed(true) }
    if (m) { if (m.data) setMyStories(m.data); else setMineFailed(true) }
  }

  // Refetch on focus so «خوندم» badges appear right after finishing a story.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        // Blurred/unmounted while reading storage: don't navigate or fetch.
        if (cancelled) return
        if (!childId) { router.replace('/children'); return }
        childIdRef.current = childId
        const [storiesRes, progRes, mineRes] = await Promise.all([
          api.get<Story[]>('/api/stories'),
          api.get<{ stories: ProgressRow[] }>(`/api/progress/${childId}`),
          api.get<Story[]>(`/api/ai/stories/${childId}`),
        ])
        if (cancelled) return
        if (storiesRes.data) setStories(storiesRes.data)
        else setError(storiesRes.error)
        if (progRes.data) { applyProgress(progRes.data.stories); setProgFailed(false) }
        else setProgFailed(true)
        if (mineRes.data) { setMyStories(mineRes.data); setMineFailed(false) }
        else setMineFailed(true)
      }
      load()
      return () => { cancelled = true }
    }, [reloadKey])
  )

  // The in-progress story to offer first, from either list.
  const continueStory = useMemo(
    () => (lastOpenId ? stories?.find((s) => s.id === lastOpenId) ?? myStories.find((s) => s.id === lastOpenId) ?? null : null),
    [lastOpenId, stories, myStories],
  )
  // Continue-card sizing (DeepActionCard's own: 84/52, 64/44 compact below
  // 360pt so the title keeps ~130pt at 320); the create card's go disc too.
  const { width: winW, fontScale } = useWindowDimensions()
  const narrow = winW < 360
  // Large system text: the continue title gets a third line before «…».
  const bigText = fontScale >= 1.3
  const thumbSize = narrow ? 64 : 84
  const goSize = narrow ? 44 : 52

  if (!stories) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
      </ScreenBackground>
    )
  }

  function card(story: Story, isMine: boolean) {
    const done = completed.has(story.id)
    const started = !done && inProgress.has(story.id)
    // At most ONE status on a cover (2026-09-28): done > started > new. Two
    // or three chips crowded a 320pt card and hid the art. «مال من» left the
    // cover: the «داستان‌های من» heading above already says it (the spoken
    // label still does).
    const fresh = !done && !started && isRecent(story.created_at)
    // One spoken name for the whole card: title, then its state as words.
    const label = [`قصه: ${story.title_persian}`, done && 'خوندم', started && 'نیمه‌کاره', fresh && 'جدید', isMine && 'مال من'].filter(Boolean).join('، ')
    const ageText = !isMine && story.age_min != null
      ? `${toPersianDigits(story.age_min)}–${toPersianDigits(story.age_max ?? story.age_min)} سال`
      : null
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        key={story.id}
        style={styles.card}
        onPress={() => router.push(`/story/${story.id}`)}
      >
        {({ pressed }) => (
          // Home's story card (app/home.tsx): soft clay in the stories ramp.
          // fill + flex face: every card in a row ends at the same line even
          // when one title wraps and another doesn't.
          <ClaySurface ramp={ramps.stories} tone="soft" pressed={pressed} radius={radii.md} style={styles.fill} faceStyle={styles.cardFace}>
            {/* The cover keeps one shape (aspect ratio, not a fixed height)
                so every card in the grid reads as the same book. */}
            <View style={styles.coverWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <StoryCover
                story={story}
                style={styles.coverFill}
                fallback={(
                  // No cover yet: a scene from the library with پشمک, the
                  // stories host, standing on its ground line -- never a
                  // made-up cover.
                  <View style={styles.coverFill}>
                    <SceneBackdrop scene={sceneFor(story.id)} style={styles.coverScene} />
                    <View style={styles.coverHost} pointerEvents="none">
                      <CharacterArt character="pashmak" emotion="happy" size={56} />
                    </View>
                  </View>
                )}
              />
              {(done || started || fresh) && (
                // A row, so the pill sits at the reading start (Home's badgeRow).
                <View style={styles.chips} pointerEvents="none">
                  {done ? <StatusPill ramp={ramps.lessons} label="خوندم" icon="check" />
                    : started ? <StatusPill ramp={ramps.stories} label="نیمه‌کاره" />
                    : <StatusPill ramp={ramps.brand} label="جدید" icon="sparkle" solid />}
                </View>
              )}
              {/* The concept's play badge: the card opens a narrated story.
                  At the reading END (`right`, swapped by RN under RTL to the
                  bottom-left), clear of the status pill at the start. The
                  play glyph is not mirrored (a transport symbol). */}
              <View style={styles.playBadge}>
                <PlayBadge size={34} color={ramps.stories.deep} />
              </View>
            </View>
            <View style={styles.cardBody}>
              {/* No line cap: a long title wraps and the card grows (the
                  row's other card stretches to match) instead of «…». */}
              <Text style={styles.storyTitle}>{story.title_persian}</Text>
              {ageText && <Text style={styles.age}>{ageText}</Text>}
            </View>
          </ClaySurface>
        )}
      </Pressable>
    )
  }

  // One deep (primary) card per screen: «ادامه‌ی قصه» when there is a story
  // to continue, otherwise the create card. With a continue card the create
  // card steps down to soft clay, so the two never compete.
  const createTone = continueStory ? 'soft' : 'deep'
  const createInk = continueStory ? MAGIC.ink : ui.onDeep
  const createSubInk = continueStory ? ui.text : ui.onDeepMuted
  // Where the child stopped, from the progress row itself (page index + 1).
  // Page 1 says nothing new, so it isn't shown.
  const continueMeta = lastOpenPage != null && lastOpenPage > 0 ? `رسیدی به صفحه‌ی ${toPersianDigits(lastOpenPage + 1)}` : null
  // Empty only when every list actually loaded: a failed «my stories»
  // request is not "you have no stories".
  const isEmpty = stories.length === 0 && myStories.length === 0 && !mineFailed
  const partNote = [
    mineFailed && 'داستان‌های خودت این بار نیومد.',
    progFailed && 'نتونستیم ببینیم کدوم داستان‌ها رو خوندی.',
  ].filter(Boolean).join(' ')

  return (
    <ScreenBackground variant="warm">
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 92 }]}>
        {/* The tab rooms' shared header (Lessons does the same): the stories
            room's landscape with پشمک on the hills. It scrolls with the list
            and draws under the status bar (topInset). Count is real. */}
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={ROOM.ramp}
            character={ROOM.character}
            size="tall"
            topInset={insets.top}
            title="داستان‌ها"
            subtitle={stories.length > 0 ? `${toPersianDigits(stories.length)} داستان آماده` : undefined}
          />
        </View>
        {continueStory && (
          // The Continue-Learning family (Clay.tsx DeepActionCard): Home's
          // deep indigo card, so «ادامه‌ی قصه» here and «ادامه» on Home read
          // as the same action. The subtitle is the real last page; no bar
          // (the list doesn't know a story's page count).
          <DeepActionCard
            eyebrow="ادامه‌ی قصه"
            title={continueStory.title_persian}
            subtitle={continueMeta ?? undefined}
            compact={narrow}
            titleLines={bigText ? 3 : 2}
            thumbnail={(
              <StoryCover
                story={continueStory}
                style={{ width: thumbSize, height: thumbSize }}
                fallback={<CharacterArt character="pashmak" emotion="encouraging" size={thumbSize - 12} />}
              />
            )}
            onPress={() => router.push(`/story/${continueStory.id}`)}
          />
        )}

        {/* The creation entry. Host disc first = the reading start. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="یک داستان برای من بساز"
          accessibilityHint="داستان مخصوص خودت با موضوع دلخواه"
          onPress={() => router.push('/story/new')}
        >
          {({ pressed }) => (
            <ClaySurface ramp={MAGIC} tone={createTone} pressed={pressed} radius={radii.lg} faceStyle={styles.createFace}>
              {/* پشمک with a sparkle at the disc's shoulder: the "magic" entry. */}
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <HostAvatar ramp={MAGIC} size={56} character="pashmak" emotion="happy" />
                <View style={[styles.sparkleDot, { backgroundColor: MAGIC.bright }]}>
                  <Icon name="sparkle" color={MAGIC.ink} size={14} strokeWidth={2.4} />
                </View>
              </View>
              <View style={styles.createText}>
                <Text style={[styles.createTitle, { color: createInk }]}>یک داستان برای من بساز</Text>
                <Text style={[styles.createSub, { color: createSubInk }]}>داستان مخصوص خودت با موضوع دلخواه</Text>
              </View>
              <View style={[styles.go, { width: goSize, height: goSize, backgroundColor: MAGIC.bright }]}>
                <Icon name="chevron" color={MAGIC.ink} size={24} strokeWidth={3} />
              </View>
            </ClaySurface>
          )}
        </Pressable>

        {partNote ? (
          // Calm, not an alarm: the rest of the screen works. Soft brand clay
          // (Home's goal-card family), ui.text on the pale face.
          <View accessibilityLiveRegion="polite">
            <ClaySurface ramp={ramps.brand} tone="soft" edge={clay.edgeSm} radius={radii.md} faceStyle={styles.noteFace}>
              <Text style={styles.noteText}>{partNote}</Text>
              <TextButton label="دوباره امتحان کن" onPress={retryParts} color={ramps.brand.ink} size="caption" />
            </ClaySurface>
          </View>
        ) : null}

        {myStories.length > 0 && (
          <>
            <View style={styles.sectionHead}><SectionHeading title="داستان‌های من" /></View>
            <View style={styles.grid}>{myStories.map((s) => card(s, true))}</View>
          </>
        )}

        {myStories.length > 0 && stories.length > 0 && (
          <View style={styles.sectionHead}><SectionHeading title="داستان‌های آماده" /></View>
        )}
        {stories.length > 0 && <View style={styles.grid}>{stories.map((s) => card(s, false))}</View>}

        {/* Empty (a successful load with nothing in it) is not an error: the
            host says so and the create card above is the way forward. */}
        {isEmpty && (
          <EmptyState
            title="هنوز داستانی اینجا نیست"
            body="می‌تونی همین حالا یکی برای خودت بسازی!"
            character="pashmak"
            emotion="thinking"
            compact
          />
        )}
      </ScrollView>
      <BottomNav current="stories" />
    </ScreenBackground>
  )
}

// Home's rhythm between sibling items (cards in a row, heading to content).
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.md, gap: GAP },
  // The band is full-bleed (lessons.tsx bandWrap): out past the list inset.
  bandWrap: { marginHorizontal: -spacing.md },
  // The create card's go disc (DeepActionCard's size). Visual only: the
  // whole card is the button.
  go: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  // A small bright disc at the host's top corner. Physical `top/right` only
  // decorates a round disc, so RTL swapping it to the left is harmless.
  sparkleDot: {
    position: 'absolute', top: -4, right: -4, width: 24, height: 24, borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card,
  },
  createFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP, minHeight: 88 },
  createText: { flex: 1, gap: 2 },
  // Colour per tone in render: white on deep (>=7:1), ink on soft.
  createTitle: { fontSize: textSize.body, fontFamily: fonts.display, textAlign: textStart },
  createSub: { fontSize: textSize.caption, fontFamily: fonts.medium, textAlign: textStart },
  sectionHead: { marginTop: spacing.sm },
  noteFace: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, paddingHorizontal: GAP, paddingVertical: spacing.xs },
  noteText: { flexGrow: 1, flexShrink: 1, flexBasis: 160, fontFamily: fonts.medium, fontSize: textSize.caption, color: ui.text, textAlign: textStart, paddingVertical: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  // 40% + flexGrow, not 48%: two 48% cards plus the 12pt gap overflow any row
  // under 300pt (a 320pt phone's list is 288pt), dropping to one per row.
  // Same fix as ModuleCard; widths are unchanged on wider phones.
  // maxWidth 50%: an odd last card used to grow to the full row, a lone
  // wide card with a stretched cover; it now keeps its column width.
  card: { width: '40%', flexGrow: 1, maxWidth: '50%' },
  fill: { flex: 1 },
  cardFace: { flex: 1 },
  // ~1.4:1 picture book shape: ~99pt tall on a 320pt phone, ~124pt at 390.
  coverWrap: { width: '100%', aspectRatio: 1.4, overflow: 'hidden', backgroundColor: ramps.stories.soft },
  coverFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // SceneBackdrop rounds its own corners; flush inside the card face here.
  coverScene: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  coverHost: { position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' },
  chips: { position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm, flexDirection: 'row' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 2,
  },
  pillText: { fontFamily: fonts.bold, fontSize: textSize.micro },
  playBadge: { position: 'absolute', bottom: spacing.sm, right: spacing.sm },
  cardBody: { padding: GAP, paddingTop: spacing.sm, gap: 2 },
  storyTitle: {
    fontSize: textSize.small, fontFamily: fonts.bold, color: ui.textStrong,
    lineHeight: naturalLineHeight(textSize.small), textAlign: textStart,
  },
  age: { fontSize: textSize.caption, fontFamily: fonts.medium, color: ui.textMuted, textAlign: textStart },
})
