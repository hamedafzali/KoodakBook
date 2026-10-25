import { useCallback, useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BadgeKey, ChildBadge, DashboardSummary } from '@koodakbook/shared'
import { BADGE_DEFINITIONS, BADGE_EMOJI, XP_LEVELS, resolveLevel, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { getActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { clay, colors, fonts, radii, ramps, scenery, shadows, spacing, textSize, textStart, ui } from '@/lib/theme'
import { Icon } from '@/components/Icon'
import ScreenBackground from '@/components/ScreenBackground'
import { ClaySurface, ProgressTrack, SectionHeading } from '@/components/Clay'
import { GiftBox, RewardStar } from '@/components/Illustrations'
import BottomNav from '@/components/BottomNav'
import { RoomBand } from '@/components/RoomScene'
import { MODULE_ROOM_STYLE } from '@/lib/roomStyle'
import LoadState from '@/components/LoadState'
import { goBack } from '@/lib/navigation'

/**
 * جایزه‌ها: the full badge catalogue, earned AND locked (web: /child/rewards),
 * grouped into outcome («دستاوردها») and effort («تلاش و پشتکار») the way
 * web's rewards page groups them.
 *
 * 2026-09-24 (Phase 3): this screen used to list only badges already earned,
 * so a child never saw what was left to earn. The catalogue is not fetched --
 * it is `BADGE_DEFINITIONS`, the shared constant web already renders from --
 * so the only request is still the earned-badges one, unchanged. Product
 * decisions for this pass: the header count is every earned record the API
 * returns (`badges.length`, same as web, even if a record's key were missing
 * from BADGE_DEFINITIONS); a child with nothing earned sees the whole
 * catalogue locked instead of an empty message; web's progress-dot row is
 * deferred.
 */
type BadgeDef = { title: string; description: string; hint: string; effort: boolean }

// The rewards room (ramp + host), one source with Home and the bottom nav.
const ROOM = MODULE_ROOM_STYLE.rewards

type CatalogueEntry = { key: BadgeKey; def: BadgeDef; earned: ChildBadge | undefined }

/** Rows for the ONE scrollable list on this screen. The grid is two columns,
 *  but FlatList's `numColumns` can't give a section header the full row
 *  width, so tiles are pre-paired into rows and each header is a row of its
 *  own. (A FlatList per section would nest virtualized lists instead.) */
type CatalogueRow =
  | { kind: 'header'; id: string; title: string; emoji?: string }
  | { kind: 'pair'; id: string; entries: CatalogueEntry[] }

// Object.entries widens the key to string; the keys ARE BadgeKey (the same 11
// names in shared types.ts and constants.ts). Declaration order is kept, so
// tiles appear in the same order as on web.
const CATALOGUE = Object.entries(BADGE_DEFINITIONS) as [BadgeKey, BadgeDef][]

// Outcome first, then effort -- web's section order.
const SECTIONS: { id: string; title: string; emoji?: string; effort: boolean }[] = [
  { id: 'outcome', title: 'دستاوردها', effort: false },
  { id: 'effort', title: 'تلاش و پشتکار', emoji: '💪', effort: true },
]

function buildRows(badges: ChildBadge[]): CatalogueRow[] {
  // `badge` is optional on ChildBadge. A record without it, or with a key
  // BADGE_DEFINITIONS doesn't know, simply lights up no tile -- it still
  // counts in the header (approved: match web).
  const earnedByKey = new Map<string, ChildBadge>()
  for (const b of badges) {
    const key = b.badge?.key
    if (key) earnedByKey.set(key, b)
  }
  const rows: CatalogueRow[] = []
  for (const section of SECTIONS) {
    const entries: CatalogueEntry[] = CATALOGUE
      .filter(([, def]) => def.effort === section.effort)
      .map(([key, def]) => ({ key, def, earned: earnedByKey.get(key) }))
    if (entries.length === 0) continue
    rows.push({ kind: 'header', id: `header-${section.id}`, title: section.title, emoji: section.emoji })
    for (let i = 0; i < entries.length; i += 2) {
      rows.push({ kind: 'pair', id: `pair-${entries[i].key}`, entries: entries.slice(i, i + 2) })
    }
  }
  return rows
}

/** One catalogue tile. Deliberately not pressable -- a badge is something to
 *  look at, not a control (web's BadgeCard has no onClick either). Earned: its
 *  artwork if it has any, else its emoji, and what it was for. Locked: a
 *  padlock and how to earn it -- web's exact earned/locked split. */
/*  Earned vs locked is never colour alone: an earned badge is raised bright
 *  clay (rewards ramp) with its art in a solid-rimmed white medal; a locked
 *  one is flat pale clay (thin edge) with a padlock in a dashed empty medal,
 *  and each tile's spoken label says «گرفته شده» / «قفل». */
function BadgeTile({ entry }: { entry: CatalogueEntry }) {
  const { key, def, earned } = entry
  if (!earned) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={`${def.title}: قفل — ${def.hint}`}>
        <ClaySurface ramp={ramps.rewards} tone="soft" edge={clay.edgeSm} radius={radii.md} style={styles.fill} faceStyle={styles.tileFace}>
          <View style={[styles.medal, styles.medalLocked]}>
            <Icon name="lock" color={ui.lockedText} size={30} />
          </View>
          <Text style={[styles.badgeTitle, styles.lockedTitle]}>{def.title}</Text>
          {/* Uncapped: the hint is how to earn it, so none of it may be cut. */}
          <Text style={[styles.description, styles.lockedText]}>{def.hint}</Text>
        </ClaySurface>
      </View>
    )
  }
  const image = mediaUrl(earned.badge?.image_url)
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${def.title}: گرفته شده — ${def.description}`}>
      <ClaySurface ramp={ramps.rewards} tone="bright" radius={radii.md} style={styles.fill} faceStyle={styles.tileFace}>
        <View>
          <View style={styles.medal}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} contentFit="contain" />
            ) : (
              // Same fallback as web: BADGE_EMOJI is a plain Record<string, string>,
              // so a key without an entry is possible at the type level.
              <Text style={styles.tileEmoji} maxFontSizeMultiplier={1}>{BADGE_EMOJI[key] ?? '🏆'}</Text>
            )}
          </View>
          {/* Earned seal at the medal's shoulder: a filled star, so earned
              vs locked is a shape (star / padlock) as well as a colour. */}
          <View style={styles.seal}>
            <Icon name="star" color={colors.card} size={14} filled />
          </View>
        </View>
        <Text style={styles.badgeTitle}>{def.title}</Text>
        <Text style={styles.description}>{def.description}</Text>
      </ClaySurface>
    </View>
  )
}

export default function Rewards() {
  const insets = useSafeAreaInsets()
  const [badges, setBadges] = useState<ChildBadge[] | null>(null)
  // Total xp from the dashboard summary Home already reads, for the level
  // card. null = not known (request failed): the card is left out rather
  // than showing a made-up level; the badges still load on their own.
  const [xp, setXp] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by LoadState's retry to re-run the load below.
  const [reloadKey, setReloadKey] = useState(0)
  const retry = () => { setError(null); setReloadKey((k) => k + 1) }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      async function load() {
        const childId = await getActiveChildId()
        // Blurred/unmounted while reading storage: don't navigate or fetch.
        if (cancelled) return
        if (!childId) { router.replace('/children'); return }
        const [res, dashRes] = await Promise.all([
          api.get<ChildBadge[]>(`/api/badges/${childId}`),
          api.get<DashboardSummary>(`/api/dashboard/${childId}`),
        ])
        if (cancelled) return
        if (dashRes.data) setXp(dashRes.data.xp ?? 0)
        if (res.data) setBadges(res.data)
        else setError(res.error)
      }
      load()
      return () => { cancelled = true }
    }, [reloadKey])
  )

  // Rebuilt only when the earned list changes, not on every render.
  const rows = useMemo(() => (badges ? buildRows(badges) : []), [badges])
  // Real level from real xp -- the same helper and wording as Home's card.
  const level = xp === null ? null : resolveLevel(xp)
  // The next level's real name (XP_LEVELS is what resolveLevel walks).
  const nextLabel = level && !level.isMax ? XP_LEVELS[level.level]?.label ?? null : null
  // The "next reward" disc at the card's end needs ~56pt; below 360pt the
  // words keep that room instead.
  const { width: winW } = useWindowDimensions()
  const showNext = winW >= 360

  if (!badges) {
    return (
      <ScreenBackground variant="warm" style={styles.center}>
        <LoadState error={error} onRetry={retry} onBack={() => goBack('/home')} />
      </ScreenBackground>
    )
  }

  return (
    <ScreenBackground variant="warm">
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        // + insets.bottom: BottomNav is absolute and grows by the home
        // indicator, so a flat 92 left the last row partly under it.
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 92 }]}
        ListHeaderComponent={
          <View style={styles.headerCol}>
            {/* The tab rooms' shared header (Lessons, Stories): the rewards
                room's landscape with سیمرغ proud on the hills. Scrolls with the
                list, draws under the status bar. No progress pill: the level
                card right below already carries a bar. */}
            <View style={styles.bandWrap}>
              <RoomBand
                ramp={ROOM.ramp}
                character={ROOM.character}
                emotion="proud"
                size="tall"
                topInset={insets.top}
                title="جایزه‌ها"
                subtitle={`${toPersianDigits(badges.length)} از ${toPersianDigits(CATALOGUE.length)} نشان گرفتی`}
              />
            </View>
            {level ? (
            // Home's level card (app/home.tsx «پیشرفت من»), as the
            // reference's reward card. One progressbar to assistive tech.
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={level.isMax
                ? `سطح ${level.label}، بالاترین سطح، ${toPersianDigits(level.xp)} امتیاز`
                : `سطح ${level.label}، ${toPersianDigits(level.toNext)} امتیاز تا سطح ${nextLabel ?? 'بعد'}`}
              accessibilityValue={{ min: 0, max: 100, now: level.pct }}
            >
              {/* The reference's reward card: the smiling reward star in a warm
                  disc at the reading start, an encouraging line, the level, the
                  real track to the next level (Home's level-card colours), and
                  the next reward (gift) at the end. Ink on the pale face (AA). */}
              <ClaySurface ramp={ramps.rewards} tone="soft" radius={radii.lg} faceStyle={styles.levelFace}>
                <View style={styles.starDisc}>
                  <RewardStar size={64} />
                </View>
                <View style={styles.levelText}>
                  <Text style={styles.levelEyebrow}>
                    {level.xp > 0 ? 'آفرین! داری عالی پیش می‌ری' : 'اولین امتیازت در راهه!'}
                  </Text>
                  <Text style={styles.levelTitle}>سطح: {level.label}</Text>
                  {/* Decorative: the card's own progressbar label says it. */}
                  <ProgressTrack
                    value={level.pct / 100}
                    ramp={ramps.rewards}
                    trackColor={ramps.rewards.bright}
                    height={12}
                    decorative
                  />
                  <Text style={styles.levelMeta}>
                    {level.isMax
                      ? `بالاترین سطح! ${toPersianDigits(level.xp)} امتیاز`
                      : `${toPersianDigits(level.toNext)} امتیاز تا سطح «${nextLabel ?? 'بعد'}»`}
                  </Text>
                </View>
                {showNext && (level.isMax ? (
                  <View style={styles.nextDisc}>
                    <Icon name="trophy" color={ramps.rewards.ink} size={28} />
                  </View>
                ) : (
                  <GiftBox size={56} />
                ))}
              </ClaySurface>
            </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            // The wrapper speaks the title without its emoji, as before.
            <View style={styles.sectionHead} accessible accessibilityRole="header" accessibilityLabel={item.title}>
              <SectionHeading title={item.emoji ? `${item.title} ${item.emoji}` : item.title} />
            </View>
          ) : (
            <View style={styles.row}>
              {item.entries.map((entry) => <BadgeTile key={entry.key} entry={entry} />)}
              {/* An odd last tile keeps half width, like web's grid-cols-2. */}
              {item.entries.length === 1 && <View style={styles.spacer} />}
            </View>
          )
        }
      />
      <BottomNav current="rewards" />
    </ScreenBackground>
  )
}

// Home's rhythm between sibling items (cards in a row, heading to content).
const GAP = spacing.sm + spacing.xs

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: spacing.md, gap: GAP },
  headerCol: { gap: GAP },
  // The band is full-bleed (lessons.tsx bandWrap): out past the list inset.
  bandWrap: { marginHorizontal: -spacing.md },
  row: { flexDirection: 'row', gap: GAP },
  spacer: { flex: 1 },
  sectionHead: { marginTop: spacing.sm },
  // The tile owns the width share and the spoken label; the clay fills it,
  // so both tiles in a row end on the same line whatever their text length.
  tile: { flex: 1 },
  fill: { flex: 1 },
  tileFace: { flex: 1, padding: GAP, alignItems: 'center', gap: spacing.xs + 2 },
  medal: {
    width: 76, height: 76, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 3, borderColor: ramps.rewards.deep, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  medalLocked: { borderStyle: 'dashed', borderColor: scenery.faint },
  // Bottom-end of the medal (physical `right`, swapped under RTL; round on
  // round, so either shoulder reads the same).
  seal: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: radii.pill,
    backgroundColor: ramps.rewards.deep, borderWidth: 2, borderColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  tileEmoji: { fontSize: 40 },
  image: { width: 60, height: 60 },
  // Ink on the bright face (earned); colors.text on the pale face (locked):
  // both clear AA, the locked tile reads quieter by weight, not by a paler grey.
  badgeTitle: { fontSize: textSize.small, fontFamily: fonts.display, color: ramps.rewards.ink, textAlign: 'center' },
  lockedTitle: { fontFamily: fonts.bold, color: colors.text },
  description: { fontSize: textSize.caption, fontFamily: fonts.medium, color: ramps.rewards.ink, textAlign: 'center' },
  lockedText: { fontFamily: fonts.regular, color: colors.text },

  // Level card: Home's levelFace/levelTitle/pathTrack, one step larger.
  // Every text is rewards.ink on the pale rewards face.
  levelFace: { flexDirection: 'row', alignItems: 'center', gap: GAP, padding: GAP + spacing.xs, minHeight: 120 },
  starDisc: {
    width: 84, height: 84, borderRadius: radii.pill, backgroundColor: ramps.brand.soft,
    borderWidth: 3, borderColor: ramps.rewards.bright, alignItems: 'center', justifyContent: 'center',
  },
  levelText: { flex: 1, gap: spacing.xs + 2 },
  levelEyebrow: { fontFamily: fonts.bold, fontSize: textSize.caption, color: ramps.rewards.ink, textAlign: textStart },
  levelTitle: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: ramps.rewards.ink, textAlign: textStart },
  levelMeta: { fontFamily: fonts.medium, fontSize: textSize.caption, color: ramps.rewards.ink, textAlign: textStart },
  nextDisc: {
    width: 56, height: 56, borderRadius: radii.pill, backgroundColor: colors.card,
    borderWidth: 3, borderColor: ramps.rewards.deep, alignItems: 'center', justifyContent: 'center', ...shadows[1],
  },
})
