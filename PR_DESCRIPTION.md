# Design recovery: restore the DESIGN_CHARTER.md child experience

## Why

A prior "visual UX pass" (2026-09, marked `SUPERSEDED` in
`docs/design-system.md`) flattened the child app toward generic
clean/professional/minimal conventions — white-on-dark text, monochrome
icons, hairline-gray lists — that fight what this product actually is: a
toy and a picture book for pre-readers, not office software. See
[`DESIGN_CHARTER.md`](../../DESIGN_CHARTER.md), which now overrides any
generic design-review preset for this app: bright warm color, dark ink on
bright fills, colorful emoji/illustration as identity (not decoration),
56px touch targets, and springy tactile motion, respecting
`prefers-reduced-motion`.

This branch (`design-recovery`, not merged to `main`) rebuilds the child
side against that charter, phase by phase, each phase its own commit.

## What changed, by phase

- **Phase 0** — stopped the generic UI/UX-Pro design-review ruleset from
  overriding the charter on this repo.
- **Phase 1** — restored the joyful palette: dark ink on bright/soft
  fills, warm neutrals instead of cold slate grays.
- **Phase 2** — put colorful emoji back for section identity, feedback,
  and celebration (monochrome line icons stayed scoped to small utility
  controls and the parent area, per the charter).
- **Phase 3** — rebuilt child-home: a glowing "next" card over illustrated
  shelves.
- **Phase 4a/4b** — on-brand ink token + type ladder + rounded display
  face; restored per-item color on screens the flattening had made
  monochrome (approved deviation: Group/NavRow kept its own reduced
  treatment where the charter's per-item color didn't apply cleanly).
- **Phase 5** — warmed up the parent app: cream backgrounds, rounded
  cards, one soft shadow level, saffron accents — calmer than the child
  side but not corporate.
- **Phase 6** — rewrote `docs/design-system.md` to match what was
  actually built, marking the flattening-era sections `SUPERSEDED`.
- **(unnumbered)** `c0bc1bf` — fixed ~24px horizontal overflow on the
  child-home hero, found ahead of the formal small-phone sweep.
- **Phase 7 — fixes from review:**
  - **7a** — bumped every tappable element on child screens (BottomNav
    tabs, carousel arrows, 🔊 chips, answer buttons, dice button, game
    cards) to a real ≥56×56px hit area with ≥8px gaps, per the charter's
    "56px for small fingers" (the visual can stay smaller; padding
    extends the hit area).
  - **7b** — fixed the story-reader page counter's bidi flip ("12 / 1"
    reading backwards in RTL) and the English-translation contrast; swept
    every other counter/progress label for the same class of bug.
  - **7c** — ran axe-core (wcag2a/wcag2aa/wcag21aa) across all 10 child
    screens at 390×844, fixed every AA failure found (see contrast table
    below), and separately swept the same 10 screens at 360×740 for
    overflow/clipping — zero found. Re-run after fixes: zero violations.
  - **7d** — trimmed the Baloo Bhaijaan 2 font weights to the one
    actually used (700 only): **215,420 → 168,656 bytes** (~22% smaller,
    both families, clean build).
  - **7e** — finished the `text-gray-400/500` → `text-text-secondary`
    sweep across the remaining screens axe didn't directly flag (auth,
    onboarding, parent gate, empty/loading states).
- **Phase 8 — Fluent Emoji, approved with changes:** a static
  `<Emoji name="...">` component (`apps/web/public/emoji/*.svg`,
  Fluent Emoji "Color" style via Iconify, SVGO-optimized, MIT-licensed)
  replacing raw emoji characters for section identity, BottomNav,
  feedback, and celebration — 14 glyphs, **109,944 bytes total**, loaded
  per-glyph on demand, not bundled; `party-popper` used the Flat style
  (one exception, Color was 21KB over the 15KB/glyph budget). Falls back
  to the native character if the SVG fails to load. Content emoji
  (counted objects, board tokens, badge faces) and `apps/mobile` stay
  native, as scoped. Rule documented in `DESIGN_CHARTER.md` and
  `docs/design-system.md`.
- **Phase 9 — ready-to-merge check (not merged):**
  - **9a** — `prefers-reduced-motion` gap found and fixed: the global CSS
    rule only zeroed CSS transition/animation durations, which doesn't
    reach framer-motion's JS-driven springs. Added a root-wide
    `MotionConfig reducedMotion="user"` and routed all 8 canvas-confetti
    celebration bursts through a guarded wrapper that no-ops under
    reduced motion (success state — badge, sound, stage advance — still
    happens; only the particle burst is dropped). Verified live: gameplay
    completes correctly under emulated reduced motion, no confetti
    canvas, no console errors.
  - Gate: `tsc --noEmit` clean, eslint at baseline (**58/58, identical
    37 errors/21 warnings split to pre-change**), `next build` succeeds,
    `check-child-design-tokens.sh` (advisory) run.
  - Lighthouse mobile, branch vs `main` (`--only-categories=performance,accessibility --form-factor=mobile --throttling-method=simulate`):

    | Page | Branch perf | Main perf | Branch a11y | Main a11y |
    |---|---|---|---|---|
    | `/child/home` | 0.98 | 0.99 | 0.96 | 0.96 |
    | `/child/story` | 1.00 | 1.00 | 0.96 | 0.96 |

    No regression (max 1-point performance delta, well under the 5-point
    threshold) — no fix needed.
  - Final screenshot set (390×844 @2x, covers fixture active, plus
    `/child/home` and `/child/story` at 360×740) in
    `design-screenshots/final/` — **not committed to git**: excluded by
    a pre-existing local `.git/info/exclude` rule that already keeps
    `design-screenshots/old` and `/new` untracked. Left in place to match
    that convention rather than force-added; flag this if you want them
    committed instead.

## Contrast table (fixed in Phase 7c, re-verified zero axe violations)

| Element | Before | After | Ratio |
|---|---|---|---|
| BottomNav emoji glyphs | keyboard-focusable hidden node (`aria-hidden-focus`) | `tabIndex={-1}` pinned, Link is the real target | n/a (focus-order fix) |
| RoomCard subtitle (child-home, math, lesson room cards) | ink token at `opacity-75` | full-strength ink token | below 4.5:1 → AA pass |
| QuizCard English hint (flashcard correct-answer) | `text-gray-400` | `text-text-secondary` | ~2.6:1 → ~7:1 |
| Parent-dashboard 7-day heatmap cells | `aria-label` on bare `<div>` (`aria-prohibited-attr`) | `role="img"` added | n/a (ARIA-validity fix) |
| Story-reader English translation | grey text | warm grey (`text-text-secondary`) | ≥4.5:1 |

## Left open

- **Screenshots not committed** — see note above; a call for whoever
  merges this on whether to force-add `design-screenshots/final/` or
  keep it local-only.
- **`apps/mobile`** wasn't touched by Phase 8's `<Emoji>` work — it stays
  on native emoji characters, as explicitly scoped by the approved plan.
- **No merge performed** — this branch is ready for review but was
  explicitly not merged to `main`, per instruction.
