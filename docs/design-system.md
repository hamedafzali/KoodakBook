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
slate-400 (secondary) · **Brand** amber-700→orange-700 (hero only; darkened
from amber-400→orange-500 in the 2026-09 contrast pass — the original pair
put white text at ~1.7–2.8:1, well under WCAG AA's 4.5:1 floor).

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
✅ contrast + shape tokens (2026-09 visual UX audit): every child screen now
uses only `shadow-card`/`shadow-raised` and the 12/16/24/full radius scale,
and every white-on-gradient/solid text instance was re-measured to ≥~4.5:1
(kit.tsx MODULE + ChunkyButton, globals.css brand tokens, and per-screen
gradients in rewards/lesson/story/story-new/friends-talk/home). `write` also
got a fixed thumb-zone action bar (mobile reachability) and directional
arrows for pre-readers. Guarded by `scripts/check-child-design-tokens.sh`
(`npm run lint:design`) so raw `rounded-md/lg/[1.5rem]` and
`shadow-sm/md/lg` don't reappear.
⬜ lesson/story/review/speak/write/math/memory inner screens: still need the
deeper componentization — replace local gradient blocks with MODULE tints,
use SectionTitle/ModuleCard throughout (the 2026-09 pass fixed contrast/shape
tokens on these screens but did not restructure them onto the shared
components).
✅ parent app contrast/shadow/radius pass (2026-09): fixed the one real
WCAG-AA failure (dashboard level/XP card, white-on-violet-500→purple-600 —
now violet-700→purple-800), replaced ad-hoc `shadow-sm/md/lg` with
`shadow-card`/`shadow-raised` across dashboard/friends/progress/settings/
plan/conversations/share/ParentNav, and brought the few off-token radii
(conversations' `rounded-2xl`, ParentGate's arbitrary `rounded-[2rem]`/
`[0.875rem]`) onto the parent app's own theme scale (its `@theme inline`
`--radius-sm/md/lg/xl` in globals.css — a *different* scale from the child
app's kit.tsx radii, not to be conflated). Also fixed share's canvas card,
which was still drawing the pre-contrast-pass 3-stop brand gradient.
⬜ parent app: not yet componentized into a shared kit the way child has
kit.tsx — this pass fixed tokens in place, no new shared components.
⬜ admin: has a real, partially-adopted component kit already
(`apps/admin/src/components/ui.tsx`) — needs a migration-completion pass
(several dashboard pages still hand-roll gray-* markup instead of using
Card/DataTable), not a new design system. One a11y gap (unlabeled ▲▼✕
icon buttons in lessons/page.tsx) was fixed in the 2026-09 pass; the kit
migration itself is not started.
Rule for new screens: no new colors, no new radii, no new shadows — compose kit.
