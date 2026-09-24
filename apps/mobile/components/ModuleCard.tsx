import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { characterSvg } from '@/lib/characterSvg'
import { colors, fonts, scenery, type Ramp } from '@/lib/theme'

/**
 * Chunky "room" card -- the redesign's visual language for a module entry
 * point (MobileHome.dc.html): a colour-block outer shell with a 6px bottom
 * reveal (the same 3D-edge trick `shadows`/web's ClayTile use elsewhere),
 * wrapping a tinted inner panel that holds a character avatar (or an emoji
 * when the module has no cast host -- see kit.tsx's `MODULE` on web, which
 * this mirrors: not every room gets one), a title and an optional subtitle.
 *
 * Mobile's answer to web's `ModuleCard` (apps/web/src/components/child/
 * kit.tsx) -- same one-hue-per-module language, same "only some rooms get a
 * host" rule, ported rather than reinvented so a room's card means the same
 * thing on both platforms.
 *
 * REDESIGNED 2026-09-24 (user report: "empty space on menu's cards", after
 * the 2026-09-22 RTL alignItems fix corrected WHICH side content sat on but
 * not the underlying problem). The panel is 151px wide (2-col grid on a
 * 390px phone, minus outer padding/gap); the old layout pinned a 58px
 * avatar + text column to one edge (`alignItems: flex-start`/`flex-end`),
 * so roughly HALF the panel -- everything past the avatar's own 58px column
 * -- was flat white void with nothing in it. Centering alone doesn't fix
 * that, it just splits the same void evenly either side, so this redesign
 * also: (1) grows the avatar 58->78px, the single biggest lever on how much
 * of the panel actually has something in it; (2) tints the panel with the
 * module's own `soft` ramp stop instead of flat white, so whatever space is
 * still "empty" reads as a deliberate colour choice, not a blank hole
 * (contrast-checked: colors.muted on every one of the 11 ramps' `soft`
 * clears >=4.6:1, `ink` clears >=8:1, both already AA); (3) centers
 * everything, which -- as a side effect -- makes the RTL-conditional
 * `alignItems` from the 2026-09-22 fix unnecessary: centered content has no
 * "side" to get wrong under RTL, so `I18nManager` isn't needed here at all
 * any more.
 */
export default function ModuleCard({
  title, sub, ramp, character, emoji, onPress,
}: {
  title: string
  sub?: string
  ramp: Ramp
  /** pixel-wizards-charachters slug — rendered via the library's own
   *  renderActorSVG (characterSvg helper), not app-local art. */
  character?: string
  /** shown instead of a character avatar when the module has none. */
  emoji?: string
  onPress?: () => void
}) {
  return (
    <Pressable onPress={onPress} style={styles.root}>
      <View style={[styles.shell, { backgroundColor: ramp.bright }]}>
        <View style={[styles.panel, { backgroundColor: ramp.soft }]}>
          <View style={[styles.avatar, { backgroundColor: '#FFFFFF', borderColor: ramp.bright }]}>
            {character ? (
              <SvgXml xml={characterSvg(character, { emotion: 'encouraging', size: 66 })} width={66} height={66} />
            ) : (
              <Text style={styles.emoji}>{emoji}</Text>
            )}
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: ramp.ink }]} numberOfLines={1}>{title}</Text>
            {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { width: '48%', flexGrow: 1 },
  shell: { borderRadius: 24, paddingBottom: 6 },
  panel: {
    // Tinted with the module's own `soft` ramp stop (set inline per-card,
    // see the render above) instead of flat white -- see the file doc
    // comment for why. Centered on both axes: a bigger avatar plus centering
    // is what actually closes the "half the card is empty" gap the previous
    // edge-pinned layout had, not just moving which edge it's pinned to.
    borderWidth: 2, borderColor: scenery.line, borderRadius: 22,
    height: 150, padding: 12, justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  avatar: {
    width: 78, height: 78, borderRadius: 999, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 36 },
  textBlock: { alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 18, textAlign: 'center' },
  sub: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, marginTop: 2, textAlign: 'center' },
})
