# Placement & Progression Rebuild — Design Plan

**Status:** proposal (design only — no code changed). Supersedes the promotion
logic in `apps/backend/src/lib/promotion.ts` / `strands.ts` and the placement
result handling in `apps/backend/src/routes/placement.ts`.
**Owner:** learning system (§11.1)
**Prompted by:** BUG-C (promotion ratchets a strand to the cap on unchanged thin
content) + the placement probe being a 4-item toy that pins all-correct to the
cap. Two independent paths to a child landing in content well above their
ability — the frustration/churn risk the pedagogy review named as the biggest
engagement threat for ages 3–12. This is a **live pedagogy defect**, not feature
work.

**Decisions already locked by product (do not re-litigate here):**
- **(i)** `F` (Fluency) means *reading skill*, not gate position. Once trophy and
  gate are split, the signal must track actual ability — never suppressed just
  because `C` already unlocked the content.
- **(ii)** Silent gate recompute, trophy grandfathered — **and the gate must move
  both directions.** A child whose early interactions show they're stronger than
  their placement must have the gate rise silently too, or we've replaced one
  one-way ratchet with another.

> **Honest note on the approach shift.** The prior sketch recommended "Option A"
> (promote only when higher content exists) as primary because it needs no schema
> change. Engaging decisions (i) and (ii) shows pure Option A is *wrong*: its
> headroom guard would suppress `F` whenever `C` already unlocked the stories
> (violating (i)), and its incremental-promote shape is one-directional
> (violating (ii)). The design below lands on an **evidence-recompute** model —
> the gate is a deterministic function of current mastery evidence, recomputed
> rather than incrementally promoted. It is idempotent by construction (BUG-C
> dies), naturally bidirectional (ii), and lets `F` be decoupled from `C` (i).
> It still needs essentially no new schema, because the evidence it reads
> already exists.

---

## 1. The trophy / gate split

### 1.1 What exists today (three conflated "levels")

An audit of every read of "level" across backend, web, mobile, and admin found
**three distinct concepts** wearing the same word:

| Concept | Stored in | Range | Visible to |
|---|---|---|---|
| **XP rank** | `children.xp` → `resolveLevel()` | شاگرد → استاد (4 named tiers) | **child + parent** |
| **Coarse level** | `children.level` | 1–4 | **admin only** ("مرحله") |
| **Strand levels** | `child_strand_levels` (P/D/V/F/C) | 1–4 each | **nobody** (invisible gating machinery) |

**The load-bearing finding:** the child- and parent-visible sense of progress is
*already* XP-based (`child/home/page.tsx:210` shows `🎓 {resolveLevel(xp).label}`;
`parent/dashboard/page.tsx:149` shows `سطح: {lvl.label}` from XP). Strand levels —
the thing this rebuild changes — are **read by no child- or parent-facing
surface**. They only drive content gating and promotion. So the trophy/gate split
is largely *already true* on the presentation layer; the rebuild formalizes it and
fixes the gate's math **without touching anything the child or parent sees.**

### 1.2 The split, defined

- **Gate** — a per-strand *content-serving* level: "what difficulty do we serve for
  strand X." This is what `child_strand_levels` **becomes, purely.** Silent,
  bidirectional, driven by placement prior + mastery evidence (§2–3). Never shown
  as an achievement to child or parent.
- **Trophy** — the child-visible sense of progress. **Stays exactly as-is:** XP
  rank (child home badge, parent dashboard) + the parent's per-word mastery
  buckets. Monotonic, celebratory, never derived from the gate. The rebuild adds
  **no new visible trophy** — it keeps XP and simply guarantees the (invisible)
  gate can move freely, including down, without any number regressing.

`children.level` (the coarse 1–4) is the awkward middle: not a gate (gating is
delegated to strands), not the trophy (that's XP), yet still read by several
difficulty tuners — some literacy (AI story generation, character persona) and
**some not** (math grid, memory game). An earlier draft demoted it to a cache
recomputed from the gate strands. **Decision (§6.2): do not.** Recomputing it from
V/D/F would couple *numeracy* difficulty to *reading* ability, which systematically
mis-serves the common heritage-learner profile of strong-at-math /
still-learning-to-read. So `children.level` **stays exactly as it is today** — a
placement-set coarse level, decoupled from the gate, untouched by recompute. It
cannot ratchet (it only changes at placement), so it needs no fix here; it is
simply *not the gate*. Whether literacy consumers (AI/character) should eventually
track the gate instead is a separate, deferred refinement — not done here, so that
this rebuild makes nothing worse on the way past. "Own numeracy track" is recorded
as a known roadmap gap (§6.2).

### 1.3 Explicit inventory — every current read of "level", and where it points after

| Read site (file) | Reads today | New source | Notes |
|---|---|---|---|
| content gating — `child/home`, `child/lesson` (web) + `home` (mobile) | `strand_levels` via `/api/placement/:id` | **gate** (same storage, same endpoint) | the core gate consumer; unlock rules unchanged |
| promotion — `lib/strands.ts` | `children.level` fallback + strand rows | **gate recompute** (§2) | predicate replaced |
| placement result — `routes/placement.ts` | writes `children.level` + strand rows | writes **prior** + triggers gate recompute (§3) | |
| AI story generation — `routes/ai.ts`, `lib/ai/index.ts` | `children.level` | **`children.level` (unchanged)** | placement coarse level, as today; gate-tracking deferred (§6.2) |
| character persona — `routes/characters.ts` ("سطح X از ۴") | `children.level` | **`children.level` (unchanged)** | flavor text; as today |
| math difficulty — `web/lib/persianMath.ts` | `children.level` | **`children.level` (unchanged)** | non-literacy — must NOT couple to V/D/F (§6.2) |
| memory game — `child/games/memory` | `children.level` | **`children.level` (unchanged)** | non-literacy — must NOT couple to V/D/F (§6.2) |
| admin child detail — `admin/.../users/[id]`, `routes/adminUsers.ts` | `children.level` ("مرحله") | **gate strands + confidence** | admin should see the real per-strand gate, not the coarse cache |
| pilot literacy-gain — `routes/admin.ts` + `placement_history` | `placement_history.level` | gate snapshot (§4/§5) | gain measured on the gate — the real signal |
| child home XP badge — `child/home:210` | `children.xp` | **unchanged** | the trophy |
| parent dashboard "سطح" — `parent/dashboard:149` | `children.xp` | **unchanged** | the trophy |
| parent progress mastery buckets — `parent/progress` | `child_word_progress.mastery` | **unchanged** | not a level read at all |

---

## 2. The gate recompute (replaces the promotion predicate)

Instead of incrementally *promoting* a strand (the shape that ratchets), the gate
is **recomputed from evidence** on each relevant event. For an earnable strand
`X ∈ {V, D, F}` (`P` and `C` are placement-only, never earned):

```
Gate_X = clamp(1, 4, round( w(n_X) · prior_X  +  (1 − w(n_X)) · demonstrated_X ))
```

- `prior_X` — the placement estimate for the strand (§3).
- `demonstrated_X` — the level the child's **mastery evidence** supports (§2.1).
- `w(n_X)` — the placement prior's weight, decaying with evidence count (§3).

Because `Gate_X` is a deterministic function of *current* evidence, recomputing it
twice with unchanged evidence yields the same value — **idempotent by
construction. BUG-C cannot occur.** And because `demonstrated_X` falls when
evidence weakens as readily as it rises, the gate is **bidirectional** (decision ii).

### 2.1 `demonstrated_X` from the content graph

The content graph today:
- **Lessons** `{type, stage}` → strand via `lessonStrand(type)` (`vocabulary→V`,
  `phonics/alphabet→D`). Unlock rule: `lv[X] ≥ stage − 1` (a stage-`S` lesson
  needs level `S−1`).
- **Stories** `{stage}`. Unlock rule: `max(F, C) ≥ stage − 2` (stories open a stage
  earlier — audio-supported, input-rich, per §11.1).

Define a **stage `S` is *cleared* for strand `X`** when the child has *mastered*
≥ `ceil(0.85 × |content of strand X at stage S|)` of it (mastery, not mere
completion — §2.2). Then:

```
demonstrated_X = 1 + (length of the contiguous run of cleared stages,
                      starting from the lowest stage that exists for X)
```

Worked cases (these are the BUG-C scenarios, now correct):

| Content for X | Mastered | `demonstrated_X` | vs today |
|---|---|---|---|
| only stage 2 (20 items) | all 20 | `1 + 1 = 2`, **stays 2 on every recompute** | today ratchets 2→3→4 |
| stages 2,3,4,5 | all | `1 + 4 = 5` → clamp **4** | reaches cap correctly |
| stages 2,3; stage-3 not mastered | stage 2 only | `1 + 1 = 2` | halts at real edge |
| nothing mastered | — | `1 + 0 = 1` | floor |

**"Content that requires level ≥ L+1" (the old headroom question) is now
implicit:** you cannot have *cleared* a stage that does not exist, so
`demonstrated_X` simply cannot climb past the highest stage of content present.
A strand with no higher content **sits** at its demonstrated level. That state is
visible to **admin** (per-strand gate on the child detail page) and to **nobody
else** — which is correct: "you've cleared everything we have" is an inventory
fact, not a child-facing wall.

### 2.2 `F` is decoupled from `C` (decision i)

Story *unlocking* keeps `max(F, C)` — `C` (comprehension, from placement) may still
open stories ahead of `F`, because audio-supported stories are input-rich and
appropriate before independent fluency (§11.1). That is **gate position**.

But `demonstrated_F` is computed **only from stories the child has actually
mastered**, with **no reference to `C`.** So:
- `F` **rises with reading** as the child masters stories — the skill signal is
  honest (decision i).
- `F` is **never suppressed** because `C` unlocked the content — the two are
  independent inputs.
- `C`'s head-start on *opening* stories is preserved.

This is the precise reconciliation decision (i) demanded: `max(F,C)` governs *what
is available*; `F` alone reflects *demonstrated reading*.

### 2.3 Mastery, not completion (§11.1: "you cannot click through")

Today promotion counts `child_lesson_progress.completed` / `child_story_progress.
completed`. §11.1 says unlock must be **mastery-driven**. The rebuild defines
content mastery from data that already exists in `child_word_progress.mastery`:

- **Lesson mastered** = ≥85% of its words are receptively `mastered`/`consolidated`.
- **Story mastered** = completed **and** its target words receptively mastered.

No new schema — a new join over existing mastery columns. The exact thresholds and
whether productive mastery contributes are pedagogy knobs (§6.1). **Behavior-change
flag:** some children have *completed* content they have not *mastered*; their gate
under this rule can be **lower** than their old completion-based level. That is
correct per §11.1 but must be stated (it's part of why the migration in §4 can move
some gates down).

---

## 3. Placement as a decaying prior

Placement stops being a **floor that promotion can never walk back**. It becomes a
**prior**: an initial estimate whose influence decays as real evidence accrues.

- `prior_X` — set once from the placement probe result (the current
  `POST /api/placement/result`), stored in `child_strand_levels` with
  `source='placement'`. Not overwritten by recompute (recompute writes the *gate*;
  the prior is retained separately — see §3.2 storage).
- `n_X` — count of **scored interactions** in strand `X` since placement (reps with
  a correct/incorrect outcome). Derivable today from `child_word_progress` rows /
  review outcomes for the strand's content.
- `w(n)` — prior weight, decaying:

```
w(n) = k / (k + n)          with k = 8 (proposed; per-strand)
```

| `n_X` (scored reps) | `w` (prior weight) | gate is… |
|---|---|---|
| 0 (fresh placement) | 1.00 | **entirely placement** — no cold-start whiplash |
| 4 (≈½ lesson) | 0.67 | placement-led, evidence pulling |
| 8 (≈1 lesson) | 0.50 | **parity** — prior and evidence equal |
| 24 (≈3 lessons) | 0.25 | evidence-led |
| 40 (≈5 lessons) | 0.17 | placement now minor |

**What the gate does in the meantime:** for the first interactions it tracks
placement (the child gets content at their placed level immediately); as evidence
accrues it slides toward demonstrated ability — **up or down**. A toy-probe
over-placement (level 4 from 4 lucky correct) with weak real performance slides
`4 → 2` silently over the first few lessons; an under-placement rises. Because
placement is now a decaying prior, **the probe being a toy matters far less** — a
bad prior self-corrects within a handful of lessons instead of trapping the child.
(Improving the probe is still worthwhile but is no longer load-bearing — §6.5.)

`k` is a pedagogy tuning knob (§6.3). Downward movement should be damped harder than
upward so one bad session can't tank a child's gate (§6.4).

### 3.1 Confidence, concretely

"Confidence" = `1 − w(n_X)`: how much the gate reflects the child's own demonstrated
evidence versus the placement guess. At `n=0` confidence is 0 (pure guess); it rises
monotonically toward 1. Surfaced to **admin only**, beside the per-strand gate, for
debugging ("V gate 2, confidence 0.75").

### 3.2 Storage

- **Gate:** reuse `child_strand_levels.level` (`source='auto'`), meaning changes from
  "auto-promoted level" to "recomputed gate."
- **Prior:** keep the `source='placement'` row as the retained prior. Recompute reads
  it, never clobbers it. (Alternative: a dedicated `prior_level` column — cleaner,
  one small migration. Recommended if we want prior + gate legible in one row.)
- **`n_X` / confidence:** computed on the fly at recompute time from existing
  interaction data. Optionally cached in a `confidence numeric` column for admin
  reads without recomputation. Optional.
- **Trophy:** nothing — XP stays in `children.xp`.
- **`children.level`:** **untouched** — stays the placement-set coarse level for its
  current consumers (AI, character, math, memory). Deliberately *not* derived from
  the gate, to keep numeracy difficulty decoupled from reading ability (§6.2).

Net new schema: **at most one or two optional columns** on `child_strand_levels`,
plus one instrumentation table (§3.3). The recompute reads evidence that already
exists.

### 3.3 Runtime config & instrumentation (decision 6.3)

`k` — and any other tuning number the pilot will revisit (§7) — is **not a source
constant.** It is read at recompute time from runtime config so it can change while
families use the app, with no release cycle:

- **Config source:** the existing settings mechanism — an ACM project variable
  (`PROGRESSION_PRIOR_K`) or a row in the `app_settings`/settings table, read with a
  safe default of `8` if unset. The recompute core stays pure (takes `k` as a
  parameter); only the calling route reads config and passes it in, so tests pin `k`
  explicitly and production stays tunable.
- **Same treatment for:** the mastery threshold (`0.85`, §2.1/§6.1) and the
  asymmetric downward-damping cap (§6.4). All three are config-read with documented
  defaults, so pilot tuning never needs a deploy.

**Instrumentation — what to log (so `k` is evaluated, not re-guessed).** Every gate
recompute appends one row to a `gate_recompute_log` table (append-only, never
mutated):

| Column | Meaning |
|---|---|
| `child_id`, `strand` | who / which strand |
| `at` | timestamp |
| `n` | scored-interaction count for the strand at recompute time |
| `prior` | the placement prior `prior_X` (constant per strand until re-placement) |
| `demonstrated` | evidence level `demonstrated_X` at this recompute |
| `w`, `k` | the weight applied and the `k` in force (so a later `k` change is legible in the trace) |
| `gate_before`, `gate_after` | gate value pre/post — **direction and magnitude of the move** |
| `damped` | bool — whether the asymmetric cap (§6.4) clipped a downward move |
| `trigger` | what caused it (word rep / lesson complete / migration / manual) |

This captures each child's **gate trajectory** — initial prior, the value across
the first ~20 reps per strand, and every recompute's direction/magnitude — which is
exactly what's needed to ask "did `k=8` self-correct over- and under-placements at
the right speed, or did it over/undershoot?" against real behavior. Retention:
pilot-scoped; can be pruned once tuning settles. Not surfaced to child/parent; admin
+ analytics only.

---

## 4. Retroactive migration

Per child, from current state:

- **Trophy** — nothing to migrate. XP rank is untouched; child and parent see the
  identical badge/level after deploy.
- **Prior** — the existing `child_strand_levels` `source='placement'` row (or
  `children.level` fallback for pre-placement children) becomes `prior_X`.
- **Gate** — recomputed from the new function using existing mastery/completion and
  interaction data. For a real user, `n_X` is large → `w` small → gate ≈
  demonstrated evidence → the *correct* level. For a child ratcheted to 4 on thin
  content, `demonstrated_X ≈ 2` with large `n_X` → **gate recomputes to ~2**. The
  migration therefore *silently corrects* the ratchet.

### 4.1 What a child/parent observes on first login after deploy

| Surface | Change? |
|---|---|
| Child home XP badge (`🎓 …`) | **none** |
| Parent dashboard "سطح" (XP) | **none** |
| Parent progress mastery buckets | **none** |
| Badges / rewards | **none** (mastery-gated on the same `mastery` data) |
| Child home / lesson list — *which content is unlocked* | **changes only for over-ratcheted children**, toward content they can actually do |

**Confirming the "ideally nothing" bar honestly:** for a **correctly-leveled
child, literally nothing changes.** For the **over-ratcheted cohort**, the set of
unlocked lessons/stories shifts *down to their real level* — **no visible number
regresses** (there is no child/parent-facing level number to regress; it's XP and
mastery, both untouched), and the change is *toward* appropriate content, which is
the entire fix. The only way to make it literally-nothing for that cohort too would
be to grandfather their gates — which would preserve the defect. So the honest
statement is: **no visible regression for anyone; content availability silently
corrects for the affected cohort, with no "you've been demoted" messaging.**

### 4.2 Migration safety

- Apply the first recompute at a **session boundary / next login**, and never lock
  content a child is mid-lesson in.
- Write a **`placement_history` snapshot** at migration (tagged, with the derived
  gate) so the §11.5 pilot literacy-gain metric stays consistent across the cutover
  rather than reading a discontinuity as a "gain."
- Downward damping (§6.4) applies to the migration too, or defer full downward
  correction across the first few post-deploy sessions to avoid a same-day content
  swing for heavily-ratcheted children.

---

## 5. Test strategy

All as **pure-function unit tests** on the recompute core — the extraction done this
session (`promotion.ts`, `placement.ts` as DB-free modules) is exactly the
groundwork; extend it into a `gate.ts` recompute module and test without a DB.

**BUG-C's pinned `todo` becomes a passing assertion:**
> `re-running with unchanged mastered content does not change the gate` — flips from
> `todo` (currently failing, documenting the ratchet) to a plain green idempotence
> test.

Properties to lock so it can't regress:

1. **Idempotence** — `recompute(recompute(s)) == recompute(s)` for fixed evidence.
   (kills the whole BUG-C class)
2. **Bidirectional (decision ii)** — stronger evidence raises the gate; weaker
   evidence lowers it. Explicit up **and** down cases.
3. **Prior decay (§3)** — `n=0` ⇒ gate == prior; large `n` ⇒ gate == demonstrated;
   `w` monotonically decreasing. Table-driven across the §3 rows.
4. **`F` ⟂ `C` (decision i)** — `demonstrated_F` is identical whether `C=1` or `C=4`
   given the same mastered stories. This is the decision-(i) regression guard.
5. **Headroom emerges** — thin content (only stage 2), however thoroughly mastered
   and however many recomputes, settles at gate 2. (the BUG-C scenario as a positive
   assertion)
6. **Bounds** — gate ∈ [1,4] always.
7. **Mastery ≠ completion (§2.3)** — content completed-but-not-mastered does not
   raise the gate.
8. **Toy-probe self-correction** — replaces the current *characterized* placement
   test: all-4-correct sets `prior=4`, and with weak evidence the gate self-corrects
   to demonstrated within `N` interactions. Turns previously-wrong behavior into a
   tested self-correction.
9. **Migration determinism** — a fixed pre-state fixture yields a deterministic gate,
   asserted for (a) a correctly-leveled child (unchanged) and (b) a ratcheted child
   (corrected down).

The 42 currently-green tests stay; `promotion.test.ts` is rewritten against the new
recompute; `leitner`/`wordProgress` tests are unaffected.

---

## 6. Judgment calls & open pedagogy questions

Six were parked. Three are now **decided** (6.1, 6.2, 6.4); three remain **open**
for a call before implementation (6.3, 6.5, 6.6).

**6.1 — Lesson/story "mastery" definition. ✅ DECIDED: mastery-gated, not
completion.** Promotion moves from *completed* → *mastered* (§2.3): lesson = ≥85%
words receptively mastered; story = completed + target words mastered. The cohort
effect (some children's gates drop because *completed ≠ mastered*) is accepted — it
is **the same correction as the ratchet fix**: children unlocked into unearned
content get moved to what they've actually demonstrated, silently, trophies
untouched. "Completed" meaning "clicked through" is precisely the loose signal that
let BUG-C cause harm. *(Threshold=85% and receptive-only both stand unless a later
pilot argues otherwise; not blocking.)*

**6.2 — `children.level` as a non-literacy difficulty knob. ✅ DECIDED: do NOT
couple math/memory to V/D/F.** A child who reads Persian slowly is not necessarily
weak at arithmetic — for heritage learners, strong-at-math / still-learning-to-read
is a common, expected profile, and literacy-as-proxy would systematically mis-serve
them. So `children.level` stays as today (placement coarse level) for math, memory,
and the literacy consumers alike; the gate lives only in `child_strand_levels`
(§1.2, §3.2). **"Own numeracy track" is recorded as a known roadmap gap** — not
built here, and this rebuild must not make the coupling worse on the way past.

**6.3 — Prior half-life `k`. ✅ DECIDED: build with `k=8`, provisional.** `k=8`
reps/strand (prior/evidence parity at ≈1 lesson, prior minor by ≈5 — §3 table) is a
starting value, **not a settled decision**. Two binding requirements follow from
that (both are design decisions, specified in §3.3):
- **(a) runtime-configurable** — `k` is a runtime setting (ACM variable / settings
  table), *not* a source constant, because pilot validation means changing it while
  families use the app, with no release cycle.
- **(b) instrumented** — log enough per-child gate-trajectory data that `k` can be
  evaluated against real behavior instead of guessed twice (§3.3). Blind tuning is
  not tuning. `k` and everything in its category are listed in §7 as explicitly
  unvalidated, so pilot data lands against a visible target.

**6.4 — Downward speed (decision ii). ✅ DECIDED: asymmetric damping.** Cap
per-session downward movement; let upward respond faster. A tired child at the end
of a session shouldn't lose earned ground, and one bad session on unfamiliar
content shouldn't read as regression. *(Exact cap — 1 level/session vs. requiring N
sustained sessions — folds into 6.3's tuning; the asymmetry itself is settled.)*

**6.5 — Probe priority. ✅ DECIDED: rebuild first, probe after.** The decaying prior
makes the probe no longer load-bearing (a bad 4-item guess washes out in a few
lessons), so probe rework is a comfort optimization sequenced *after* this rebuild,
which removes its ability to do lasting harm.

**6.6 — `C` opening stories ahead of `F`. ✅ DECIDED: keep `max(F,C)` for
unlocking.** Gate *position* stays `max(F,C)` — `C` (comprehension, audio-supported)
still opens stories a stage ahead of independent fluency per §11.1, while the `F`
*signal* reflects only mastered reading (decision i). Rationale confirmed by product:
the audio-supported head-start is what lets a pre-fluent heritage child reach stories
at all, and stories are the product's stated heart; gating on `F` alone would lock
out precisely the target learner.

---

## 7. Unvalidated assumptions

This rebuild is **structurally** sound — idempotence, bidirectionality, and the
trophy/gate split are provable and tested (§5). But several **numbers and shapes**
inside that structure are reasoned guesses, not values derived from observing real
children. They are listed here so that when pilot data arrives it is obvious which
knobs to turn, rather than having them buried in the code as if they were derived.
All are runtime-configurable or replaceable **without a schema change** unless noted.

| # | Assumption | Current value | What would falsify it | Adjust via |
|---|---|---|---|---|
| A1 | Prior half-life `k` correctly paces self-correction | `k = 8` reps/strand | Gate-trajectory logs (§3.3) show over/under-placements correcting too slowly (children stuck in wrong content) or too fast (jumpy gate on noise) | runtime config |
| A2 | 85% is the right mastery bar for clearing a stage | `0.85` | Children who clear at 85% still fail the next stage's content (bar too low), or stall despite real readiness (too high) | runtime config |
| A3 | Asymmetric damping cap protects "one bad day" without freezing real regressions | 1 level/session down (proposed) | Legit weakening takes too many sessions to reflect, or a cap of 1 still lets fatigue drop a gate visibly | runtime config |
| A4 | "Mastered" = ≥85% words receptively mastered captures lesson/story readiness | receptive-only | Productive-weak children read as "mastered" and then can't produce; or receptive mastery under-counts real ability | §6.1 definition change (code, no schema) |
| A5 | A decaying prior makes the 4-item probe good-enough | probe unchanged this rebuild | Trajectory logs show the first-few-lessons-too-hard window frustrates children badly enough to churn before self-correction | probe rework (§6.5, separate effort) |
| A6 | `demonstrated_X` from *contiguous* cleared stages models real progression | contiguous-run rule (§2.1) | Content graphs with gaps (a missing stage) wrongly cap a capable child | §2.1 rule change (code) |
| A7 | Placement `C` (comprehension) is a trustworthy-enough prior to open stories early | `max(F,C)` unlock kept | Children opened into stories by a `C` prior they didn't really have flounder in reading with no fallback | unlock-rule change (code + UX) |
| A8 | Completion is an acceptable mastery proxy for the **D strand** (alphabet/phonics) | D lessons = letters, which have **no per-letter SR/mastery signal**, so a completed D lesson counts as "mastered" | Children complete phonics lessons without decoding skill and get gated up in D anyway (the exact "clicked through" failure §6.1 fixes elsewhere, still live for D) | add letter-level mastery tracking, then treat D like V (schema + code) |
| A9 | `n` (prior-decay evidence count) is comparable enough across strands | V/F = distinct words practised; **D = completed D-lesson count** (coarser) | `k=8` paces V/F correction well but D's prior decays on a different scale, so D self-corrects too fast or too slow relative to V/F | per-strand `k`, or a uniform `n` definition (code) |

> **A8/A9 discovered during implementation, not design.** The D strand
> (decoding — alphabet/phonics) is built from *letters*, and letters are not
> SR-tracked the way words are (`child_word_progress` is word-only). So D cannot be
> mastery-scored the way V and F are: a completed D lesson is treated as mastered
> (A8), and D's evidence count `n` is a lesson count rather than a word-rep count
> (A9). Both are honest consequences of the current content model, isolated to D,
> and flagged here rather than hidden in `strands.ts`. The clean fix is per-letter
> mastery tracking — out of scope for this rebuild, recorded as a roadmap gap
> alongside the numeracy track (§6.2).

None of these blocks a correct *build*; A1–A3 block a correct *tuning*, which is
exactly what §3.3's instrumentation exists to inform, and A8–A9 flag where the
D strand is weaker than V/F until letter-level mastery exists. Revisit this table
against the first pilot cohort's `gate_recompute_log`.
