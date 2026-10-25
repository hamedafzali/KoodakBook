import { ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenBackground from '@/components/ScreenBackground'
import { GameRoomCard, MarpeleArt, MemoryArt, OnlineArt } from '@/components/GameKit'
import { ramps, spacing } from '@/lib/theme'
import { RoomBand } from '@/components/RoomScene'
import BottomNav from '@/components/BottomNav'

const GAMES = [
  { key: 'marpele', Art: MarpeleArt, title: 'مارپله', sub: 'تنها، با خواهر و برادر، یا با دوستان بازی کن', tag: 'تا ۴ نفر', href: '/games/marpele' as const },
  { key: 'memory', Art: MemoryArt, title: 'بازی حافظه', sub: 'جفت هر کلمه را پیدا کن', tag: undefined, href: '/games/memory' as const },
  { key: 'marpele-online', Art: OnlineArt, title: 'مارپله آنلاین', sub: 'با دوستانت از راه دور بازی کن', tag: undefined, href: '/games/marpele-online' as const },
]

// 2026-09-28 visual-fidelity pass: was three horizontal rows (an emoji in a
// disc, two lines, a chevron) and half a screen of empty page -- much plainer
// than Home's room cards. Now Home's language at room scale: تندپا, the games
// host (web kit.tsx MODULE mapping), stands in a small illustrated band and
// greets the child, then the games as illustrated clay cards (GameKit): the
// board game as the wide hero, the other two side by side. Each card draws its
// game (a mini board, matching cards, two kids and a globe) instead of an
// emoji.
const GAP = spacing.sm + spacing.xs

export default function GamesHub() {
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
            ramp={ramps.games}
            character="tondpa"
            size="tall"
            topInset={insets.top}
            title="بازی‌ها"
            speechTitle="سلام! من تندپام"
            speech="امروز چی بازی کنیم؟ یکی رو انتخاب کن!"
          />
        </View>

        <GameRoomCard
          hero
          ramp={ramps.games}
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
              ramp={ramps.games}
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
