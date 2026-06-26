# KoodakBook — Real Desktop Version (design plan)

## The correction
What shipped earlier was **responsive *centering*** — the phone layout in a fixed
max-width column on a desktop backdrop. That is *not* a desktop version; it's the
mobile UI not breaking. A real desktop version **reflows into multi-column
layouts, uses the horizontal space, and changes the navigation paradigm** (a
bottom thumb-bar makes no sense on a laptop). This plan supersedes the
"centered stage" approach.

## Principle
Design **two real layouts per surface**, switched at `lg` (≥1024px) — not one
layout scaled. Mobile stays as-is (it's good). Desktop is a distinct composition.

```
mobile  : single column, bottom tab bar, stacked sections
desktop : persistent left rail + content that reflows into a responsive grid
```

---

## A. Parent — a true analytics dashboard (highest value)
Parents on laptops; this is real data. It should look like the **admin** dashboard
(which already uses width), not a centered phone.

- **Chrome:** persistent **left sidebar** (already built: `ParentNav`) + a **top
  bar** (child switcher, share/settings, account). Content area uses a 12-col grid.
- **Dashboard (lg):**
  - Row 1: 4–5 **KPI cards** across (streak · words · stories · lessons · level).
  - Row 2: a `lg:grid-cols-3` masonry — wide-left **reading-readiness + level
    progression + weekly activity chart**; right column **daily goal · recent
    badges · recent sessions**. Charts sit *side by side*, not stacked.
- **Progress (lg):** master–detail — left rail of filters (mastery / lessons /
  stories / sessions), right a **wide multi-column** word grid + tables. No tabs;
  show more at once.
- **Reuse:** the admin's chart components (LineChart/Donut/CohortHeatmap pattern)
  and `DataTable` — same family, parent-styled.

## B. Child — landscape, not a centered card
Kids use tablets/laptops too; a real desktop child layout is **landscape**, with
**bigger illustrations and more air** — not a 540px strip.

- **Nav:** bottom tab bar → a **left vertical rail** (icon + label) at `lg`.
  Desktop has no thumb zone; the rail is the desktop pattern.
- **Home (lg):** two-column —
  - **Left "companion" panel** (sticky): mascot, greeting, streak/level, the
    "ادامه بده" continue card.
  - **Right activity area** (wider): lessons / stories / practice in `lg:grid-cols-3`
    or `-4`, larger cards, real cover art.
- **Lessons / quiz (lg):** two-pane — **illustration/prompt left (large)**,
  **answer options right** in a comfortable column. Big targets, generous spacing.
- **Story reader (lg):** the signature desktop win — a **two-page spread**:
  full illustration on one side, text + tap-to-hear controls on the other (RTL:
  text right, art left). On mobile it stays single page-by-page.
- **Scale:** larger type, larger imagery, hover states (desktop has a pointer).

## C. Navigation paradigm (both surfaces)
| | mobile | desktop (lg) |
|---|---|---|
| Child | bottom tab bar | left icon rail (home/lessons/stories/rewards) |
| Parent | header back-links | persistent sidebar (`ParentNav`) + top bar |

A small `useBreakpoint`/CSS-only switch renders the rail at `lg`, the bar below.

## D. Architecture (how, cleanly)
- **Route-group layouts** own the desktop chrome (`child/layout.tsx`,
  `parent/layout.tsx`): render the rail/sidebar at `lg`, the mobile nav below.
- **Pages reflow** via Tailwind responsive utilities — `flex-col lg:flex-row`,
  `lg:grid-cols-3`, `lg:sticky` — genuine structural changes, not `max-w`.
- **Componentize the desktop pieces** (`AppRail`, `ParentTopBar`, `StorySpread`,
  `HomeCompanion`) so mobile and desktop share data, differ in composition.
- Content **max-width** generous (e.g., 1280–1440px) and centered only at the
  outer edge so ultrawide doesn't sprawl — but the *content fills it*.

## E. Phases (by value)
1. **Parent desktop dashboard** — multi-column grid + topbar + charts side-by-side
   (sidebar already in place). Biggest real-desktop payoff; reuses admin chart kit.
2. **Child desktop chrome** — left rail at `lg`; **home** two-column (companion +
   wide activity grid).
3. **Story reader two-page spread** at `lg` — the standout child desktop moment.
4. **Lessons/quiz two-pane** + larger imagery.
5. **Polish** — type/imagery scale, hover, keyboard nav, focus states.

## F. Tradeoffs (stated plainly)
- A real desktop version = **two layouts to design and maintain** per surface —
  more work than centering, but it's what "desktop" means.
- **Parent first** is unambiguous (adults, data, laptops — highest ROI).
- **Child desktop** ROI is lower (kids skew tablet), but the **landscape story
  spread** and a wider, art-forward home are genuinely better on a laptop and worth
  doing after the parent dashboard.
- Keep mobile untouched; desktop is additive at `lg`, so no regression risk to the
  phone/tablet experience that's working.
