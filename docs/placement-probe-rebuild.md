# Placement Probe Rebuild — Design Plan

**Status:** proposal — design phase, no code changed yet. Builds on
`docs/placement-progression-rebuild.md` (gate/prior model) and
`docs/re-placement-flow-design.md` (re-placement, which reuses this same
probe and inherits every change here). Read both first; this doc assumes
their vocabulary (`prior`, `gate`, `w(n)`, `demonstrated_X`, decision i/ii)
without re-deriving it.

**Prompted by:** the probe was flagged as a known-weak instrument in both of
those docs and deliberately deferred (rebuild doc §6.5, re-placement doc §5:
*"a genuinely weak instrument... rebuilding it... remains worthwhile"*). This
is that follow-up. Three specific complaints, all confirmed against the
current code: it isn't adaptive despite being called that, its difficulty
signal is wrong for Persian, and it feeds the decaying-prior model with no
notion of its own confidence.

---

## 1. What the current probe actually does, precisely

`GET /api/placement/probe` (`apps/backend/src/routes/placement.ts`) builds
**exactly 4 hardcoded questions, one per strand, in fixed order V→D→F→C**:

| # | Strand | Nominal stage | Mode | Source pool | Picks |
|---|---|---|---|---|---|
| Q1 | V | 1 | listen → pick picture | `words where stage = 1` | 1 correct + 2 distractors |
| Q2 | D | 2 | listen → pick letter | all letters with audio | 1 correct + 2 distractors |
| Q3 | F | *3* | read → pick picture | **same `stage = 1` pool as Q1** | 1 correct + 2 distractors |
| Q4 | C | *4* | read (hardest) | **same `stage = 1` pool**, sorted by `persian.length` desc, top pick | 1 "hardest" + 2 distractors |

Two things worth flagging precisely because they're easy to miss reading the
code casually:

- **Q3 and Q4's "stage 3" / "stage 4" labels are cosmetic.** The query never
  filters by stage — both draw from the identical stage-1 word pool as Q1.
  Stage-2/3/4 words that already exist in the content DB are never touched
  by the probe. The only thing that makes Q4 "harder" than Q3 is the
  length-sort.
- **Requires ≥9 stage-1 words with audio + ≥3 letters with audio**, or the
  route 503s and the client skips the probe entirely (child defaults to
  level 1 everywhere). This is a content-availability guard, not a
  measurement decision.

**Scoring** (`scorePlacement`, `packages/shared/src/placement.ts`) takes the
4-length `boolean[]` and does two unrelated things with it:

```
streak = length of the leading run of `true` from index 0
level  = min(4, 1 + streak)                    // OVERALL, coarse level
strands[i] = answers[i] ? 2 : 1                // PER-STRAND, from that item alone
```

- `level` depends on a **leading streak**, i.e. a single miss anywhere caps
  it, regardless of what comes after. A child who misses Q1 but nails Q2–Q4
  scores identically to one who misses all four (`level = 1` either way).
- Every per-strand value is **binary — 1 or 2, never 3 or 4** — one passed
  item cannot distinguish "just barely got it" from "found it trivial."
  This is already characterised (not endorsed) in `placement.test.ts`'s own
  comment on the all-correct case.
- **"Adaptive" currently means "the client stops presenting further
  questions after the first miss"** (onboarding only — re-placement always
  runs all 4, per its own doc). It is not adaptive in the branching sense:
  no item is ever chosen *because of* a prior answer, and difficulty never
  routes — it only truncates.
- **Where "4" comes from:** one question per strand, hardcoded 1:1 in route
  code (`V, D, F, C` in a fixed literal order). It was never derived from
  how many items are needed to place reliably — it's an artifact of "one
  strand needs one representative question."
- **What placement writes about its own confidence: nothing.**
  `POST /result` inserts `child_strand_levels.level` and `prior_level` but
  never touches the `confidence` column. `confidence` is set only inside
  `strands.ts:persistGates` (`1 - w(n)`), which only runs on a *recompute*
  (lesson/story completion) — never on placement itself. Immediately after
  either onboarding or a reprobe, a strand's stored confidence is whatever
  it was before (`null` for a brand-new child). This is the concrete gap
  §5 below closes.

---

## 2. What difficulty should mean for a Persian-reading child

**Word length is measuring the wrong thing, and the codebase's own comments
already half-admit it.** `placement.ts:51` calls the current heuristic
"stage + word length... until pilot data calibrates `content_items`" —
i.e. it was always meant to be temporary.

Why length is a bad proxy specifically for Persian: Persian orthography is
written almost always **without diacritics (harakat)** in real content —
confirmed by the seed data itself (`گربه`, `سگ`, `اسب`… zero combining
vowel marks anywhere in `supabase/seed.sql`) — so a reader's difficulty
comes overwhelmingly from **which letter-forms appear and whether the
vowelling has to be inferred**, not from character count. Persian also
inflects/compounds freely (`بچه‌ها`, `مدرسه‌ام`) — a common, easy word can
be long; a short word can use a rare or visually-confusable letter and be
hard. Length correlates with neither.

**Candidate signals, checked against what's actually in this schema today:**

| Signal | Populated now? | Usable now? | What it captures |
|---|---|---|---|
| `words.stage` | ✅ yes, curated | ✅ **yes — and currently ignored by Q3/Q4** | Human-authored teach-order/curriculum difficulty. Already the app's primary difficulty axis everywhere *except* the probe. |
| `letters.group` / `order_in_group` | ✅ yes — 8 authored "shape similarity" groups (`project.md`: *"Alphabet grouped by shape similarity, not alphabetical order"*), e.g. ب/پ/ت/ث share a base glyph distinguished only by dot count/placement | ✅ **yes** | A genuine Persian-specific complexity signal: words built from letters in high-dot-ambiguity groups, or from letters taught late (high `order_in_group`), are harder to visually decode than word length alone suggests. |
| `content_items.frequency_rank` / `.difficulty` (mig-017) | ❌ no | ❌ not usable | The migration's own header says it plainly: *"ADDITIVE... nothing reads these tables yet."* No backfill or insert exists anywhere in the migrations. This is the aspirational IRT-calibrated table `placement.ts:51`'s comment is waiting for — not there yet. |
| Diacritics | ❌ no | ❌ not usable | Not a data gap that can be closed by reading differently — the `persian` text field itself carries no harakat in any seed word. Would require new authoring work, which is out of scope for "data we already have." |
| `child_word_progress` aggregate first-attempt accuracy | partially (grows with usage) | ⚠️ not yet — cold start | The best long-run signal (empirical, self-calibrating, exactly the direction `content_items.difficulty`'s "calibrated from pilot data" comment points to) but needs a minimum attempt count per word before it's trustworthy. Right for a later swap-in, not for this build. |

**Decision: composite difficulty = `stage` (primary) → letter-complexity
via the `letters.group`/`order_in_group` table (secondary) → word length
as a last-resort tiebreaker only, never the primary axis.** Concretely, a
word's complexity score is computed by mapping each character in
`words.persian` against `letters.character` and taking the max
`order_in_group` (or count of characters from multi-member confusable
groups) among letters it contains — a small, pure, testable function with
no new schema. This fixes a second real bug for free: sourcing Q3/Q4 from
the actual stage-2/3/4 pools instead of re-reading stage-1 words with a
length sort.

Flagged for later, not this build: swap in `child_word_progress` empirical
accuracy once per-word attempt counts are large enough to trust (a
threshold, same shape as the gate's own `k` knob).

---

## 3. Branching design (replacing count-correct-in-a-row)

**Decision: each of the 3 earnable strands (V, D, F) gets up to 2 items in
a one-step staircase — start at a middle-difficulty item, then branch
harder or easier — instead of one fixed item each; C stays a single
unbranched item, unchanged in kind from today.**

Why not a longer/general IRT-style staircase: with only 2–3 usable
difficulty tiers per strand available from real content pools (§2's
`stage` buckets), more than one branch step buys little extra resolution
and directly fights the item-count ceiling in §4. A 2-item staircase per
strand is the smallest change that actually earns the word "adaptive":

```
per strand (V, D, F):
  item 1 = a MID-tier word/letter for that strand (stage 2 of that strand's
           content, or the middle third by the §2 complexity score)
  if item 1 correct → item 2 = a HARD-tier item (higher stage/complexity)
  if item 1 incorrect → item 2 = an EASY-tier item (stage 1, low complexity)
  strand's probe-derived level =
    both correct  → 3
    mid correct, hard/easy branch missed → 2
    mid missed, easy branch correct      → 2
    both incorrect → 1
```

This directly fixes the "every strand caps at 2" flaw the existing test
suite already flags as unendorsed: a strand can now land on 1, 2, or 3 from
the probe alone (4 is intentionally reserved for what only sustained real
evidence should award — matches the prior/gate split's own philosophy that
placement is a *starting* estimate, not a ceiling).

C keeps its current shape (single hardest-available item, unbranched) —
per the re-placement doc's own reasoning, C has no recompute loop of its
own, so there's nothing for a second C item to feed into that a better V/D/F
branch doesn't already provide more value for.

Cross-strand order stays V→D→F→C (unchanged) — it's a reasonable warm-up
curve (vocabulary → decoding → reading) and there's no reason from this
review to disturb it.

---

## 4. How many items — the trade-off, not a silent number

**Decision: up to 7 items total (2 each for V/D/F + 1 for C), not a fixed
7 — a strand can resolve after 1 item in effect, since a placement is
"real" the moment its branch item lands, but the budget never exceeds 7.**

The trade-off, stated rather than hidden in a constant:

| Items | What it buys | What it costs |
|---|---|---|
| 4 (today) | Fast (~1 min), low fatigue | Binary per-strand resolution (1 or 2 only); no branching signal at all |
| 7 (proposed) | 3-way per-strand resolution (1/2/3) on V, D, F; still one pass at C | Roughly 1.5–2× the time of today; still short (a mid-probe branch item is the *only* new question type a child sees) |
| 10+ (e.g. 3-item staircases) | Finer resolution (up to 4-way per strand) | Real risk for a 4–7 year old: attention drops sharply past ~6–8 items in any single sitting for this age band, and a longer probe reads more like "a test" no matter how it's framed — directly working against §6 |

7 is chosen because the *marginal* value of a third item per strand is
small (going from 3-way to 4-way resolution) while the fatigue cost for
this age group is not small, and because it keeps the probe inside the
same rough time budget the current 4-item version already established as
acceptable (no complaints about probe length exist in the product history
reviewed for this doc — the complaints were about what it measures, not
how long it takes). This is marked as an unvalidated assumption (§7, A13)
like every other numeric knob in this codebase — tunable without a release
if pilot data says otherwise.

---

## 5. Feeding the decaying-prior model — what confidence a better probe earns

**The gap found in §1 is the crux of this section: placement currently
writes zero confidence, and there is no stored `n` counter to give a
"probe head start" to — `n` (`strands.ts:interactionCounts`) is computed
live from real evidence tables (`child_word_progress`,
`child_lesson_progress`) every recompute. It cannot be pre-seeded by a
write at placement time; there's nothing to write to.**

**Decision: treat each administered probe item as exactly what it is — one
real scored interaction — and fold it into the *same* `w(n) = k/(k+n)`
formula `gate.ts` already uses, using `n_probe` = the number of items
actually resolved for that strand this probe (0, 1, or 2 under §3's
design).** Write `confidence = 1 - w(n_probe)` to `child_strand_levels`
alongside `prior_level` on both `POST /result` and the reprobe result
route, using a small helper that reuses `gate.ts`'s `w(n)` rather than
re-deriving the formula.

Why this is honest rather than a shortcut: `n` elsewhere in this codebase
already means "count of scored interactions in the strand," not
specifically "lesson interactions" — a probe item that Simorgh scores
right there in the moment is the same *kind* of evidence, just far less
of it. Concretely at the default `k=8`:

| `n_probe` (items resolved this probe) | `w(n)` | confidence |
|---|---|---|
| 0 (strand skipped — insufficient content) | 1.00 | 0.00 |
| 1 (one branch item resolved, current 4-Q shape) | 0.89 | **0.11** |
| 2 (both staircase steps resolved, §3's design) | 0.80 | **0.20** |

A 2-item branch earns roughly double the confidence of today's 1-item
question (0.20 vs. 0.11) — a real, inspectable, admin-only number, not a
cosmetic change — while staying far below what genuine practice earns
(`n` climbs into the dozens after real lessons, driving `w` toward 0). That
asymmetry is intentional and matches the existing model's own philosophy:
a smarter 7-item probe should never claim to know as much as weeks of
real reading, only more than a 4-item one did. The very next real
recompute (first lesson/story completion) uses the *actual* `interactionCounts`,
independent of `n_probe` — so probe-earned confidence is a bridge that
fills the gap between placement and first real evidence, then is
naturally superseded, never double-counted.

C gets the same formula applied for consistency/display, but — as in the
re-placement doc — nothing currently *consumes* C's confidence (no
recompute loop reads it), so this is bookkeeping, not a functional change
for that strand.

---

## 6. What a child experiences

**Same rule as the frustration loop (`frustration.ts`): the system reacts
to the signal, the child never sees a verdict — and per your instruction,
the existing framing is right and stays untouched:**

```
"سلام {name}! من سیمرغم 🌟"
"بیا با هم یک بازی کوچولو کنیم تا ببینم چی بلدی — امتحان نیست، فقط بازیه!"
```
(*"Hi {name}! I'm Simorgh! Let's play a little game together so I can see
what you know — it's not a test, just a game!"*) — kept verbatim.

What changes with branching, and why each change protects the same
no-fail feeling rather than risking it:

- **Total item count becomes fixed at up to 7, not variable-stop-on-miss.**
  Today's "probe ends abruptly after your first wrong answer" is closer to
  a game-over feeling than a fixed-length game is — a branch to an easier
  item is visibly still *forward motion* ("here's a different question"),
  never a stop.
- **The existing per-item feedback carries over unchanged**: `آفرین! 🌟`
  on correct, `اشکالی نداره 💛` ("no worries") on incorrect — this is
  already exactly the tone the branch step needs, no new copy required. A
  branch to an easier item after a miss gets the *same* warm feedback a
  same-difficulty miss would, with no separate "here's an easier one"
  framing that would out itself as a demotion.
- **No difficulty tier, question number, or "X of 7" counter is ever shown**
  — matches the existing screen's total absence of scorekeeping mid-probe.
  A simple, non-numeric progress affordance (e.g. Simorgh's existing
  animation beats, or a soft dot-progress bar with no numbers) is fine if
  wanted, but nothing that reveals branch direction.
- **The onboarding "done" screen's one-time level-name reveal is
  unaffected** — still a first-time welcome moment, still never shown on
  reprobe, unchanged from current behavior/design intent.

---

## 7. Runtime config & unvalidated assumptions (extends rebuild-doc §7 / re-placement-doc §6)

Same discipline as `gate.ts`/`frustration.ts`: every number below ships as
a `DEFAULT_*` export, overridable from env at call time, logged so it can
be evaluated against real data rather than re-guessed.

| # | Assumption | Current value | What would falsify it | Adjust via |
|---|---|---|---|---|
| A13 | 7 items (2×V/D/F + 1×C) is the right ceiling for a 4–7 year old in one sitting | `PLACEMENT_MAX_ITEMS = 7` | Completion-rate drop-off concentrated in the back half of the probe in pilot telemetry (kids bailing before Q6/Q7) | runtime config |
| A14 | A one-step (mid→easy/hard) staircase gives enough resolution to be worth the extra item per strand | 2 items/strand max | Post-placement gate recomputes routinely move a strand 2+ levels within the first few lessons (probe read was no better than the old 1-item version) | runtime config / revisit §3 |
| A15 | `stage` + `letters.group`-derived complexity is a better difficulty ranking than word length for this content | composite score, §2 | Empirical per-word accuracy (`child_word_progress`) at pilot scale disagrees with the ranking more often than word length would have | swap in empirical accuracy per §2's flagged follow-up |
| A16 | Treating a probe item as one unit of `n` (via `w(n)`) is the right confidence contribution — not too strong, not negligible | `n_probe` ∈ {0,1,2}, same `k` as `gate.ts` | `gate_recompute_log` shows placement-derived confidence swinging early gate decisions more than real evidence should (too strong), or shows no measurable difference between reprobes with 1 vs 2 resolved items (too weak to matter) | runtime config (a separate `k` for probe-derived confidence, if `gate.ts`'s `k` turns out wrong for this purpose) |

None of these block a correct build — they gate tuning, exactly as the
prior docs' tables do.

---

## 8. Build plan (once this design is confirmed)

- **Pure logic module** (new, e.g. `apps/backend/src/lib/probe.ts` or
  extend `packages/shared/src/placement.ts` — leaning toward a new pure
  module since branching needs a difficulty-scoring function, item
  selection, and the new scoring shape, which is more than the current
  29-line `placement.ts` should grow to hold inline): word/letter
  difficulty scoring (§2), staircase item selection (§3), and the new
  `scorePlacement`-equivalent that returns `{ level: 1-3 per strand,
  n_probe per strand }` — no DB, no env access, matching `gate.ts`/
  `frustration.ts`'s pattern exactly.
- **Route layer** (`placement.ts`): sources items from the real
  stage/complexity-ranked pools instead of the flat stage-1 pool; reads
  `PLACEMENT_MAX_ITEMS` and any other new knobs from env with
  `DEFAULT_*` fallback; writes `confidence` alongside `prior_level` using
  §5's formula.
- **Client** (`apps/web/.../placement/page.tsx`, mirrored in
  `apps/mobile/app/placement.tsx`): branch-aware question flow (request
  the next item only after scoring the previous one, since the next
  item now depends on the answer); no UI changes to feedback copy per §6.
- **Re-placement**: no route changes beyond what placement.ts already
  gets — it already reuses the same probe end-to-end per its own design
  doc, so a better probe there is inherited for free once `mode=reprobe`
  keeps running all items (unchanged — no early-stop either way,
  branching isn't early-stop).
- **Tests**: pure-module tests for difficulty scoring (letters-group
  mapping, stage-priority, length-as-tiebreaker-only) and the staircase
  scoring function (all 2×2×2 branch outcomes per strand, boundary cases
  for missing content), mirroring `gate.test.ts`'s and
  `placement.test.ts`'s existing style — including keeping (and updating)
  the existing characterization tests that currently assert the
  strand-caps-at-2 behavior this design deliberately changes.
