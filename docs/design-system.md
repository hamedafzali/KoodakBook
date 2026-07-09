# KoodakBook Design System — «نارنج»

**Scope:** the child app (`apps/web` child surfaces). Parent/admin follow later.
**Code:** tokens in `globals.css` (`.shadow-card/.shadow-raised`, `.child-bg`),
components in `components/child/kit.tsx` (MODULE, IconChip, ModuleCard,
SectionTitle) + PageHeader/BottomNav v2.

## 1. Audit — what was wrong (evidence-based)

| Finding | Why it hurts | Research basis |
|---|---|---|
| 6+ saturated gradients per screen, assigned by array index | Color carried zero information; screens read as noise; white-on-gradient text fails contrast | NN/g kids-cognition: simplified layouts → fewer nav errors; WCAG AA |
| Mixed radii (md/lg/xl/[2rem]), mixed shadows, mixed tile heights | Reads "homemade"; children rely on shape consistency more than adults | Design-token practice; NN/g visual consistency |
| Category lists truncated to "first 4 + see all" | Children don't model hidden content; young kids saw the same 4 items forever | NN/g: children explore what is visible |
| No default action | 3–5s can't choose from menus | Duolingo's single-button model; attention-span research (4–6y: 8–10 min) |
| Some targets < 48dp | Developing motor skills need forgiving targets | IxDF/NN/g: ≥48dp, 60+ for primary, generous gaps |

## 2. Principles

1. **Color = information, never decoration.** One brand accent (saffron amber).
   Each learning module owns ONE hue used only as: icon chip, accent bar,
   soft fill, progress. A child navigates by color before reading.
2. **White cards on warm cream.** All reading text is slate-800 on white
   (AA+). Saturation lives in small areas (chips, bars), not backgrounds.
3. **One raised element per screen** — the primary action (`shadow-raised`);
   everything else rests at `shadow-card`.
4. **The app decides; the child confirms.** Every screen leads with one
   obvious next action (home: «بازی کن»).
5. **Windowed rows, never truncated lists.** Continue + next ~10 + 🎲 + 🚪.
6. **Age bands change density, not language.** 3–5 / 6–7 / 8–10 (NN/g bands).
7. **Friendly states:** locks sleep (😴), errors encourage, empty states invite.

## 3. Tokens

**Canvas** `.child-bg` cream gradient · **Surface** white · **Ink** slate-800 /
slate-400 (secondary) · **Brand** amber-400→orange-500 (hero only).

**Module hues** (chip `-100/-600`, bar `-400`, soft `-50`):
lessons=emerald · letters=sky · phonics=orange · stories=teal · review=violet ·
speak=pink · write=cyan · math=indigo · games=purple · rewards=amber.

**Radius** 12 (inputs) / 16 (cards) / 24 (featured) / full (chips-pills).
**Shadows** exactly two: `shadow-card`, `shadow-raised`.
**Type** Vazirmatn — page title 20 bold · section 16 bold · card 14 bold ·
caption 12 · learning text ≥32 with line-height ≥1.8 (harakat legibility).
**Touch** ≥48dp all, ≥56dp primary, ≥64dp band-1; gaps ≥12.
**Motion** one spring (400/17 tap, 300/20 enter); durations 200–400ms
(band 1 up to 600); celebration ≤1.5s; `prefers-reduced-motion` → fades.

## 4. Components (kit.tsx)

- **IconChip** — module emoji on soft tint, md/lg/xl. The color identity atom.
- **ModuleCard** — white row card (chip + title + sub), ≥72px, quiet chevron.
- **SectionTitle** — heading + module color tick.
- **PageHeader v2** — sticky white/blur, 48px back target, title + module
  accent bar (legacy `gradientClass` maps hue→bar; no saturated banners).
- **BottomNav v2** — active tab = soft amber pill (`layoutId` spring), ≥52px.
- **CardTile / LockedTile / ActionTile** (home) — fixed heights per size
  (172/212), module-soft image area, clamped titles.

**Every interactive component defines:** rest / pressed (spring scale ~0.96) /
active (pill or ring) / disabled (opacity-40, never hidden) / focus-visible.

## 5. Migration status

✅ tokens, kit, PageHeader (all screens), BottomNav (all screens), child home.
⬜ lesson/story/review/speak/write/math/memory inner screens: replace local
gradient blocks with MODULE tints as touched; use SectionTitle/ModuleCard.
⬜ parent app: separate calmer variant of the same tokens.
Rule for new screens: no new colors, no new radii, no new shadows — compose kit.
