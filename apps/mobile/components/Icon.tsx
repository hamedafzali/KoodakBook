/**
 * Icon — KoodakBook's single line-icon set (Agent A, design system).
 *
 * Grammar: 24-unit viewBox, 2-unit rounded strokes (round caps + joins), no
 * fill except where a glyph needs a solid shape (play, star when `filled`).
 * Matches the reference's bottom-nav / UI icons so every screen draws the same
 * pictures. Colour comes from the caller (use a theme token, never a literal).
 *
 * Direction: the app runs with native RTL forced (app/_layout.tsx), so
 * "forward" means toward the reading END — LEFT in Persian. Directional icons
 * (chevron, chevronBack, back, forward, send) mirror automatically when
 * I18nManager.isRTL; pass `flip` to override (true = always mirror,
 * false = never). Media glyphs (play/volume) are never mirrored (platform
 * convention).
 *
 * Decorative by default (hidden from screen readers) — the Pressable/Text
 * around it carries the label. Pass `label` for a standalone meaningful icon.
 */
import { I18nManager, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

type Glyph = { d?: string[]; fill?: string[]; rects?: [number, number, number, number, number][]; circles?: [number, number, number][]; dir?: true }

const G: Record<string, Glyph> = {
  home: { d: ['M3.5 10.5 12 3.5l8.5 7', 'M5.5 9v10.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9', 'M10 20.5V15h4v5.5'] },
  learn: { d: ['M2.5 9 12 4.5 21.5 9 12 13.5z', 'M6.5 11.5V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.5', 'M21.5 9v5.5'] },
  book: { d: ['M12 6.5C10 5 7 4.5 3.5 4.5v13.5c3.5 0 6.5.5 8.5 2 2-1.5 5-2 8.5-2V4.5C17 4.5 14 5 12 6.5z', 'M12 6.5v13.5'] },
  gamepad: { d: ['M7.5 6.5h9a5 5 0 0 1 5 5v3a3.5 3.5 0 0 1-6.2 2.2L14.3 16H9.7l-1 .7A3.5 3.5 0 0 1 2.5 14.5v-3a5 5 0 0 1 5-5z', 'M7.5 9.5v4', 'M5.5 11.5h4', 'M15.5 10h.01', 'M17.5 12.5h.01'] },
  trophy: { d: ['M8 4h8v5.5a4 4 0 0 1-8 0z', 'M8 6H4.5v.5A3.5 3.5 0 0 0 8 10', 'M16 6h3.5v.5A3.5 3.5 0 0 1 16 10', 'M12 13.5V17', 'M8.5 20.5h7', 'M9.5 17h5l.5 3.5H9z'] },
  star: { d: ['M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z'] },
  lock: { rects: [[5, 11, 14, 9.5, 2.5]], d: ['M8 11V8a4 4 0 0 1 8 0v3', 'M12 15v2'] },
  chevron: { d: ['M9 5.5l6.5 6.5L9 18.5'], dir: true },
  chevronBack: { d: ['M15 5.5 8.5 12l6.5 6.5'], dir: true },
  back: { d: ['M19.5 12h-15', 'M10.5 6l-6 6 6 6'], dir: true },
  forward: { d: ['M4.5 12h15', 'M13.5 6l6 6-6 6'], dir: true },
  close: { d: ['M6 6l12 12', 'M18 6 6 18'] },
  play: { fill: ['M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z'] },
  pause: { d: ['M8.5 5v14', 'M15.5 5v14'] },
  volume: { d: ['M4 9.5v5h3.5l5 4v-13l-5 4z', 'M16 9a4.2 4.2 0 0 1 0 6', 'M18.8 6.2a8.2 8.2 0 0 1 0 11.6'] },
  check: { d: ['M5 12.5l4.5 4.5L19 7.5'] },
  gift: { rects: [[3.5, 7.5, 17, 4, 1], [5, 11.5, 14, 9, 1.5]], d: ['M12 7.5v13', 'M12 7.5C10.5 4.5 7 4 7 6s3.5 1.5 5 1.5z', 'M12 7.5c1.5-3 5-3.5 5-1.5s-3.5 1.5-5 1.5z'] },
  sparkle: { d: ['M11 3.5l1.9 5.1L18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9z', 'M18.5 15v5', 'M16 17.5h5'] },
  heart: { d: ['M12 20s-8-4.6-8-10.2A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.6C20 15.4 12 20 12 20z'] },
  bell: { d: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z', 'M10 21a2.2 2.2 0 0 0 4 0'] },
  user: { circles: [[12, 8, 4]], d: ['M4.5 20.5a7.5 7.5 0 0 1 15 0'] },
  users: { circles: [[9, 8, 3.5]], d: ['M2.5 20a6.5 6.5 0 0 1 13 0', 'M15.5 4.7a3.5 3.5 0 0 1 0 6.6', 'M18 14a6.5 6.5 0 0 1 3.5 6'] },
  chat: { d: ['M5 4.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z', 'M8 10.5h.01', 'M12 10.5h.01', 'M16 10.5h.01'] },
  mic: { rects: [[9, 3, 6, 11, 3]], d: ['M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21'] },
  pencil: { d: ['M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z', 'M13.5 7l3 3'] },
  plus: { d: ['M12 5v14', 'M5 12h14'] },
  minus: { d: ['M5 12h14'] },
  send: { d: ['M4.5 4.5 20 12 4.5 19.5 7 12z', 'M7 12h6'], dir: true },
  refresh: { d: ['M20 12a8 8 0 1 1-8-8c2.2 0 4.3.9 5.9 2.4L20 8.5', 'M20 3.5v5h-5'] },
  settings: { circles: [[15, 7, 2], [9, 17, 2]], d: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9'] },
}

export type IconName =
  | 'home' | 'learn' | 'book' | 'gamepad' | 'trophy' | 'star' | 'lock'
  | 'chevron' | 'chevronBack' | 'back' | 'forward' | 'close'
  | 'play' | 'pause' | 'volume' | 'check' | 'gift' | 'sparkle' | 'heart'
  | 'bell' | 'user' | 'users' | 'chat' | 'mic' | 'pencil' | 'plus' | 'minus' | 'refresh' | 'settings'
  | 'send'

export const ICON_NAMES = Object.keys(G) as IconName[]

export type IconProps = {
  name: IconName
  /** Stroke/fill colour — pass a theme token. */
  color: string
  /** Rendered size in pt (square). Default 24. */
  size?: number
  /** Stroke width in viewBox units. Default 2 (the set's grammar). */
  strokeWidth?: number
  /** Fill closed shapes (star/heart/…) with `color` — for "earned" states. */
  filled?: boolean
  /** Mirror override. Default: directional icons mirror under RTL. */
  flip?: boolean
  /** Makes the icon meaningful to screen readers (otherwise decorative). */
  label?: string
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function isDirectionalIcon(name: IconName): boolean {
  return !!G[name]?.dir
}

export function Icon({ name, color, size = 24, strokeWidth = 2, filled = false, flip, label, style, testID }: IconProps) {
  const g = G[name]
  if (!g) return null
  const mirror = flip ?? (g.dir ? I18nManager.isRTL : false)
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: filled ? color : 'none' }
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={mirror ? [{ transform: [{ scaleX: -1 }] }, style] : style}
      testID={testID}
      {...a11y}
    >
      {g.rects?.map(([x, y, w, h, r], i) => <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={r} {...stroke} />)}
      {g.circles?.map(([cx, cy, r], i) => <Circle key={`c${i}`} cx={cx} cy={cy} r={r} {...stroke} />)}
      {g.d?.map((d, i) => <Path key={`p${i}`} d={d} {...stroke} />)}
      {g.fill?.map((d, i) => <Path key={`f${i}`} d={d} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />)}
    </Svg>
  )
}

export default Icon
