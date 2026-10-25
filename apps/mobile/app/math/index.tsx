import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenBackground from '@/components/ScreenBackground'
import { BazaarArt, CountingArt, DigitsArt, GameRoomCard } from '@/components/GameKit'
import { ramps, spacing } from '@/lib/theme'
import { RoomBand } from '@/components/RoomScene'
import BottomNav from '@/components/BottomNav'

/** دنیای اعداد — mobile hub for the math games (web: /child/math). Each game
 *  is pitched at an age band (see each screen's header comment), shown as the
 *  card's tag so a parent or child can pick the right one. */
const GAMES = [
  { key: 'counting', Art: CountingArt, title: 'شمارش', sub: 'ضربه بزن و بشمار', tag: '۳ تا ۵ سال', href: '/math/counting' as const },
  { key: 'digits', Art: DigitsArt, title: 'رقم‌های فارسی', sub: '۷ همان 7 است!', tag: '۶ و ۷ سال', href: '/math/digits' as const },
  { key: 'bazaar', Art: BazaarArt, title: 'بازار', sub: 'با تومان خرید کن', tag: '۸ تا ۱۰ سال', href: '/math/bazaar' as const },
]

// 2026-09-28 visual-fidelity pass: the same room layout as the games hub.
// خرسی, math's host (web kit.tsx MODULE mapping), greets from an illustrated
// band; the three games are illustrated clay cards (apples being counted,
// ۷ = 7, a bazaar stall), counting as the wide hero. Was three plain rows
// and an empty half page.
const GAP = spacing.sm + spacing.xs

export default function MathHub() {
  const insets = useSafeAreaInsets()
  const [hero, ...rest] = GAMES
  return (
    <ScreenBackground variant="warm">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 92 }]}>
        {/* The rooms' shared header (RoomScene, 2026-09-29): the room's
            landscape full-bleed under the status bar, back + title, and the
            host greeting the child in a speech bubble. Replaces ScreenHeader
            + GameKit's own host band (same words, same host, same back). */}
        <View style={styles.bandWrap}>
          <RoomBand
            ramp={ramps.math}
            character="khersi"
            size="tall"
            topInset={insets.top}
            title="دنیای اعداد"
            speechTitle="سلام! من خرسی‌ام"
            speech="بیا با هم با عددها بازی کنیم!"
          />
        </View>

        <GameRoomCard
          hero
          ramp={ramps.math}
          title={hero.title}
          sub={hero.sub}
          tag={hero.tag}
          art={<hero.Art />}
          onPress={() => router.push(hero.href)}
        />
        <View style={styles.grid}>
          {rest.map((g) => (
            <GameRoomCard
              key={g.key}
              ramp={ramps.math}
              title={g.title}
              sub={g.sub}
              tag={g.tag}
              art={<g.Art />}
              onPress={() => router.push(g.href)}
            />
          ))}
        </View>
      </ScrollView>
      <BottomNav />
    </ScreenBackground>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: GAP },
  // Full-bleed: the band spans the screen; the cards keep the gutter.
  bandWrap: { marginHorizontal: -spacing.md },
  // Wraps and stretches: both cards in the row share the taller one's height.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
})
