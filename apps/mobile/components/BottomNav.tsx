import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HoldToParent from '@/components/HoldToParent'
import { colors, fonts } from '@/lib/theme'

/**
 * Persistent bottom tab bar for the child app -- mirrors web's BottomNav.tsx:
 * four rooms + the parent door, colourful emoji marks (not monochrome
 * strokes, DESIGN_CHARTER.md: a pre-reader picks a tab by its picture), the
 * active tab lifted on a soft brand pill. Web's routes are grouped under
 * /child/*; mobile's are flat top-level routes, so this maps 1:1 onto those
 * instead of trying to introduce a route group.
 *
 * Mount this at the bottom of each of the four screens it names (absolutely
 * positioned, safe-area aware) rather than wiring it through a shared layout
 * -- those screens don't share a route group today and restructuring the
 * router was out of scope for this pass.
 */
const TABS = [
  { key: 'home', href: '/home', emoji: '🏠', label: 'خانه' },
  { key: 'lessons', href: '/lessons', emoji: '📚', label: 'درس‌ها' },
  { key: 'stories', href: '/stories', emoji: '📖', label: 'داستان' },
  { key: 'rewards', href: '/rewards', emoji: '🏆', label: 'جوایز' },
] as const

export type BottomNavKey = (typeof TABS)[number]['key']

// `current` is undefined for a screen that's a real nav destination on web
// (so it still gets the bar) but isn't one of the four tabs itself -- e.g.
// phonics, speak, write, math, games, friends. Same as web: the bar shows,
// nothing lights up active.
export default function BottomNav({ current }: { current?: BottomNavKey }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = tab.key === current
        return (
          <Pressable
            key={tab.key}
            onPress={() => { if (!active) router.replace(tab.href) }}
            style={styles.item}
            hitSlop={4}
          >
            {active && <View style={styles.activePill} />}
            <Text style={[styles.emoji, !active && styles.emojiInactive]}>{tab.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        )
      })}
      <HoldToParent style={styles.doorButton}>
        <Text style={styles.doorEmoji}>🔒</Text>
        <Text style={styles.label}>والدین</Text>
      </HoldToParent>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: colors.primarySoft,
    paddingTop: 8, paddingHorizontal: 6,
  },
  item: {
    minWidth: 60, minHeight: 52, alignItems: 'center', justifyContent: 'center',
    gap: 1, borderRadius: 16, paddingHorizontal: 6, paddingVertical: 4,
  },
  activePill: {
    position: 'absolute', top: 0, bottom: 0, left: 2, right: 2,
    backgroundColor: colors.primarySoft, borderRadius: 16,
  },
  emoji: { fontSize: 24 },
  emojiInactive: { opacity: 0.75 },
  label: { fontSize: 11, fontFamily: fonts.medium, color: colors.muted, marginTop: 1 },
  labelActive: { fontFamily: fonts.bold, color: colors.onPrimary },
  doorButton: {
    minWidth: 60, minHeight: 52, alignItems: 'center', justifyContent: 'center',
    gap: 1, backgroundColor: 'transparent', paddingVertical: 4, paddingHorizontal: 6,
  },
  doorEmoji: { fontSize: 20 },
})
