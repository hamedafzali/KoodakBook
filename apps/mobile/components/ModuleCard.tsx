import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ClaySurface, HostAvatar, lighten } from '@/components/Clay'
import { fonts, radii, spacing, textSize, ui, type Ramp } from '@/lib/theme'

/**
 * A room card on the home grid: soft clay in the room's own ramp, a character
 * host (or an emoji where the room has none -- web's kit.tsx `MODULE` gives
 * only some rooms a host), a title and an optional subtitle. Mobile's answer
 * to web's ModuleCard in apps/web/src/components/child/kit.tsx.
 *
 * History, so the layout isn't "fixed" back:
 *  - 2026-09-22: content was pinned to one side under RTL (alignItems
 *    flex-start on a column doesn't mirror in RN). Fixed.
 *  - 2026-09-24: "empty space on the cards" -- the 151px panel was half void.
 *    Avatar grown 58 -> 78, panel tinted with the ramp's `soft` stop, and
 *    everything centred, which also removes any side to get wrong under RTL.
 *  - 2026-09-25: rebuilt on components/Clay.tsx's ClaySurface (the same shell
 *    + soft face it drew by hand, now shared with the rest of home), with a
 *    real press (the face sinks into its edge) and a screen-reader label.
 *    Layout and sizes are unchanged; the corners follow radii.md (20) instead
 *    of the old hand-typed 24/22.
 *  - 2026-09-25 (1B): the disc is the shared HostAvatar (same 78/66/36
 *    proportions), so every host disc on home is drawn one way. Height is
 *    now a minimum (see `panel`): the content needed ~138pt of a 122pt box.
 *  - 2026-09-28 (visual fidelity, Agent B): the face is a pale pastel of the
 *    room's own bright stop (the reference's tinted tiles, the same family as
 *    Home's learning-path cards but paler, so the grid stays quieter than the
 *    path), and the subtitle is ui.textMuted (measured >= 5.2:1 on every
 *    pastel; colors.muted was only measured on white/soft).
 */
export default function ModuleCard({
  title, sub, ramp, character, emoji, onPress,
}: {
  title: string
  sub?: string
  ramp: Ramp
  character?: string
  emoji?: string
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.root}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}، ${sub}` : title}
    >
      {({ pressed }) => (
        <ClaySurface ramp={ramp} tone="soft" pressed={pressed} radius={radii.md} style={styles.fill} faceStyle={[styles.panel, { backgroundColor: lighten(ramp.bright, 0.82) }]}>
          <HostAvatar ramp={ramp} size={78} character={character} emoji={emoji} />
          <View style={styles.textBlock}>
            {/* No numberOfLines: at 320pt a long subtitle («۱۲ کلمه منتظرند»)
                wraps and the card grows (panel is a minHeight, and both cards
                in a row share the taller height) instead of ending in «…». */}
            <Text style={[styles.title, { color: ramp.ink }]}>{title}</Text>
            {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          </View>
        </ClaySurface>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // 40% + flexGrow, not 48%: two 48% cards plus the grid's 12pt gap overflow
  // any row narrower than 300pt (0.96w + 12 > w), which a 320pt phone's
  // 288pt content width is, so every room wrapped to its own full-width
  // row. 40% can only ever fit two, and flexGrow sizes them exactly as
  // before on wider phones ((w - 12) / 2 either way).
  root: { width: '40%', flexGrow: 1 },
  // minHeight, not height: Vazirmatn's natural line height is 1.562x the
  // font size (hhea 2100/-1100 on 2048 upm), so disc + title + subtitle need
  // ~138pt against the 122pt a fixed 150 leaves inside padding and border.
  // It overflowed at the fixed height, and ClaySurface's face clips, so the
  // card now grows. `fill` lets both cards in a grid row share the taller
  // one's height (the wrapped row stretches its items).
  fill: { flex: 1 },
  panel: { flex: 1, minHeight: 150, padding: spacing.md - 4, justifyContent: 'center', alignItems: 'center', gap: spacing.sm + 2 },
  textBlock: { alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: textSize.body, textAlign: 'center' },
  sub: { fontSize: textSize.caption, fontFamily: fonts.medium, color: ui.textMuted, marginTop: 2, textAlign: 'center' },
})
