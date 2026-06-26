# KoodakBook App — Desktop / Responsive Plan

## Current state (the problem)
The app is a **mobile-first PWA with no desktop adaptation**:
- Root layout (`app/layout.tsx`) has **no max-width container** → on a laptop/monitor every screen stretches edge-to-edge.
- `BottomNav` is `fixed bottom-0 left-0 right-0` → a phone tab-bar spanning the full width of a wide screen.
- Pages are `px-4/px-5` full-bleed sections; only a few cards have `max-w-*`.

Result: on desktop it looks broken — a giant stretched phone.

## Core principle — two surfaces, two desktop strategies
KoodakBook is really **two apps** with opposite desktop needs:

1. **Child interface** (`/child/*`) — a **touch experience for a kid on a tablet/phone.** It should **not** spread into a wide canvas (oversized tap targets, lost focus, bad eye-tracking for a child). On desktop, present it as a **centered tablet-width "stage"** on a warm full-bleed backdrop — like the app running on a device in the middle of the screen. Stays touch-first.
2. **Parent dashboard** (`/parent/*`) — **adults on a laptop.** This **should** use the width: a real responsive **multi-column** layout with **sidebar nav** (not the child bottom-bar), side-by-side charts, wider tables. This is where desktop adds genuine value.

> Don't redesign the child UI for desktop — children barely use desktops; parents do. Spend the desktop effort on the parent surface; give the child surface a tasteful centered frame.

## Breakpoints (Tailwind)
`base` <768 (phone) · `md` ≥768 (tablet/small laptop) · `lg` ≥1024 (laptop) · `xl` ≥1280 (desktop). Cap content so ultrawide doesn't sprawl.

## Per-area design

### Child interface — centered "stage"
- New `app/child/layout.tsx`: wrap children in `mx-auto w-full max-w-[520px]`, with the warm gradient extended to the **full viewport** behind it (so it's a centered card, not a narrow strip on white).
- On `lg+`, give the stage a device-like frame: `lg:my-6 lg:rounded-[2.5rem] lg:shadow-2xl lg:overflow-hidden lg:min-h-[calc(100vh-3rem)]`.
- **BottomNav**: constrain to the stage width — `fixed` but `max-w-[520px] left-1/2 -translate-x-1/2` (centered under the stage) instead of full-width.
- Story reader: keep single page-by-page, but on desktop **center + scale up** (larger text/illustration, `max-w` on the page). Two-page spread is a later nicety, not now.
- Lessons / quiz / hero: all live inside the stage; existing 2-col grids stay.

### Parent dashboard — responsive shell
- New `app/parent/layout.tsx`: on `lg+`, a **left sidebar** (داشبورد / پیشرفت / تنظیمات / اشتراک‌گذاری) replacing reliance on the child bottom-nav; on mobile keep the current single-column + back-links.
- Content wrapper `max-w-[1100px] mx-auto` (no infinite sprawl).
- **Dashboard**: KPI tiles in a row; the level / daily-goal / 7-day-heatmap / sessions / badges panels in `md:grid-cols-2 lg:grid-cols-3` instead of stacked.
- **Progress**: tabs → a wider tab bar (or side tabs at lg); word-by-mastery lists wrap into `md:columns-2 lg:columns-3`.
- Hover states (desktop has a pointer): cards/rows get `hover:` affordances.

### Shared
- Full-viewport backdrop: warm gradient for `/child`, `slate-50` for `/parent`.
- Slightly larger type scale at `lg`.
- The route-group layouts (`child/layout.tsx`, `parent/layout.tsx`) keep this clean and avoid touching every page.

## Implementation phases
1. **Child stage wrapper** — `app/child/layout.tsx` (center + backdrop) + constrain BottomNav. *Biggest immediate win, lowest risk: kills the edge-to-edge stretch in one change.*
2. **Parent responsive shell** — `app/parent/layout.tsx` (sidebar at lg+) + dashboard/progress grids go multi-column.
3. **Story reader desktop** — center + scale; (two-page spread optional, later).
4. **Polish** — type scale, hover states, larger imagery, keyboard nav.

## Tradeoffs
- **Centered stage vs full desktop child redesign:** stage is the right call — preserves the touch design, looks intentional, cheap. A bespoke desktop child UI is wasted effort.
- **Parent gets the real responsive treatment** because that's the actual desktop audience.
- Route-group layouts mean ~2 new files do most of the work — pages mostly unchanged.
