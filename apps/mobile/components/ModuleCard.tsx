import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { characterSvg } from '@/lib/characterSvg'
import { colors, fonts, scenery, type Ramp } from '@/lib/theme'

/**
 * Chunky "room" card — the redesign's visual language for a module entry
 * point (MobileHome.dc.html): a colour-block outer shell with a 6px bottom
 * reveal (the same 3D-edge trick `shadows`/web's ClayTile use elsewhere),
 * wrapping a white inner panel that holds a character avatar (or an emoji
 * when the module has no cast host — see kit.tsx's `MODULE` on web, which
 * this mirrors: not every room gets one), a title and an optional subtitle.
 *
 * Mobile's answer to web's `ModuleCard` (apps/web/src/components/child/
 * kit.tsx) — same one-hue-per-module language, same "only some rooms get a
 * host" rule, ported rather than reinvented so a room's card means the same
 * thing on both platforms.
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
        <View style={styles.panel}>
          <View style={[styles.avatar, { backgroundColor: ramp.soft, borderColor: ramp.bright }]}>
            {character ? (
              <SvgXml xml={characterSvg(character, { emotion: 'encouraging', size: 50 })} width={50} height={50} />
            ) : (
              <Text style={styles.emoji}>{emoji}</Text>
            )}
          </View>
          <View>
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
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: scenery.line, borderRadius: 22,
    height: 136, padding: 11, justifyContent: 'space-between',
    // RTL: this is a column container (main axis is vertical, unaffected by
    // direction), so its cross axis -- the horizontal one -- is exactly the
    // axis I18nManager's forceRTL(true) (app/_layout.tsx) does NOT auto-flip.
    // RN only mirrors `flexDirection: 'row'`; `alignItems: 'flex-start'`
    // stays pinned to the physical left regardless of RTL, unlike web's
    // ClayTile (kit.tsx) which gets this for free from the browser's own
    // dir="rtl" handling of flex-start/flex-end. Left unguarded, every card
    // (MobileHome.dc.html's own mockup wants content flush to the RTL
    // reading edge) rendered with its avatar+title stuck on the left and the
    // right side empty -- reported 2026-09-22. Mirror it explicitly.
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  avatar: {
    width: 58, height: 58, borderRadius: 999, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  title: { fontFamily: fonts.display, fontSize: 18 },
  sub: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, marginTop: 2 },
})
