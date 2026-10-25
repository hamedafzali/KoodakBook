import { useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { goBack } from '@/lib/navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Lesson, StrandLevels } from '@koodakbook/shared'
import { ALL_UNLOCKED, LESSON_TYPE_LABEL, isLessonUnlocked, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { fonts, iconSize, radii, ramps, shape, spacing, textSize, textStart, textStyles, ui, type Ramp } from '@/lib/theme'
import { LESSON_SECTION_ORDER } from '@/lib/lessonOrder'
import { lessonRoomStyle } from '@/lib/roomStyle'
import BottomNav from '@/components/BottomNav'
import ScreenBackground from '@/components/ScreenBackground'
import { ClayChip, ClaySurface, HostAvatar, ProgressTrack } from '@/components/Clay'
import { Icon } from '@/components/Icon'
import { RoomBand, RoomProgress } from '@/components/RoomScene'
import LoadState, { EmptyState } from '@/components/LoadState'

// Section order: the one shared, provisional constant (lib/lessonOrder.ts).

// Each section wears its type's room (lib/roomStyle.ts, the same source as
// Home's learning-path cards): vocabulary is the lessons room (روزی), the
// alphabet the letters room (بومی), phonics its own room with no host. Home's
// path cards open this screen, so a section looks like the card the child
// tapped. An unknown type gets the lessons ramp and its own emoji.

type LessonSection = { type: string; title: string; emoji: string; ramp: Ramp; character?: string; data: Lesson[] }

/**
 * Buckets lessons by `type` (web's lesson list groups the same way). It is a
 * stable partition, not a sort: inside a section, lessons keep the API's
 * order, and the lesson objects pass through untouched -- the row renderer
 * below gets the same references it always did. A type with no lessons gets
 * no section. A type outside LESSON_SECTION_ORDER (the DB's CHECK constraint
 * rules this out today; nothing on the client does) still gets its own
 * section after the known ones, labelled with its raw type, so grouping can
 * never make a lesson disappear (approved fallback).
 */
function groupLessons(lessons: Lesson[]): LessonSection[] {
  const buckets = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const bucket = buckets.get(lesson.type)
    if (bucket) bucket.push(lesson)
    else buckets.set(lesson.type, [lesson])
  }
  const ordered: readonly string[] = LESSON_SECTION_ORDER
  const known = ordered.filter((t) => buckets.has(t))
  const unknown = Array.from(buckets.keys()).filter((t) => !ordered.includes(t))
  return [...known, ...unknown].map((type) => {
    const room = lessonRoomStyle(type)
    return {
      type,
      title: LESSON_TYPE_LABEL[type] ?? type,
      emoji: room.emoji,
      ramp: room.ramp,
      character: room.character,
      data: buckets.get(type) ?? [],
    }
  })
}

export default function Lessons() {
  const insets = useSafeAreaInsets()
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  // Which lessons are actually reachable yet, from the child's placement --
  // web's /child/lesson gates on this (isLessonUnlocked); mobile never did,
  // so a locked lesson was fully tappable (2026-09-20 audit, Critical #1).
  const [strandLevels, setStrandLevels] = useState<StrandLevels>(ALL_UNLOCKED)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }
  // A double tap on a row pushed the same lesson twice (two players stacked,
  // so «بستن» landed on the first one). Set on the first tap, cleared when
  // this screen is focused again.
  const openingRef = useRef(false)
  const openLesson = (id: string) => {
    if (openingRef.current) return
    openingRef.current = true
    router.push(`/lesson/${id}`)
  }

  useFocusEffect(
    useCallback(() => {
      // Back on this screen: rows can open a lesson again.
      openingRef.current = false
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        // Blurred while the id was being read: don't redirect from a screen
        // the child already left.
        if (cancelled) return
        if (!childId) { router.replace('/children'); return }
        const [lessonsRes, progRes, placeRes] = await Promise.all([
          api.get<Lesson[]>('/api/lessons'),
          api.get<{ lessons: { lesson_id: string; completed: boolean }[] }>(`/api/progress/${childId}`),
          api.get<{ strand_levels: StrandLevels }>(`/api/placement/${childId}`),
        ])
        if (cancelled) return
        if (lessonsRes.data) setLessons(lessonsRes.data)
        else setError(lessonsRes.error)
        if (progRes.data) {
          setCompleted(new Set(progRes.data.lessons.filter((l) => l.completed).map((l) => l.lesson_id)))
        }
        if (placeRes.data?.strand_levels) setStrandLevels(placeRes.data.strand_levels)
      }
      load()
      return () => { cancelled = true }
    }, [reloadKey])
  )

  // Grouped once per lessons fetch, not on every render (a completed-set or
  // strand update re-renders the list but doesn't change the sections).
  const sections = useMemo(() => (lessons ? groupLessons(lessons) : []), [lessons])

  if (!lessons) {
    return (
      <ScreenBackground variant="warm">
        <View style={styles.center}>
          <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
        </View>
      </ScreenBackground>
    )
  }

  // The overall count for the band, and the path's next step: the first
  // lesson, in the list's own order, that is open and not done yet. Visual
  // only -- the order and the locks are exactly as before.
  const doneTotal = lessons.filter((l) => completed.has(l.id)).length
  const nextUpId = (() => {
    for (const s of sections) {
      for (const l of s.data) {
        if (!completed.has(l.id) && isLessonUnlocked(l, strandLevels)) return l.id
      }
    }
    return null
  })()

  return (
    <ScreenBackground variant="warm">
      <SectionList
        sections={sections}
        keyExtractor={(l) => l.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        // The lessons room's illustrated band (components/RoomScene.tsx):
        // Home's world tinted green, روزی (the room's host, Home's path card)
        // on the hills, and the child's real overall progress. It scrolls
        // with the list; full-bleed past the list's side padding.
        ListHeaderComponent={
          <View style={styles.bandWrap}>
            <RoomBand
              ramp={ramps.lessons}
              size="tall"
              topInset={insets.top}
              character="roozi"
              title="درس‌ها"
              subtitle="امروز کدام درس را بخوانیم؟"
            >
              <RoomProgress
                ramp={ramps.lessons}
                done={doneTotal}
                total={lessons.length}
                meta={`${toPersianDigits(doneTotal)} از ${toPersianDigits(lessons.length)}`}
                label={`${toPersianDigits(doneTotal)} از ${toPersianDigits(lessons.length)} درس تمام شده`}
              />
            </RoomBand>
          </View>
        }
        // A successful, empty list: a friendly note, not an error (the
        // error path is LoadState above, with its retry).
        ListEmptyComponent={
          <EmptyState
            character="roozi"
            emotion="thinking"
            title="هنوز درسی اینجا نیست"
            body="به‌زودی درس‌های تازه می‌رسه."
          />
        }
        // Headers scroll with their rows, like the flat list did. (iOS makes
        // SectionList headers sticky by default; Android doesn't.)
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => {
          // Each section opens with its room's banner -- bright clay in the
          // room's ramp, like Home's learning-path tile it was opened from:
          // the host in its white disc, the room's name and its done/total
          // track. Ink on bright is AA on every ramp (Clay.tsx).
          const doneCount = section.data.filter((l) => completed.has(l.id)).length
          const total = section.data.length
          const ramp = section.ramp
          return (
            <ClaySurface ramp={ramp} tone="bright" radius={shape.hero} style={styles.sectionCard} faceStyle={styles.sectionFace}>
              <HostAvatar ramp={ramp} size={60} character={section.character} emoji={section.emoji} emotion="happy" />
              <View style={styles.sectionText}>
                <Text style={[styles.sectionTitle, { color: ramp.ink }]} accessibilityRole="header">{section.title}</Text>
                <View
                  style={styles.sectionProgress}
                  accessible
                  accessibilityLabel={`${toPersianDigits(doneCount)} از ${toPersianDigits(total)} تمام شده`}
                >
                  {/* The shared bar, on the room's soft stop (the neutral warm
                      track would muddy the bright face). */}
                  <ProgressTrack value={doneCount} total={total} ramp={ramp} trackColor={ramp.soft} decorative style={styles.track} />
                  <Text style={[styles.sectionMeta, { color: ramp.ink }]}>{toPersianDigits(doneCount)} از {toPersianDigits(total)}</Text>
                </View>
              </View>
            </ClaySurface>
          )
        }}
        renderItem={({ item, section, index }) => {
          const ramp = section.ramp
          const done = completed.has(item.id)
          const locked = !isLessonUnlocked(item, strandLevels)
          const step = toPersianDigits(index + 1)
          if (locked) {
            // The locked convention (theme.ts `ui`, Home's path card): the
            // row keeps its room's clay -- no fading, which read as broken
            // and dropped the text's contrast -- but isn't a Pressable (it
            // never sinks), a lock takes the step disc, and the reason is in
            // words. The label says «هنوز قفل است» like Home's.
            return (
              <View
                accessible
                accessibilityLabel={`${item.title}، هنوز قفل است. مرحله ${toPersianDigits(item.stage)} لازم است`}
              >
                <ClaySurface ramp={ramp} tone="soft" radius={radii.md} faceStyle={styles.rowFace}>
                  <View style={[styles.stepDisc, styles.stepLocked]}>
                    <Icon name="lock" color={ui.lockedText} size={iconSize.control} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.lessonTitle, { color: ramp.ink }]}>{item.title}</Text>
                    <Text style={styles.lockedReason}>هنوز قفل · مرحله {toPersianDigits(item.stage)} لازم است</Text>
                  </View>
                </ClaySurface>
              </View>
            )
          }
          const isNext = item.id === nextUpId
          return (
            <Pressable
              onPress={() => openLesson(item.id)}
              accessibilityRole="button"
              accessibilityLabel={done ? `${item.title}، تمام شده` : isNext ? `${item.title}، درس بعدی` : item.title}
            >
              {({ pressed }) => (
                <ClaySurface
                  ramp={ramp}
                  tone="soft"
                  pressed={pressed}
                  selected={isNext}
                  radius={radii.md}
                  faceStyle={styles.rowFace}
                >
                  {/* The path's step: its number in the room's bright disc,
                      a white check on the deep stop once done. */}
                  <View
                    style={[
                      styles.stepDisc,
                      done ? { backgroundColor: ramp.deep, borderColor: ramp.deep } : { backgroundColor: ramp.bright, borderColor: ramp.deep },
                    ]}
                  >
                    {done
                      ? <Icon name="check" color={ui.onDeep} size={24} strokeWidth={3} />
                      : <Text style={[styles.stepNum, { color: ramp.ink }]} maxFontSizeMultiplier={1.2}>{step}</Text>}
                  </View>
                  <View style={styles.rowText}>
                    {isNext ? <Text style={[styles.nextEyebrow, { color: ramp.deep }]}>درس بعدی</Text> : null}
                    <Text style={[styles.lessonTitle, { color: ramp.ink }]}>{item.title}</Text>
                    {/* Ternary, not &&: an empty-string description would
                        otherwise render a bare string outside <Text>. */}
                    {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                  </View>
                  {/* Completed says so in words, not only with the check. */}
                  {done ? (
                    <ClayChip ramp={ramp} label="تمام شده" decorative />
                  ) : (
                    // Home's go disc: the next step's is filled deep, the
                    // rest a quiet chevron. Visual only (the row is the button).
                    <View style={[styles.go, isNext && { backgroundColor: ramp.deep }]}>
                      <Icon name="chevron" color={isNext ? ui.onDeep : ramp.ink} size={iconSize.control} strokeWidth={2.6} />
                    </View>
                  )}
                </ClaySurface>
              )}
            </Pressable>
          )
        }}
      />
      <BottomNav current="lessons" />
    </ScreenBackground>
  )
}

// Home's rhythm between sibling items: 12, between the scale's 8 and 16.
const GAP = spacing.sm + spacing.xs
const STEP = 44

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // textStart (theme.ts): these sit in full-width rows/columns, where iOS's
  // default alignment put Persian at the physical left under RTL.
  list: { paddingHorizontal: spacing.md, gap: GAP },
  // Full-bleed: undo the list's side padding for the band.
  bandWrap: { marginHorizontal: -spacing.md },
  sectionCard: { marginTop: spacing.md },
  sectionFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP, minHeight: 84 },
  sectionText: { flex: 1, gap: spacing.xs },
  sectionTitle: { fontFamily: fonts.display, fontSize: textSize.cardTitle, textAlign: textStart },
  sectionProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1 },
  sectionMeta: { ...textStyles.label },
  rowFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP, minHeight: 72 },
  stepDisc: {
    width: STEP, height: STEP, borderRadius: shape.disc, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepLocked: { backgroundColor: ui.surface, borderColor: ui.divider },
  stepNum: { fontFamily: fonts.display, fontSize: textSize.body },
  rowText: { flex: 1, gap: 2 },
  nextEyebrow: { ...textStyles.label, textAlign: textStart },
  lessonTitle: { ...textStyles.cardTitle, textAlign: textStart },
  // textMuted, not colors.muted: >=5.4:1 on every ramp's soft face.
  description: { ...textStyles.meta, textAlign: textStart },
  lockedReason: { ...textStyles.meta, color: ui.lockedText, textAlign: textStart },
  go: {
    width: 36, height: 36, borderRadius: shape.disc, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
})
