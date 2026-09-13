// Matches web's brand tokens (apps/web/src/app/globals.css: --ramp-brand-*)
// so the mobile app is the same saffron identity, not a placeholder. `primary`
// is the bright fill (buttons, active chips) -- text/icons drawn ON that fill
// use `onPrimary` (dark ink), never white: bg-amber-500/white measures ~2:1,
// well under the 4.5:1 floor (see design-review-2026-09-11.md). `onPrimary`
// doubles as the brand-colored TEXT color on light backgrounds (tab labels,
// links) for the same reason -- the bright tone is illegible as text on cream.
// `primaryDeep` is the pressed/bevel shade (web's --ramp-brand-deep).
export const colors = {
  bg: '#fdf6ec',
  card: '#ffffff',
  text: '#3b2f2f',
  muted: '#7a6a58',
  primary: '#FBBF24',
  onPrimary: '#654900',
  primaryDeep: '#745300',
  primarySoft: '#FEF3C7',
  success: '#22c55e',
  danger: '#dc2626',
}

// Same face as web (next/font Vazirmatn). RN picks weight by family name,
// not fontWeight, so each weight is its own family.
export const fonts = {
  regular: 'Vazirmatn_400Regular',
  medium: 'Vazirmatn_500Medium',
  bold: 'Vazirmatn_700Bold',
}
