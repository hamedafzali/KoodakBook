import { useMemo, type ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
  type AccessibilityRole, type StyleProp, type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg'
import type { EmotionName } from 'pixel-wizards-charachters'
import { characterSvg } from '@/lib/characterSvg'
import { Icon, type IconName } from '@/components/Icon'
import {
  clay, colors, deepAction, elevation, fonts, naturalLineHeight, radii, ramps, scenery, spacing, textSize, textStart,
  textStyles, ui, type Ramp,
} from '@/lib/theme'

/* ── Clay: the child app's tactile material, as components ───────────────────
 *
 * Mobile port of web's components/child/clay.tsx + the `.clay` recipe in
 * apps/web/src/app/globals.css, so a clay surface means the same thing on both
 * platforms. Before this (2026-09-25), mobile had the idea three times over,
 * each hand-built with its own numbers: ModuleCard's shell/panel, home's goal
 * card, and the story quiz's answer buttons.
 *
 * Two tones, both driven by one module ramp so no caller picks a hex:
 *   bright  face = ramp.bright, edge = ramp.deep, text = ramp.ink. Gets web's
 *           light: a vertical gradient that runs LIGHTER toward the bright
 *           stop, plus a soft specular glow at the top-left. Both only ever
 *           lighten the face, so ink-on-bright contrast (solved per ramp in
 *           tools/design/ramps.py) can improve but never regress.
 *   soft    face = ramp.soft with a hairline border, edge = ramp.bright. The
 *           quieter tile look (ModuleCard's). No gradient: on a near-white
 *           face it would be invisible and cost a native view per tile.
 *   deep    face = ramp.deep running DARKER toward the bottom, edge darker
 *           still; the one tone that carries WHITE text (DESIGN_CHARTER:
 *           white only on the deep stop, which clears >=7:1 on every ramp).
 *           No specular glow: it would lighten the face under white text.
 *           For the single most important card on a screen, not for tiles.
 *
 * The top-left light is a lighting convention shared with the character art
 * (pixel-wizards-charachters lights every character from the top-left), not
 * a reading direction, so it deliberately does not mirror under RTL.
 *
 * ── Which primitive for what (child screens; tokens in lib/theme.ts) ───────
 *
 *  Actions   ClayButton tone="bright"   the ONE primary action of a view
 *            ClayButton tone="soft"     a secondary action beside it
 *            ClayButton tone="deep"     a heavy white-label action (speak's
 *                                       «گفتم»); `icon` for a line glyph
 *            TextButton                 tertiary: back, skip, «رد کن», cancel
 *            (`busy` while a request runs, `disabled` when it can't run yet)
 *  Cards     ClayCard (pressable) / ClaySurface (static), one ramp each:
 *              tone="deep"   the single most important card (Home's continue)
 *              tone="bright" a highlighted card / goal / primary tile
 *              tone="soft"   everyday tiles and list rows (Home's path tiles)
 *            `selected` on a choice (quiz answer, picker option): ramp.deep
 *            ring + accessibilityState.selected. Answer feedback uses
 *            answerRamps (theme.ts), not a new colour.
 *  Chips     ClayChip: status pill ("تمام شده"); with onPress + selected it is
 *            a filter/choice chip (44pt hit area).
 *            DeepActionCard   the Continue-Learning family: deep indigo
 *                             (deepAction) card, thumbnail + title + progress
 *                             + go chevron. ONE per screen, at the top.
 *  Progress  ProgressTrack: any bar (fills from the reading start = right in
 *            Persian, warm neutral track, ramp.deep fill; `onDeep` on a deep
 *            card). Always pair it with the count in words («۳ از ۵»).
 *  Headings  SectionHeading (title, optional eyebrow, optional «همه ›» link
 *            via onSeeAll -- Home's section row exactly); ScreenHeader for the
 *            screen's own title + back (Icon back arrow) + host on `right`.
 *  Icons     components/Icon.tsx (line set, 2pt round strokes, RTL-aware
 *            chevrons/arrows). Emoji stay for child CONTENT symbols (a room's
 *            fallback, a sticker); UI affordances (back, see-all, play,
 *            lock, close, go) are Icons, never ←/→/› characters or emoji.
 *  Art       CharacterArt (a cast pose) / HostAvatar (character in a disc).
 *            Prefer them to emoji wherever a cast character fits.
 *  States    LoadState (spinner or character loading -> error + retry),
 *            EmptyState (nothing here yet: art + words + optional action),
 *            both in components/LoadState.tsx. Never fake content.
 *  Text      textStyles.* presets; wrap labels (no numberOfLines on buttons,
 *            max 2 on tile titles) and use minHeight, never height, on any
 *            box holding text.
 *  Tokens    shape.* for radii by role (card/tile md, hero/button lg, chip
 *            pill, sheet xl), spacing.ms (12) between cards, elevation.card
 *            only on flat white surfaces (clay has its own edge), iconSize.*.
 *
 *  Screen recipe (child): ScreenBackground warm -> ScreenHeader (host on
 *  `right`) -> optional DeepActionCard -> SectionHeading + a row/grid of
 *  ClayCard tone="soft" in the room's ramp -> ClayButton for the one action.
 *  Page inset spacing.md; gap spacing.ms in rows, spacing.lg between sections.
 */

export type ClayTone = 'bright' | 'soft' | 'deep'

/** Spread on decorative Text/View: hidden from VoiceOver and TalkBack. */
const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const

/** Mix a #RRGGBB colour toward white. Web does color-mix(in oklab, white 20%,
 *  fill); sRGB mixing is close enough at 20% and needs no colour library.
 *  Exported 2026-09-29 (Home and ModuleCard had copies named `tint`). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Mix a #RRGGBB colour toward black. Only ever used to make the deep face
 *  and its edge darker, which can only raise white-text contrast. */
export function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c * (1 - amount))
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

function BrightLight({ fill }: { fill: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[lighten(fill, 0.2), fill]} locations={[0, 0.66]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="kbClaySpecular" cx="26%" cy="14%" rx="72%" ry="56%" fx="26%" fy="14%">
            <Stop offset="0" stopColor={colors.card} stopOpacity={0.34} />
            <Stop offset="0.62" stopColor={colors.card} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#kbClaySpecular)" />
      </Svg>
    </View>
  )
}

/**
 * The material itself, visual only (wrap it in a Pressable and pass `pressed`
 * to make it tactile). `faceStyle` lays out the content; the edge band and the
 * press travel are owned here so every caller presses the same way.
 */
export function ClaySurface({
  ramp, tone = 'bright', pressed = false, selected = false, radius = radii.md, edge = clay.edge,
  style, faceStyle, children, deepStops,
}: {
  ramp: Ramp
  tone?: ClayTone
  pressed?: boolean
  /** tone="deep" only: exact face gradient + edge instead of the ones derived
   *  from ramp.deep (DeepActionCard passes theme `deepAction`). */
  deepStops?: { face: string; faceEnd: string; edge: string }
  /** Chosen option: a ring in the ramp's deep stop (white on tone="deep")
   *  drawn OVER the face, so toggling it never shifts the layout. Visual
   *  only -- the Pressable around it reports accessibilityState.selected
   *  (ClayCard does both). */
  selected?: boolean
  radius?: number
  edge?: number
  style?: StyleProp<ViewStyle>
  faceStyle?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  const shown = pressed ? Math.min(edge, clay.pressedEdge) : edge
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'deep' ? (deepStops?.edge ?? darken(ramp.deep, 0.45)) : tone === 'bright' ? ramp.deep : ramp.bright,
          borderRadius: radius,
          paddingBottom: shown,
          // Travel down by exactly what the edge lost: the bottom stays put.
          marginTop: edge - shown,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.face,
          { borderRadius: radius, backgroundColor: tone === 'deep' ? (deepStops?.face ?? ramp.deep) : tone === 'bright' ? ramp.bright : ramp.soft },
          tone === 'soft' && styles.softFace,
          faceStyle,
        ]}
      >
        {tone === 'bright' && <BrightLight fill={ramp.bright} />}
        {tone === 'deep' && (
          <LinearGradient
            colors={deepStops ? [deepStops.face, deepStops.faceEnd] : [ramp.deep, darken(ramp.deep, 0.22)]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {children}
        {selected ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: radius, borderWidth: ui.selectedRing, borderColor: tone === 'deep' ? ui.onDeep : ramp.deep },
            ]}
          />
        ) : null}
      </View>
    </View>
  )
}

/**
 * A pressable clay card: Pressable + ClaySurface with the press, selected and
 * disabled states wired the same way everywhere. Use it for tiles, list rows
 * and choice cards instead of hand-pairing the two (Home predates it and pairs
 * them by hand, identically). `accessibilityLabel` is required: a card holds
 * several texts and art, so say what it is in one sentence (e.g. «الفبا، ۲ از
 * ۵ تمام شده» or «…، هنوز قفل است»).
 */
export function ClayCard({
  ramp, tone = 'soft', onPress, accessibilityLabel, accessibilityHint,
  accessibilityRole = 'button', selected, disabled = false, radius = radii.md, edge = clay.edge,
  style, surfaceStyle, faceStyle, children,
}: {
  ramp: Ramp
  tone?: ClayTone
  onPress: () => void
  accessibilityLabel: string
  accessibilityHint?: string
  /** 'button' (default); 'radio' for one-of-many choices; 'link' when it
   *  navigates somewhere a child reads as "a place". */
  accessibilityRole?: AccessibilityRole
  /** Leave undefined for an ordinary card; true/false for a choice (reported
   *  to screen readers either way, so "not selected" is spoken too). */
  selected?: boolean
  disabled?: boolean
  radius?: number
  edge?: number
  /** Outer (Pressable) layout: width, flex, margins. */
  style?: StyleProp<ViewStyle>
  /** ClaySurface's own outer style, e.g. { flex: 1 } to fill a row's height. */
  surfaceStyle?: StyleProp<ViewStyle>
  faceStyle?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(selected === undefined ? null : { selected }) }}
      style={[style, disabled && styles.buttonDisabled]}
    >
      {({ pressed }) => (
        <ClaySurface
          ramp={ramp} tone={tone} pressed={pressed && !disabled} selected={!!selected}
          radius={radius} edge={edge} style={surfaceStyle} faceStyle={faceStyle}
        >
          {children}
        </ClaySurface>
      )}
    </Pressable>
  )
}

/** The face of a clay action. Split from ClayButton so a larger
 *  Pressable (a whole card) can own the press and still sink this face.
 *  `bright` (default) is the primary action; `soft` is the quieter
 *  secondary one (pale face, hairline, same ink label and press). */
export function ClayButtonFace({
  ramp, label, emoji, pressed = false, tone = 'bright', selected = false, busy = false, icon, iconPosition = 'start',
}: {
  ramp: Ramp; label: string; emoji?: string; pressed?: boolean
  /** 'deep' (2026-09-29): the ramp's deep face with WHITE label/icon (>=7:1
   *  on every ramp) -- a big "I did it" disc/button (speak's «گفتم»). */
  tone?: 'bright' | 'soft' | 'deep'
  selected?: boolean
  /** A line Icon in the label's ink (play, check, chevron…). Use it instead
   *  of an arrow character in `label`; decorative (the label says it). */
  icon?: IconName
  /** 'start' (default) = before the label (right in Persian); 'end' for a
   *  "next ›" chevron after it. */
  iconPosition?: 'start' | 'end'
  /** Replaces the emoji with a spinner in the label's ink. */
  busy?: boolean
}) {
  const fg = tone === 'deep' ? ui.onDeep : ramp.ink
  return (
    <ClaySurface ramp={ramp} tone={tone} pressed={pressed} selected={selected} radius={radii.lg} faceStyle={styles.buttonFace}>
      {busy ? <ActivityIndicator color={fg} /> : emoji ? <Text style={styles.buttonEmoji} maxFontSizeMultiplier={1.2} {...HIDDEN}>{emoji}</Text> : null}
      {icon && iconPosition === 'start' && !busy ? <Icon name={icon} color={fg} size={22} strokeWidth={2.5} /> : null}
      {/* No numberOfLines: a long label (or a narrow button at 320pt) wraps
          and the face grows, rather than hiding words behind «…». */}
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      {icon && iconPosition === 'end' ? <Icon name={icon} color={fg} size={22} strokeWidth={2.5} /> : null}
    </ClaySurface>
  )
}

/** Primary child action: a bright clay pill, at least 56pt tall (it grows
 *  when the label wraps), ink label. A button to assistive tech; `disabled`
 *  is reported by the Pressable itself. */
export function ClayButton({
  ramp, label, emoji, icon, iconPosition, onPress, accessibilityLabel, accessibilityHint, style, tone = 'bright',
  disabled = false, busy = false, selected,
}: {
  ramp: Ramp
  label: string
  emoji?: string
  /** Line Icon beside the label (see ClayButtonFace). */
  icon?: IconName
  iconPosition?: 'start' | 'end'
  onPress: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: StyleProp<ViewStyle>
  /** 'soft' for a secondary action next to a primary one; 'deep' for a
   *  heavy white-label action (see ClayButtonFace). */
  tone?: 'bright' | 'soft' | 'deep'
  disabled?: boolean
  /** A request is running: spinner in the face, presses ignored, reported
   *  as busy. Not faded -- the child should see it's working, not broken. */
  busy?: boolean
  /** For a toggle/choice rendered as a button (ring + selected state). */
  selected?: boolean
}) {
  const inert = disabled || busy
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy, ...(selected === undefined ? null : { selected }) }}
      style={[style, disabled && styles.buttonDisabled]}
    >
      {({ pressed }) => (
        <ClayButtonFace
          ramp={ramp} label={label} emoji={emoji} icon={icon} iconPosition={iconPosition} pressed={pressed && !inert} tone={tone}
          selected={!!selected} busy={busy}
        />
      )}
    </Pressable>
  )
}

/** Tertiary action: underlined words, no clay (back, skip, cancel) -- the
 *  quiet option under a ClayButton. 44pt tall and at least 88pt wide however
 *  short the word. `color` defaults to ui.text (>=11:1 on the page); pass a
 *  ramp's ink on that ramp's soft face, ui.onDeep on a deep one. */
export function TextButton({
  label, onPress, accessibilityLabel, accessibilityHint, accessibilityRole = 'button',
  color = ui.text, size = 'small', disabled = false, style,
}: {
  label: string
  onPress: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: 'button' | 'link'
  color?: string
  size?: 'small' | 'caption'
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.textButton, disabled && styles.buttonDisabled, style]}
    >
      {({ pressed }) => (
        <Text style={[styles.textButtonLabel, { color, fontSize: textSize[size] }, pressed && styles.textPressed]}>{label}</Text>
      )}
    </Pressable>
  )
}

/** Small status/label pill: white face, ramp-coloured rim, ink text.
 *  With `onPress` it becomes a choice/filter chip: a button with a 44pt hit
 *  area (the pill stays 30pt), and `selected` fills it with the ramp's bright
 *  stop, rims it in deep and prefixes a ✓ -- so the state isn't colour-only
 *  -- and reports accessibilityState.selected. */
export function ClayChip({
  ramp, label, emoji, selected, onPress, accessibilityLabel, decorative = false,
}: {
  ramp: Ramp
  label: string
  emoji?: string
  selected?: boolean
  onPress?: () => void
  accessibilityLabel?: string
  /** Hide the whole chip from screen readers when the surrounding control's
   *  label already says it (e.g. «تمام شده» inside a card's label). Ignored
   *  with onPress: a control is never hidden. */
  decorative?: boolean
}) {
  const face = (pressed: boolean) => (
    <View
      {...(decorative && !onPress ? HIDDEN : null)}
      style={[
        styles.chip,
        { borderColor: ramp.bright },
        selected && { backgroundColor: ramp.bright, borderColor: ramp.deep },
        pressed && styles.textPressed,
      ]}
    >
      {selected ? <Text style={[styles.chipCheck, { color: ramp.ink }]} {...HIDDEN}>✓</Text> : null}
      {emoji ? <Text style={styles.chipEmoji} maxFontSizeMultiplier={1.2} {...HIDDEN}>{emoji}</Text> : null}
      <Text style={[styles.chipLabel, { color: ramp.ink }]}>{label}</Text>
    </View>
  )
  if (!onPress) return face(false)
  return (
    <Pressable
      onPress={onPress}
      hitSlop={7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
    >
      {({ pressed }) => face(pressed)}
    </Pressable>
  )
}

/** Section title: an optional small eyebrow over a display-weight heading.
 *  `onSeeAll` adds Home's «همه ›» (see all) link at the row's far end --
 *  the same metrics as Home's SectionRow (bold 15 ink + a 16pt forward
 *  chevron Icon, 44x44 minimum): a link to assistive tech, labelled
 *  «همه‌ی <title>» unless seeAllAccessibilityLabel names the destination
 *  («همه‌ی قصه‌ها»). Without it the heading renders exactly as before. */
export function SectionHeading({
  title, eyebrow, onSeeAll, seeAllLabel = 'همه', seeAllAccessibilityLabel,
}: {
  title: string
  eyebrow?: string
  onSeeAll?: () => void
  seeAllLabel?: string
  seeAllAccessibilityLabel?: string
}) {
  const heading = (
    <View style={[styles.heading, onSeeAll && styles.headingFlex]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.headingTitle} accessibilityRole="header">{title}</Text>
    </View>
  )
  if (!onSeeAll) return heading
  return (
    <View style={styles.headingRow}>
      {heading}
      <Pressable
        onPress={onSeeAll}
        hitSlop={8}
        style={styles.seeAll}
        accessibilityRole="link"
        accessibilityLabel={seeAllAccessibilityLabel ?? `${seeAllLabel}‌ی ${title}`}
      >
        {({ pressed }) => (
          <View style={[styles.seeAllInner, pressed && styles.textPressed]}>
            <Text style={styles.seeAllText}>{seeAllLabel}</Text>
            <Icon name="chevron" color={scenery.ink} size={16} strokeWidth={3} />
          </View>
        )}
      </Pressable>
    </View>
  )
}

/** Western -> Persian digits for counts shown in child UI («۳ از ۵»). */
export function faDigits(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

/**
 * A progress bar, the one way every screen draws one (2026-09-28). The fill
 * is the first child of a row, so under the app's forced RTL it grows from
 * the reading START (the right in Persian) -- never position it with
 * left/right or alignSelf. Track: warm neutral (ui.track) by default, the
 * translucent deepAction.track with `onDeep`. Fill: ramp.deep (>=3:1 on the
 * page and on white/soft faces), deepAction.fill with `onDeep`.
 * `value` is a done-count with `total`, or a 0..1 fraction without it.
 * Accessible as a progressbar with its value («۳ از ۵») unless `decorative`
 * -- set that when the card around it already says the count in its label
 * (Home's cards do), so it isn't read twice. Always show the count in words
 * next to it too: a bar alone is colour-only information.
 */
export function ProgressTrack({
  value, total, ramp = ramps.brand, onDeep = false, height = 8, fillColor, trackColor,
  accessibilityLabel, decorative = false, style,
}: {
  value: number
  total?: number
  ramp?: Ramp
  /** On a deep card (DeepActionCard / ClaySurface tone="deep"). */
  onDeep?: boolean
  height?: number
  fillColor?: string
  trackColor?: string
  /** What is progressing («درس‌های الفبا»); the value is added for you. */
  accessibilityLabel?: string
  decorative?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const frac = Math.max(0, Math.min(1, total ? value / total : value))
  const pct = Math.round(frac * 100)
  const valueText = total ? `${faDigits(value)} از ${faDigits(total)}` : `${faDigits(pct)} درصد`
  const a11y = decorative
    ? HIDDEN
    : {
      accessible: true,
      accessibilityRole: 'progressbar' as const,
      accessibilityLabel,
      accessibilityValue: { min: 0, max: total ?? 100, now: total ? Math.min(value, total) : pct, text: valueText },
    }
  return (
    <View
      {...a11y}
      style={[
        styles.track,
        { height, backgroundColor: trackColor ?? (onDeep ? deepAction.track : ui.track) },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct}%`, height, borderRadius: radii.pill,
          backgroundColor: fillColor ?? (onDeep ? deepAction.fill : ramp.deep),
        }}
      />
    </View>
  )
}

/**
 * The deep "carry on" card -- the Continue-Learning family (Home's continue
 * card, Stories' «ادامه‌ی قصه», a room's next lesson). Reference look:
 * deep indigo clay (ClaySurface tone="deep" on deepAction.ramp = ramps.math),
 * a rounded thumbnail at the reading start, eyebrow + title + optional
 * subtitle in white, an optional progress track + «۳ از ۵», and a round go
 * disc with a forward chevron (points LEFT in Persian) at the end. The whole
 * card is one button (>=112pt tall, 96 compact), pressed = the clay sink.
 * Pass `ramp` only when the card must wear its room's colour; white text is
 * safe on every ramp's deep stop (>=7:1). `thumbnail` is any node (an
 * expo-image Image, CharacterArt at thumbSize-12, an emoji Text); it is
 * clipped to a radii.md square on ramp.soft and hidden from screen readers.
 * The accessibility label defaults to «eyebrow: title، subtitle، ۳ از ۵».
 */
export function DeepActionCard({
  title, eyebrow, subtitle, progress, thumbnail, thumbSize, onPress, accessibilityLabel, accessibilityHint,
  ramp = deepAction.ramp, compact = false, titleLines = 2, goIcon = 'chevron', style,
}: {
  title: string
  eyebrow?: string
  subtitle?: string
  /** done/total drive the bar; `label` replaces the «۳ از ۵» text. */
  progress?: { done: number; total: number; label?: string }
  thumbnail?: ReactNode
  /** Default 84 (64 compact) -- Home's continue-card sizes. */
  thumbSize?: number
  onPress: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  ramp?: Ramp
  /** Narrow phones / inside a list: smaller thumb and go disc. */
  compact?: boolean
  /** Max title lines (raise it at large text sizes). */
  titleLines?: number
  /** The go disc's glyph: 'chevron' (default, forward) or e.g. 'play'. */
  goIcon?: IconName
  /** Outer (Pressable) layout: margins, e.g. Home's negative overlap. */
  style?: StyleProp<ViewStyle>
}) {
  const thumb = thumbSize ?? (compact ? 64 : 84)
  const go = compact ? 44 : 52
  const count = progress ? (progress.label ?? `${faDigits(progress.done)} از ${faDigits(progress.total)}`) : undefined
  const label = accessibilityLabel
    ?? [eyebrow ? `${eyebrow}: ${title}` : title, subtitle, count].filter(Boolean).join('، ')
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={style}
    >
      {({ pressed }) => (
        <ClaySurface
          ramp={ramp} tone="deep" pressed={pressed} radius={radii.lg}
          deepStops={ramp === deepAction.ramp ? deepAction : undefined}
          style={[elevation.deep, { shadowColor: ramp.ink }]}
          faceStyle={[deepStyles.face, compact && deepStyles.faceCompact]}
        >
          {/* Pressed: darken the face (under the content, so text only gains
              contrast) on top of the clay sink. */}
          {pressed ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: deepAction.pressedOverlay }]} /> : null}
          {thumbnail ? (
            <View {...HIDDEN} style={[deepStyles.thumb, { width: thumb, height: thumb, backgroundColor: ramp.soft }]}>
              {thumbnail}
            </View>
          ) : null}
          <View style={deepStyles.text}>
            {eyebrow ? <Text style={deepStyles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
            <Text style={deepStyles.title} numberOfLines={titleLines}>{title}</Text>
            {subtitle ? <Text style={deepStyles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
            {progress ? (
              <View style={deepStyles.progressRow}>
                <ProgressTrack value={progress.done} total={progress.total} ramp={ramp} onDeep decorative style={deepStyles.progress} />
                <Text style={deepStyles.count}>{count}</Text>
              </View>
            ) : null}
          </View>
          <View {...HIDDEN} style={[deepStyles.go, { width: go, height: go, backgroundColor: ramp.bright }]}>
            <Icon name={goIcon} color={ramp.ink} size={24} strokeWidth={3} />
          </View>
        </ClaySurface>
      )}
    </Pressable>
  )
}

const deepStyles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, padding: spacing.ms, minHeight: 112 },
  faceCompact: { minHeight: 96 },
  thumb: { borderRadius: radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: spacing.xxs },
  eyebrow: { fontFamily: fonts.bold, fontSize: textSize.caption, color: deepAction.text, textAlign: textStart },
  // naturalLineHeight: a 2-line Persian title keeps room for its marks (QA P2).
  title: {
    fontFamily: fonts.display, fontSize: textSize.cardTitle, lineHeight: naturalLineHeight(textSize.cardTitle),
    color: deepAction.text, textAlign: textStart,
  },
  subtitle: { fontFamily: fonts.medium, fontSize: textSize.caption, color: deepAction.textMuted, textAlign: textStart },
  // wrap: at large text the count drops under the bar instead of squeezing it.
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  progress: { flexGrow: 1, flexBasis: 96 },
  count: { fontFamily: fonts.bold, fontSize: textSize.caption, color: deepAction.text },
  go: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
})

/* ── Illustration rules (home, 2026-09-25; apply the same way elsewhere) ────
 *
 *  Source   Characters come only from pixel-wizards-charachters, drawn by
 *           CharacterArt as static poses (mobile has no animated rig). Room
 *           hosts follow web's kit.tsx MODULE mapping exactly; چرخی (charkhi)
 *           is the journey companion and سیمرغ the app's guide. No stock art,
 *           no icon packs, no external image URLs.
 *  Scale    One focal character per composition. In a HostAvatar disc the art
 *           is the disc minus a 6pt white ring (size - 12). In a scene: focal
 *           ~104pt, companion ~0.55x of that.
 *  Surface  On clay, a character sits in a white HostAvatar disc (ramp-bright
 *           rim), never straight on a bright gradient face. In a scene it
 *           stands on the ground line, clear of any text.
 *  Padding  Keep art at least spacing.sm from a scene's edges; art never sits
 *           under text.
 *  Mood     encouraging = inviting ("come in"), happy = greeting/companion,
 *           thinking = waiting, proud = success. Never sad/confused on home.
 *  RTL      Place characters with flow layout (a row puts the first child at
 *           the reading start, the right). Never absolute left/right: RN swaps
 *           them under RTL by default (I18nManager doLeftAndRightSwapInRTL).
 *           Scene art itself is not mirrored.
 *  A11y     Art is decorative and hidden from screen readers; the control it
 *           sits in carries the words.
 *  Fallback A room without a host shows its emoji in the same disc (web does
 *           the same for phonics/write/friends: a deliberate child-facing
 *           symbol, not a gap). An unknown slug falls back to Simorgh inside
 *           characterSvg, so pass only known slugs.
 */

/** A cast character, static pose (mobile has no animated rig; see
 *  lib/characterSvg.ts). Decorative: hidden from screen readers. The SVG
 *  string is memoized: building it walks the whole character spec. */
export function CharacterArt({
  character, emotion = 'encouraging', size,
}: { character: string; emotion?: EmotionName; size: number }) {
  const xml = useMemo(() => characterSvg(character, { emotion, size }), [character, emotion, size])
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  )
}

/** A room's host in its disc: white fill, the room's bright rim, the
 *  character inset by a 6pt ring -- or the room's emoji where it has no host
 *  (see the Fallback rule above). One component so every disc on home has
 *  the same proportions. Decorative. */
export function HostAvatar({
  ramp, size, character, emoji, emotion = 'encouraging',
}: { ramp: Ramp; size: number; character?: string; emoji?: string; emotion?: EmotionName }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.host, { width: size, height: size, borderColor: ramp.bright }]}
    >
      {character ? (
        <CharacterArt character={character} emotion={emotion} size={size - 12} />
      ) : emoji ? (
        // Capped at 1x: the disc is a fixed size, so a large-text setting
        // would push the glyph past its rim (QA, 2026-09-27).
        <Text style={{ fontSize: Math.round(size * 0.46) }} maxFontSizeMultiplier={1}>{emoji}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
  // A row, so the first child (the fill) sits at the reading start under RTL.
  track: { flexDirection: 'row', alignSelf: 'stretch', borderRadius: radii.pill, overflow: 'hidden' },
  host: {
    borderRadius: radii.pill, borderWidth: 3, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  softFace: { borderWidth: 2, borderColor: scenery.line },
  // minHeight, never height: a wrapped label grows the face. paddingVertical
  // only matters then -- one line (~28pt) sits well inside the 56pt minimum,
  // so single-line buttons (Home's) are unchanged.
  buttonFace: {
    minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  buttonEmoji: { fontSize: textSize.cardTitle },
  buttonLabel: { fontFamily: fonts.display, fontSize: textSize.body, textAlign: 'center', flexShrink: 1 },
  // Disabled: faded, and the face doesn't sink (the Pressable also reports
  // accessibilityState.disabled on its own).
  buttonDisabled: { opacity: ui.disabledOpacity },
  textButton: { minHeight: ui.hit, minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  textButtonLabel: { fontFamily: fonts.bold, textAlign: 'center', textDecorationLine: 'underline' },
  textPressed: { opacity: 0.6 },
  // No alignSelf here on purpose: flex-start on a column's cross axis does
  // not follow RN's forced RTL (the ModuleCard bug, 2026-09-22). Callers put
  // the chip in a row, which does mirror.
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    minHeight: 30, paddingHorizontal: spacing.sm, borderRadius: radii.pill,
    borderWidth: 2, backgroundColor: colors.card,
  },
  chipEmoji: { fontSize: textSize.small },
  chipCheck: { fontFamily: fonts.bold, fontSize: textSize.caption },
  // flexShrink: in a row next to text (lessons) a long label wraps inside
  // the chip instead of pushing past the row.
  chipLabel: { fontFamily: fonts.bold, fontSize: textSize.caption, flexShrink: 1 },
  heading: { gap: 2 },
  headingFlex: { flex: 1, minWidth: 0 },
  // Same metrics as Home's own SectionRow (app/home.tsx).
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  seeAll: { minHeight: ui.hit, minWidth: ui.hit, justifyContent: 'center', paddingHorizontal: spacing.xs },
  seeAllInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  seeAllText: textStyles.seeAll,
  // colors.text, not colors.muted: headings sit on the page gradient, and
  // muted measures 4.46:1 at its darker end (#FEEBCB), just under AA for
  // 13px text. Hierarchy comes from size and weight instead.
  eyebrow: { fontFamily: fonts.medium, fontSize: textSize.caption, color: colors.text, textAlign: textStart },
  headingTitle: { fontFamily: fonts.display, fontSize: textSize.cardTitle, color: scenery.ink, textAlign: textStart },
})
