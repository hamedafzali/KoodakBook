import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { characterSvg } from '@/lib/characterSvg'
import { scenery } from '@/lib/theme'

/**
 * Branded launch screen shown while fonts load. Unifies with the native splash
 * (`app.json`'s `expo-splash-screen` config, `backgroundColor: '#FFF8EA'`) so
 * the two no longer read as two different screens back to back — one sky
 * tone, one mark, one moment. The scene itself is the same illustrated splash
 * from the redesign mockup (`Splash.dc.html`): sky + sun + terrain bands +
 * سیمرغ (proud) + wordmark + tagline + progress dots, ported to React Native.
 *
 * Two SVGs, not one hand-built tree of RN-SVG components:
 *  - `SCENE_SVG` is the mockup's background `<svg>` markup, verbatim, with its
 *    `var(--token)` custom properties resolved to literal hex (`SvgXml` has no
 *    CSS cascade to resolve them itself). Reusing the exact string rather than
 *    re-transcribing every path/coordinate by hand is what keeps this
 *    pixel-faithful to the mockup instead of an approximation of it.
 *  - The character comes from `characterSvg()` — the *library's* renderer,
 *    not app-local art, exactly like every character avatar elsewhere in the
 *    app (see `CharacterAvatar.tsx` on web; mobile has no rig-mounted
 *    avatar yet, so this is the first place mobile draws a character at all).
 *
 * Vazirmatn hasn't loaded yet when this shows (that's *why* it's showing —
 * `_layout.tsx` renders this exactly while `useFonts` is still pending), so
 * the wordmark uses the system font at weight 900 rather than
 * `fonts.display`. Persian renders fine in the system font; it just isn't
 * Vazirmatn's own cut for the one frame before the real font swaps in.
 */

const SCENE_W = 390
const SCENE_H = 844
const CHAR_SIZE = 220
const CHAR_LEFT = 85
const CHAR_TOP = 262

const SCENE_SVG = `<svg viewBox="0 0 ${SCENE_W} ${SCENE_H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="390" height="844" fill="#FFF8EA"/>
  <rect x="0" y="470" width="390" height="374" fill="#FFEFD6"/>
  <defs><pattern id="kbDotsS" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.6" fill="#E8B765" opacity=".16"/></pattern></defs><rect x="0" y="0" width="390" height="520" fill="url(#kbDotsS)"/>
  <circle cx="298" cy="146" r="98" fill="#FBBF24" opacity=".15"/>
  <circle cx="298" cy="146" r="64" fill="#FBBF24"/>
  <path d="M70 120 q6.0 -4.5 12.0 0 q6.0 -4.5 12.0 0" fill="none" stroke="#B99A63" stroke-width="2.85" stroke-linecap="round" opacity=".5"/><path d="M140 92 q4.4 -3.3 8.8 0 q4.4 -3.3 8.8 0" fill="none" stroke="#B99A63" stroke-width="2.09" stroke-linecap="round" opacity=".4"/><path d="M96 172 q4.0 -3.0 8.0 0 q4.0 -3.0 8.0 0" fill="none" stroke="#B99A63" stroke-width="1.9" stroke-linecap="round" opacity=".32"/>
  <g fill="#FFFFFF" opacity=".9">
    <rect x="34" y="238" width="96" height="25" rx="12.5"/>
    <circle cx="58" cy="238" r="20"/><circle cx="86" cy="228" r="26"/><circle cx="114" cy="240" r="18"/>
  </g>
  <g fill="#FFFFFF" opacity=".6">
    <rect x="252" y="336" width="76" height="19" rx="9.5"/>
    <circle cx="270" cy="336" r="15"/><circle cx="292" cy="328" r="21"/><circle cx="314" cy="337" r="13"/>
  </g>
  <path d="M0 572 q84 -60 172 -16 q92 46 182 -8 q20 -12 36 -4 L390 844 L0 844 Z" fill="#CFEDE2"/>
  <path d="M0 626 q100 -66 200 -12 q104 56 190 -8 L390 844 L0 844 Z" fill="#8FE2CC"/>
  <path d="M0 686 q120 -50 236 -6 q88 34 154 -12 L390 844 L0 844 Z" fill="#57D6BC"/>
  <path d="M0 734 q150 -28 268 2 q66 16 122 -10 L390 844 L0 844 Z" fill="#F3E0B4"/>
  <g><ellipse cx="44" cy="729" rx="20.28" ry="4.68" fill="#0F5C4A" opacity=".13"/><rect x="37.76" y="685.44" width="12.48" height="42.12" rx="6.24" fill="#8A5A24"/><circle cx="44" cy="669.84" r="26.52" fill="#127A55"/><circle cx="26.84" cy="682.32" r="16.38" fill="#0E6244"/><circle cx="59.6" cy="680.76" r="14.82" fill="#159C69"/><circle cx="34.64" cy="657.36" r="11.7" fill="#35C08C" opacity=".55"/></g><g><ellipse cx="348" cy="751" rx="16.12" ry="3.72" fill="#0F5C4A" opacity=".13"/><rect x="343.04" y="715.76" width="9.92" height="33.48" rx="4.96" fill="#8A5A24"/><circle cx="348" cy="703.36" r="21.08" fill="#127A55"/><circle cx="334.36" cy="713.28" r="13.02" fill="#0E6244"/><circle cx="360.4" cy="712.04" r="11.78" fill="#159C69"/><circle cx="340.56" cy="693.44" r="9.3" fill="#35C08C" opacity=".55"/></g>
  <g opacity=".9"><circle cx="120" cy="774" r="3.06" fill="#F472B6"/><circle cx="115.86" cy="774" r="3.06" fill="#F472B6"/><circle cx="124.14" cy="774" r="3.06" fill="#F472B6"/><circle cx="120" cy="769.86" r="3.06" fill="#F472B6"/><circle cx="120" cy="778.14" r="3.06" fill="#F472B6"/><circle cx="120" cy="774" r="2.16" fill="#FFE9A8"/></g><g opacity=".9"><circle cx="266" cy="786" r="2.89" fill="#A78BFA"/><circle cx="262.09" cy="786" r="2.89" fill="#A78BFA"/><circle cx="269.91" cy="786" r="2.89" fill="#A78BFA"/><circle cx="266" cy="782.09" r="2.89" fill="#A78BFA"/><circle cx="266" cy="789.91" r="2.89" fill="#A78BFA"/><circle cx="266" cy="786" r="2.04" fill="#FFE9A8"/></g><g opacity=".9"><circle cx="196" cy="796" r="2.72" fill="#FBBF24"/><circle cx="192.32" cy="796" r="2.72" fill="#FBBF24"/><circle cx="199.68" cy="796" r="2.72" fill="#FBBF24"/><circle cx="196" cy="792.32" r="2.72" fill="#FBBF24"/><circle cx="196" cy="799.68" r="2.72" fill="#FBBF24"/><circle cx="196" cy="796" r="1.92" fill="#FFE9A8"/></g>
  <path d="M118 319.8 Q120.21 327.79 128.2 330 Q120.21 332.21 118 340.2 Q115.79 332.21 107.8 330 Q115.79 327.79 118 319.8 Z" fill="#FFD98A" opacity=".95"/><path d="M288 388.2 Q289.69 394.31 295.8 396 Q289.69 397.69 288 403.8 Q286.31 397.69 280.2 396 Q286.31 394.31 288 388.2 Z" fill="#FFD98A" opacity=".95"/><path d="M84 425.4 Q85.43 430.57 90.6 432 Q85.43 433.43 84 438.6 Q82.57 433.43 77.4 432 Q82.57 430.57 84 425.4 Z" fill="#FFD98A" opacity=".95"/>
  <ellipse cx="195" cy="496" rx="88" ry="20" fill="#0F5C4A" opacity=".13"/>
  <path d="M0 812 q52 -18 100 -4 q44 12 88 -4 q50 -16 98 -2 q46 14 104 -6 L390 844 L0 844 Z" fill="#3DBFA4"/>
</svg>`

const STAR_SVG =
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
  `<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8L12 2.5Z" ` +
  `fill="#FBBF24" stroke="#745300" stroke-width="1.2"/></svg>`

export default function LaunchScreen() {
  // The mockup is a fixed 390×844 reference frame (iPhone-sized). Every real
  // device differs, so the frame is laid out at its own true size, centered
  // in the screen by ordinary flex centering, then uniformly scaled up around
  // that same center until it covers the viewport — the RN equivalent of CSS
  // `background-size: cover`. A non-uniform per-axis stretch (independently
  // scaling width and height to fill the screen) would warp the illustration
  // and throw the character/text positions out of register with the scenery
  // beneath them; a single `scale` factor keeps every coordinate below sourced
  // straight from the mockup, unchanged.
  const { width: winW, height: winH } = useWindowDimensions()
  const scale = Math.max(winW / SCENE_W, winH / SCENE_H)

  return (
    <View style={styles.root}>
      <View style={[styles.frame, { transform: [{ scale }] }]}>
        <SvgXml xml={SCENE_SVG} width={SCENE_W} height={SCENE_H} />

        <View style={[styles.charWrap, { left: CHAR_LEFT, top: CHAR_TOP, width: CHAR_SIZE, height: CHAR_SIZE }]}>
          <SvgXml xml={characterSvg('simorgh', { emotion: 'proud', size: CHAR_SIZE })} width="100%" height="100%" />
        </View>

        <View style={[styles.wordmarkWrap, { top: 528 }]}>
          {/* System font — see the file doc comment. */}
          <Text style={styles.wordmark}>کودک‌بوک</Text>
          <View style={styles.tagline}>
            <SvgXml xml={STAR_SVG} width={17} height={17} />
            <Text style={styles.taglineText}>هر شب یک قصه‌ی فارسی</Text>
          </View>
        </View>

        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, { opacity: 0.45 }]} />
          <View style={[styles.dot, { opacity: 0.25 }]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: scenery.sky, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: { width: SCENE_W, height: SCENE_H },
  charWrap: { position: 'absolute' },
  wordmarkWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wordmark: { fontSize: 52, fontWeight: '900', color: scenery.ink, textAlign: 'center' },
  tagline: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14,
    backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: scenery.line,
    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 20,
  },
  taglineText: { fontSize: 15, fontWeight: '700', color: scenery.muted },
  dots: {
    position: 'absolute', left: 0, right: 0, bottom: 96,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11,
  },
  // #FEEBCB/#745300 are the brand ramp's soft/deep stops (colors.primarySoft
  // isn't quite it — this is the mockup's own --bg3/--brand-deep pairing for
  // an inactive dot, kept literal rather than reaching into `ramps.brand`
  // since neither of its stops is exactly this one).
  dot: { width: 13, height: 13, borderRadius: 999, backgroundColor: '#FEEBCB', borderWidth: 2, borderColor: '#745300' },
  dotActive: { backgroundColor: '#FBBF24', opacity: 1 },
})
