# Re-placement Flow — Design Plan

**Status:** proposal → implemented this change (design + build, one pass, per
request). Builds directly on `docs/placement-progression-rebuild.md` (the
gate/prior rebuild) — read that first; this doc assumes its vocabulary
(gate, prior, `demonstrated_X`, `w(n)`, decision i/ii) without re-deriving it.

**Prompted by:** the gate self-corrects continuously from mastery evidence
(`promoteStrands`, triggered on every lesson/story completion) — but only for
strands a child actually *practises*. A strand a child avoids never
accumulates evidence, so its prior never decays (`n` stays low → `w` stays
≈1 forever) and its gate can sit on a stale onboarding guess indefinitely.
Re-placement's job is narrow and specific: **refresh the prior for strands
where organic evidence isn't arriving on its own**, and give the decaying-
prior model a fresh reading after a long absence (summer break, a child who
learned to read at school in the meantime). It is a top-up for the recompute
loop, not a replacement for it.

---

## 1. How it's triggered

**Decision: elapsed time since last placement (initial or previous
re-placement), checked opportunistically at next app open — not a push, not
a milestone.**

Two alternatives considered and rejected:

- **Progress milestone** (e.g. "every N lessons completed") — rejected
  because it's redundant with what already happens. A child hitting lesson
  milestones is by definition generating `n` and self-correcting via
  `promoteStrands` on every one of those completions. Milestone-gating a
  re-placement on the strand that's *already* getting continuous evidence
  adds nothing. And it structurally can't fire for the actual target case —
  a neglected strand — because neglect means no milestones fire for it
  either.
- **Fixed calendar cadence pushed to the child** (e.g. a notification every
  8 weeks) — rejected because it introduces a "the app is checking on you"
  cadence that works against the no-test framing (§2), and this app has no
  push infra to build for a first pass.

**What's decided instead:** a pure elapsed-time check, evaluated lazily —
the same "next login" pattern the progression-rebuild migration itself uses
(design doc §4.2) rather than new scheduling infrastructure:

```
due = (now − last_placement_history.taken_at) ≥ intervalDays(child_id)
```

- **Base interval: 63 days (9 weeks)** — the midpoint of the requested
  8–12 week window. `PLACEMENT_REPROBE_INTERVAL_DAYS`, unvalidated (§6, A10).
- **Per-child jitter (±14 days, deterministic from `child_id`)** — so the
  whole cohort doesn't become "due" in the same week if many children were
  placed around the same product launch date. Deterministic (a hash of the
  UUID, not `Math.random()`) so the same child always gets the same offset
  and the due-check stays a pure, testable function.
- Checked via a lightweight `GET /api/placement/:child_id/reprobe-due`
  the client calls once per session (home-screen load), not a poll.

**Why opportunistic-lazy rather than server-scheduled:** there is no
existing job runner in this codebase for per-child scheduled work (the
weekly digest is the one cron-shaped job, and it's a batch send, not a
per-child gate). A pure "is it due" function evaluated at natural session
start reuses that pattern exactly and needs no new infrastructure.

---

## 2. What a child actually experiences

**Must not feel like a test — same principle as the frustration loop's
silent easing (`frustration.ts`): the *system* reacts to the signal, the
*child* never sees a verdict.**

The existing onboarding placement screen (`apps/mobile/app/placement.tsx`)
already gets partway there (Simorgh, "امتحان نیست، فقط بازیه!" — "not a
test, just a game!") but has two properties that are fine for a one-time
"where do we start" onboarding moment and wrong for a recurring check-in:

| Onboarding behaviour | Why it's wrong for re-placement |
|---|---|
| **Stops at the first miss** | An early miss on the harder repeat run would end the activity abruptly — reads exactly like "you failed, game over," the one thing this must not feel like. |
| **Reveals `LEVEL_LABELS[finalLevel]`** at the end ("از اینجا شروع می‌کنیم: خواننده‌ی کوچک") | Appropriate once, as a welcome. Recurring, it becomes a scorecard the child starts anticipating — and per decision (ii), a re-placement's *effect* can legitimately be a silent downward gate move; showing a label risks surfacing exactly the "you got worse" signal the whole gate/trophy split exists to prevent. |
| **Separate full-screen route, navigated to explicitly** | Framed as a distinct "thing that happens to you," not "another activity." |

**Re-placement reuses the same four-item probe content and question UI**
(no new content pipeline — same `GET /api/placement/probe`) but changes
three things, all in the client:

1. **Runs all 4 items regardless of misses.** No adaptive stop. A miss gets
   the same warm, low-stakes feedback the existing screen already shows
   for a wrong answer mid-probe ("اشکالی نداره" 💛) — never a "you failed"
   state.
2. **No result reveal.** The closing beat is generic and celebratory
   regardless of outcome — a "خیلی خوب بود!" + sticker/confetti beat that
   would look identical whether every answer was right or every answer was
   wrong. No level name, no strand names, nothing numeric.
3. **Entry point is a game card, not a forced interstitial.** When
   `reprobe-due` is true, the home screen's activity rotation includes one
   extra card alongside the existing games/lessons — same visual weight as
   any other activity, with its own flavor label (e.g. "بازی سیمرغ" — "the
   Simorgh game") rather than "ارزیابی" (assessment) or any placement-
   adjacent wording. Skippable and reappears next session if skipped — never
   blocks lessons, stories, or other games. `reprobe-due` never expires or
   accumulates urgency; it's just "available," like any other activity.

This is implemented as a `mode=reprobe` variant of the existing placement
screen (same component, ~30 lines of conditional behaviour) rather than a
new screen, so the two flows can't drift apart on the parts that must stay
identical (question rendering, audio, choice UI).

---

## 3. Feeding `placement_history` without disturbing the gate/prior model

**The one rule that matters: re-placement writes the PRIOR, never the
GATE — and lets the existing damped recompute (`gate.ts`) do the blending.
It must not reuse the onboarding route's write path, which writes the gate
directly (correct only because a fresh child has no gate yet to disturb).**

Concretely, for a reprobe result `{ level, strands: {V, D, F, C} }`:

| Strand | What re-placement writes | Why |
|---|---|---|
| **V, D, F** (earnable — gate.ts `EARNABLE`) | `child_strand_levels.prior_level` **only**. `level` / `source` are left untouched. | These strands are governed by continuous recompute. Writing `level` directly would bypass `dampGate`'s asymmetric cap (§6.4 of the rebuild doc) — exactly the "one bad test result can tank a child" failure mode the decaying-prior model exists to prevent. Writing only the prior lets a fresh probe reading re-enter through the *same* damped, idempotent pipeline every lesson/story completion already uses. |
| **C** (placement-only, never earned — `gate.ts` excludes it from `EARNABLE`) | `level` **and** `prior_level` directly, `source='placement'` — same shape as onboarding. | `C` has no recompute loop of its own (nothing "earns" comprehension the way V/D/F earn their gate from mastered content). Placement — initial or repeat — is its *only* update mechanism, so a direct write here isn't bypassing anything; there is nothing to bypass. |
| **P** | untouched | Already never set by placement at all (`resultSchema` has no `P` key) — pre-existing behaviour, unrelated to this change. |
| **`children.level`** (coarse, non-literacy knob) | overwritten directly, same as onboarding | Per the rebuild doc §1.2/§3.2, this field has no decay model — it's a flat placement-set knob for math/memory/AI, deliberately decoupled from the gate. Placement (including re-placement) is its sanctioned, only update path. Not child/parent-visible (inventory table, rebuild doc §1.3), so no regression-visibility concern. |

**After writing priors, the route calls `promoteStrands(childId, 'reprobe')`**
— the *exact* function `progress.ts` already calls after every lesson/story
completion, just with a different `trigger` label for the audit trail. This
is the crux of "not overriding the model": re-placement doesn't compute a
gate. It supplies one new input (a refreshed prior) to the same pure
`recomputeGates` function everything else feeds, which then:

- blends the new prior with `demonstrated_X` using the *unchanged* `w(n)` —
  so if `n` is already large (the strand *was* getting organic evidence
  despite a re-placement firing, e.g. it fired for a genuinely-neglected `D`
  while `V`/`F` were active), the fresh `V`/`F` priors are correctly
  near-inert. Re-placement can't override real evidence; it can only matter
  where evidence is thin — precisely the intended case.
- applies the **same downward damping** as any other recompute — a
  surprising probe result (bad day, lucky guess) can move the gate at most
  `maxDownPerRecompute` levels immediately, not instantly overwrite it.
- returns `Promotion[]` — upward moves only, surfaced as the same silent
  "content unlocked" signal lesson/story completion already produces. A
  downward move (or no move) is invisible, exactly as designed.

**No `n`-reset is needed or wanted.** `n` (§3 of the rebuild doc) is a
cumulative "how much real evidence exists" counter with no notion of
"since last placement" — it only grows when real interactions happen. A
neglected strand has low `n` for the honest reason that it's neglected; that
low `n` is *exactly* why its prior weight stays high and a refreshed prior
matters there. A well-practised strand has high `n`, so its prior weight is
already low and a refreshed prior is correctly near-inert. The two
behaviours the feature needs — "matter where evidence is thin, be inert
where it isn't" — fall out of the existing `w(n) = k/(k+n)` model with zero
new state. Introducing an artificial per-placement `n` reset would be the
actual way to "disturb the model": it would let a single 4-item repeat probe
suddenly outweigh months of real reps, which is the one thing decision (ii)
and the damping cap exist to prevent.

**`placement_history` gets a `kind` column** (`'onboarding' | 'reprobe' |
'migration'`, migration 054) so a reprobe snapshot is distinguishable from
the original onboarding snapshot and the one-time rebuild-migration
snapshot. Every reprobe still appends a row — the append-only trajectory is
what §4's `literacy_gain` fix (below) and future pedagogy review need.

---

## 4. What `literacy_gain` shows, and whether the calculation is right

**It is not right today, independent of re-placement, and re-placement makes
the existing wrongness materially worse if left as-is.**

Today (`routes/admin.ts`, pilot-metrics):

```
gain = placement_history.level[latest] − placement_history.level[first]
```

Two problems, one pre-existing and one new:

1. **Pre-existing:** `placement_history.level` is the *coarse placement
   probe's* level — a raw 4-item read, not the evidence-recomputed gate.
   Even today, with usually exactly one or two snapshots per child
   (onboarding + the one-time rebuild-migration tag), "gain" is really
   "did the probe roll differently the second time" — not a mastery signal.
   The rebuild doc already flagged this destination directly: *"pilot
   literacy-gain … gate snapshot … gain measured on the gate — the real
   signal"* (§1.3) — noted as a follow-up, not yet done.
2. **New, from re-placement:** once re-placement appends a snapshot every
   ~9 weeks, `latest − first` starts comparing two **independent 4-item
   probe rolls**, each capped at strand-level 2 regardless of true ability
   (`scorePlacement` — a passed item lifts a strand to 2, never higher;
   `placement.test.ts` already documents this as a characterized, not
   endorsed, behaviour). A late reprobe rolling one item differently than
   the first would swing "measured gain" by a full level from pure item
   luck, for a metric meant to demonstrate the product's efficacy to a
   pilot cohort. This is the exact failure mode decision (ii) and the
   decaying prior exist to keep OUT of the gate — but the admin metric
   currently bypasses all of that by reading the raw probe snapshots
   directly.

**Fix implemented alongside this change:** `literacy_gain` now reads
`gate_recompute_log` — the evidence-driven trajectory the rebuild doc's
instrumentation (§3.3) already logs on every lesson/story completion *and*
now every re-placement — instead of `placement_history`:

```
entry_X  = gate_before of the EARLIEST gate_recompute_log row for strand X
current_X = gate_after of the LATEST gate_recompute_log row for strand X
gain = mean over {V, D, F} of (current_X − entry_X)
```

restricted to children with at least one `gate_recompute_log` row (i.e. at
least one recompute has ever run — equivalent in spirit to the old "≥2
snapshots" gate, but on the real signal). `placement_history` keeps its
existing job — the audit trail of what each probe/reprobe actually read,
and the input to `prior_level` — but stops being the source for a metric
that is supposed to measure demonstrated ability. This also means
`literacy_gain` no longer needs re-placement to fire at all to be
meaningful — mid-cadence lesson/story completions already produce
recompute rows; re-placement's contribution to the trajectory is just one
more (evidence-weighted, damped) point among many, not a special one.

---

## 5. Flag: does the probe need a rebuild first?

**No — ship re-placement now; the probe rebuild stays a separate, later
effort (this reconfirms rebuild doc §6.5, extended to the repeat case).**

The concern (repeating a crude test makes a crude test worse) would be true
under a *floor* model — a bad repeat reading would trap the child exactly
like the original one-way ratchet did. It is not true under the
**decaying-prior model this now runs on**, for three compounding reasons
specific to re-placement:

1. **Every reprobe result is damped, not authoritative**, per §3 above — it
   enters through the same `dampGate` cap as any other recompute. A wrong
   reading swings the gate by at most one level immediately, in either
   direction, and only in strands where `n` is already low.
2. **It's structurally inert exactly where it would do the most harm.** A
   strand with substantial real evidence (high `n`, low `w`) is the strand
   where a wrong probe reading would be most damaging if trusted — and it's
   precisely the strand where the model gives the reprobe result the least
   weight. The failure mode "one bad repeat test derails a child who was
   doing fine" requires the model to trust the test over the evidence, which
   `w(n)` structurally refuses to do.
3. **The probe's own ceiling limits the blast radius further.**
   `scorePlacement` caps every strand's probe-derived value at level 2
   (never 3 or 4) regardless of streak length (`placement.test.ts`) — so a
   reprobe can only ever nudge a `V`/`D`/`F` prior between 1 and 2. Combined
   with (1) and (2), the realistic worst case of a bad reprobe roll is a
   temporary, damped, one-level nudge on a strand that wasn't getting real
   evidence anyway — not a new ratchet, not a trap.

The probe is still a genuinely weak instrument and rebuilding it (better
item bank, real difficulty calibration instead of "stage + word length"
heuristics, more than one item per strand) remains worthwhile — but its
weakness is now a **quality-of-signal** issue that self-corrects, not a
**safety** issue that compounds under repetition. Sequencing it after this
ships is the same call the rebuild doc already made for the exact same
reason (§6.5); re-placement doesn't change that trade-off, it just puts
that reasoning through one more cycle. Recorded as a fresh table row below.

---

## 6. Runtime config & unvalidated assumptions (extends rebuild doc §7)

Same treatment as `gate.ts`: every number below is read from env at call
time with a documented default, never baked in, and logged so it can be
evaluated against real trajectories rather than re-guessed.

| # | Assumption | Current value | What would falsify it | Adjust via |
|---|---|---|---|---|
| A10 | 9-week base interval is the right re-placement cadence | `PLACEMENT_REPROBE_INTERVAL_DAYS = 63` | `gate_recompute_log` shows strands sitting on a stale prior for much longer than 9 weeks before organic evidence arrives (interval too long), or reprobe results arrive while `n` is already high enough that they're consistently inert (interval could be longer / cadence doesn't matter) | runtime config |
| A11 | ±14-day deterministic jitter is enough to avoid cohort-wide "due" clustering | `PLACEMENT_REPROBE_JITTER_DAYS = 14` | A pilot cohort placed in a tight launch window shows a visible spike in reprobe-served sessions on the same days | runtime config |
| A12 | A skippable, non-urgent game-card entry point gets enough completion to be useful | no forced surfacing, no expiry | Reprobe completion rate is too low across a pilot cohort to produce useful `gate_recompute_log` density | UX change (surfacing strength), not covered by this build |

None of these block a correct build — they gate *tuning*, exactly as the
rebuild doc's A1–A9 do, and read from the same instrumentation
(`gate_recompute_log`, now also carrying `trigger='reprobe'` rows).
