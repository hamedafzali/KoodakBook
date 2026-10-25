import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import HoldToParent from '@/components/HoldToParent'
import Icon from '@/components/Icon'
import { fonts, radii, ramps, textSize, ui } from '@/lib/theme'

/**
 * Persistent bottom tab bar for the child app -- mirrors web's BottomNav.tsx:
 * four rooms + the parent door. Web's routes are grouped under /child/*;
 * mobile's are flat top-level routes, so this maps 1:1 onto those instead of
 * trying to introduce a route group.
 *
 * 2026-09-28 (owner, following the reference): simple LINE icons from the
 * shared set (components/Icon.tsx) with the Persian label under each,
 * replacing the colour emoji. The selected tab says so three ways: its icon
 * sits on a tinted pill, icon and label turn the active teal (bold label),
 * and a short underline sits under the label -- never colour alone. Same
 * four tabs, order (first = right under RTL), labels, roles, selected state
 * and parent door as before; the bar's height is unchanged within ~2pt, so
 * every screen's bottom padding still clears it.
 *
 * Mount this at the bottom of each of the four screens it names (absolutely
 * positioned, safe-area aware) rather than wiring it through a shared layout
 * -- those screens don't share a route group today and restructuring the
 * router was out of scope for this pass.
 */
const TABS = [
  { key: 'home', href: '/home', icon: 'home', label: 'خانه' },
  { key: 'lessons', href: '/lessons', icon: 'learn', label: 'درس‌ها' },
  { key: 'stories', href: '/stories', icon: 'book', label: 'داستان‌ها' },
  { key: 'rewards', href: '/rewards', icon: 'trophy', label: 'جایزه‌ها' },
] as const

// The selected colour: the stories ramp's deep teal (the reference's green-
// teal, and the hero's hills). 6.9:1 on white, ~6:1 on its own tinted pill;
// the resting grey, ui.textMuted, is 6.2:1 on white.
const ACTIVE = ramps.stories.deep
const REST = ui.textMuted

export type BottomNavKey = (typeof TABS)[number]['key']

// Behaviour only (no change at default text size): the bar's text stops
// growing at 130% system text. Uncapped, 200% made the 24pt emoji 48 and the
// labels 22, so the absolutely positioned bar grew to ~140pt on an iPhone,
// taller than the space screens pad for (Home: insets.bottom + 96 = 130), and
// covered the end of the page; its five items also outgrew a 320pt row. At
// 130% the bar is ~111pt there and ~85pt on Android without an inset. iOS's own tab bar doesn't
// scale with Dynamic Type either. Screens' paddings assume this cap.
const NAV_MAX_SCALE = 1.3

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
            style={({ pressed }) => [styles.item, pressed && !active && styles.itemPressed]}
            hitSlop={4}
            // A button named by its label, marked selected when it's this
            // screen (the icon is decorative: Icon hides itself).
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.iconWrap}>
              {active && <View style={styles.activePill} />}
              <Icon name={tab.icon} color={active ? ACTIVE : REST} size={24} strokeWidth={active ? 2.3 : 2} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} maxFontSizeMultiplier={NAV_MAX_SCALE}>{tab.label}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        )
      })}
      {/* Spoken name «بخش والدین»; the hold is in HoldToParent's hint. */}
      <HoldToParent style={styles.doorButton} accessibilityLabel="بخش والدین">
        <View style={styles.iconWrap}>
          <Icon name="lock" color={REST} size={22} />
        </View>
        <Text style={styles.label} maxFontSizeMultiplier={NAV_MAX_SCALE}>والدین</Text>
        <View style={styles.underline} />
      </HoldToParent>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: ui.divider,
    paddingTop: 6, paddingHorizontal: 6,
  },
  // Width budget at 320pt (the narrowest phone): 320 - 2x6 bar padding =
  // 308 for five items. Measured from Vazirmatn's advance widths (isolated
  // forms, an upper bound -- joined Persian is narrower), the widest label,
  // «داستان‌ها», is <= 50pt at 11pt bold and <= 65pt at the 1.3x cap. So:
  // item = max(58, pill 48, label + 4) -> 5 x 58 = 290 at 1x, and at 1.3x
  // 69 + 4 x 58 = 301 <= 308: one line, no shrinking, at every size. (The
  // first pass's 56pt pill + 8 padding was 5 x 64 = 320: over by 12.)
  // Targets stay >= 44pt both ways (58 x 55).
  item: {
    minWidth: 58, minHeight: 52, alignItems: 'center', justifyContent: 'center',
    gap: 1, paddingHorizontal: 2, paddingTop: 2,
  },
  itemPressed: { opacity: 0.6 },
  iconWrap: { width: 48, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  // The stories teal at 20% over the white bar (a pale mint pill).
  activePill: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    borderRadius: radii.pill, backgroundColor: ramps.stories.bright, opacity: 0.22,
  },
  label: { fontSize: textSize.micro, fontFamily: fonts.medium, color: REST },
  labelActive: { fontFamily: fonts.bold, color: ACTIVE },
  // Always laid out (transparent at rest), so a tab doesn't jump when it
  // becomes the selected one.
  underline: { width: 18, height: 3, borderRadius: radii.pill, marginTop: 1 },
  underlineActive: { backgroundColor: ACTIVE },
  doorButton: {
    minWidth: 58, minHeight: 52, alignItems: 'center', justifyContent: 'center',
    gap: 1, backgroundColor: 'transparent', paddingTop: 2, paddingBottom: 0, paddingHorizontal: 2,
  },
})
