# KoodakBook — 10-Family Pilot Run-Book

> The one decision this pilot informs: **do we invest in content scaling
> (illustrations, native audio, 2,000+ items) — yes or no?** Everything below
> exists to answer that with real signal, not opinion. See `project.md` §11.5.

**Owner:** _________  **Start date:** _________  **Decision date:** start + 6 weeks

---

## 0. Pre-flight (before recruiting anyone)

The engine is built, deployed, and hardened. Before families touch it, confirm:

- [ ] Production is reachable and healthy (web, backend, db, admin containers up).
- [ ] **At least one fully-illustrated, native-voiced vertical slice exists.**
      This is the single biggest risk to a fair test — a pilot run on emoji +
      TTS measures the *engine*, not the *product*. If the slice isn't ready,
      delay the pilot; don't burn the cohort on a half-built experience.
- [ ] Placement probe builds (needs ≥9 stage-1 words with audio + ≥3 letters).
- [ ] Admin pilot dashboard loads at `/dashboard/pilot` (SSH tunnel to the admin
      app; it is localhost-only by design).
- [ ] A Persian teacher has eyeballed the curriculum order (optional but cheap
      credibility; doubles as the B2B sales asset later).

---

## 1. Cohort design

| Parameter | Value | Why |
|---|---|---|
| Families | 10 | Enough for directional signal; too small for statistics — treat as **design partners**, not an A/B test |
| Children | 1 per family (the focal child) | Keeps per-child signal clean |
| Age band | 4–9 | Spans Stage 1→3; the core target |
| Persian exposure | Mixed: ~½ "understands but can't read" (heritage), ~½ near-beginner | The heritage profile is the product thesis — it must be represented |
| Duration | 6 weeks | Long enough for W4 retention + a measurable literacy delta |
| Cadence | Weekly 15-min parent check-in (qual) + continuous telemetry (quant) | |

**Not an A/B test.** n=10 can't power a comparison. Instrument deeply, talk to
every family weekly, and weight qualitative "why" as heavily as the numbers.

---

## 2. Recruitment screener

Recruit from: Persian weekend schools, diaspora parent groups, personal network.
Screen each family with these questions; **include** a family only if it qualifies.

1. Child's age? → **must be 4–9**.
2. Does your child understand spoken Persian? (none / some words / a lot)
3. Can your child read any Persian? (no / a few letters / simple words)
   → aim for a mix; **at least 4 "understands but can't read"** families.
4. What device will they use? (tablet / phone / desktop) → **must have a
   tablet or phone with a modern browser**; note iOS Safari vs Android Chrome.
5. Will an adult sit with the child for the first session? → **yes required.**
6. Can you do a 15-min video/phone check-in once a week for 6 weeks? → **yes.**
7. (Honesty primer) "This is an early version — some art and audio are still
   basic. We want your honest reaction." → confirm they're OK with that.

Log each family in the tracking sheet (§7) with a code (F1…F10), not a name.

---

## 3. The measurements

Three quantitative gates + one qualitative. All quant numbers are on
`/dashboard/pilot`; definitions below are exactly what that page computes.

| # | Metric | Definition (as built) | Gate | Where |
|---|---|---|---|---|
| 1 | **Activation** | child completed a **stage-3 story** (NSM proxy for "read a real story") | **≥ 60%** | dashboard · `activation.rate` |
| 2 | **W4 retention** | child has a session in week 4 since their signup | **≥ 40%** | dashboard · `retention[w4]` |
| 3 | **Literacy gain** | `level` at exit − `level` at intake (placement snapshots) | **positive, meaningful** | dashboard · `literacy_gain.avg_level_gain` |
| 4 | **Willingness to pay** | exit-survey: "would you pay $X/yr?" | **≥ 40% yes** | exit survey (manual) |

Supporting engagement signals (not gates, but they explain the gates): avg words
mastered, lessons/stories completed, avg session minutes, active-last-7-days.

> **NSM honesty:** activation uses *story completion* as a proxy for *reading
> aloud*. True read-aloud capture isn't built yet. During check-ins, ask the
> parent directly: "Did your child read any of it out loud to you?" and record
> it — that qualitative yes/no is the real NSM until it's instrumented.

### Pre/post literacy gain — important mechanic

`level` is captured by the placement probe and **snapshotted to
`placement_history` on every probe run** (mig-021). Gain = latest − first
snapshot.

- **Pre (intake):** happens automatically — the probe runs at onboarding.
- **Post (week 6):** there is **no re-assess button in the UI yet.** To capture
  the post snapshot, have the parent open **`/onboarding/placement`** again with
  the child (it re-runs the probe and writes a 2nd snapshot). Send this link in
  the week-6 check-in.
  - ⚠️ Re-running the probe **overwrites** the child's current strand levels with
    the fresh result (it can lower a strand the child had promoted). That's fine
    at the *end* of the pilot (you're measuring final ability), but **do not**
    have families re-probe mid-pilot.
  - Optional engineering follow-up: add a dedicated "re-assess" entry point that
    snapshots without resetting gameplay levels. ~½ day; do it only if the pilot
    greenlights scaling.

---

## 4. Week-by-week timeline

**Week 0 — Setup (per family, ~20 min, facilitated)**
- [ ] Parent signs up, creates the child profile.
- [ ] Child plays the placement probe with a parent present (this is the
      **pre** measurement — don't coach answers).
- [ ] Record the intake `level` + strand levels (dashboard or
      `GET /api/placement/:child_id`).
- [ ] Parent baseline survey (§6a).
- [ ] Set expectation: "aim for a few short sessions a week; no pressure."

**Weeks 1–5 — Use + weekly check-in**
- Families use the app naturally. No nudging beyond the app's own reminders.
- 15-min check-in each week using the script (§6b). Log notes in the sheet.
- Mid-pilot (end of week 3): glance at the dashboard. If **activation is ~0**
  or **W1 retention collapsed**, that's an early smell — investigate the *why*
  in check-ins (content gap? confusing nav? audio quality?).

**Week 6 — Exit**
- [ ] Week-6 check-in includes the **post** placement re-probe (`/onboarding/placement`).
- [ ] Record exit `level`; the dashboard now shows non-null `literacy_gain`.
- [ ] Exit survey incl. the **WTP** question (§6c).
- [ ] Read the full funnel on `/dashboard/pilot`.

**Decision day**
- [ ] Apply the go/no-go rule (§5). Write a one-page memo: numbers + the 3 most
      important qualitative themes + the decision.

---

## 5. Go / no-go decision rule

| Outcome | Rule | Action |
|---|---|---|
| **GO — scale** | activation ≥60% **AND** W4 retention ≥40% **AND** positive literacy gain | Invest in content scaling (illustrations + native audio + story generator). The engine works. |
| **ITERATE** | gain is positive **but** activation OR retention misses | The learning works but engagement/onboarding doesn't. Fix the loop (session structure, motivation, first-session friction) and re-run a short pilot. **Do not scale content yet.** |
| **NO-GO — rethink** | literacy gain ≈ 0 or negative | The core premise isn't landing. Stop; re-examine pedagogy/curriculum with a teacher before any further build. |

WTP is a **business** gate layered on top: even on a GO, if WTP <40%, revisit
pricing/packaging before spending on scale — the engine can work while the
business model doesn't.

**Trust the qualitative.** With n=10, one confused family swings a percentage by
10 points. The check-in themes (what delighted, what frustrated, where they quit)
are often more decision-relevant than the rates. Let them override a borderline
number in either direction — and say so explicitly in the memo.

---

## 6. Scripts & surveys

### 6a. Parent baseline survey (week 0)
1. Why do you want your child to learn Persian? (one sentence)
2. What have you tried before? (classes / books / apps / family / nothing)
3. How would you rate your child's Persian reading today? (can't / letters / words / sentences)
4. How often do you expect to use this? (daily / few times a week / weekly)

### 6b. Weekly check-in script (~15 min)
1. "Tell me about a time your child used it this week." (let them narrate)
2. "What did they enjoy most? What frustrated them?"
3. "**Did your child read any Persian out loud to you?**" (the real NSM)
4. "Did *you* look at the parent dashboard? Was it useful?"
5. "On a scale of 1–5, how likely are you to keep using it next week?"
6. Anything broken / confusing / a moment they lit up?
> Capture verbatim quotes — they're gold for the memo and future copy.

### 6c. Exit survey (week 6)
1. Did your child's Persian reading improve? How do you know?
2. Best thing about KoodakBook? Worst thing?
3. **Would you pay for this? At ~[your annual price], yes/no?** (the WTP gate)
4. Would you recommend it to another Persian family? (NPS-style 0–10)
5. Would your child's grandparent enjoy a "look what I read" moment from it?
   (probes the heritage/share loop)

---

## 7. Per-family tracking sheet (template)

One row per family; fill weekly. (Spreadsheet, not in-app.)

| Family | Child age | Exposure (heritage/beginner) | Device | Intake level | Exit level | **Gain** | Activated? (stage-3 story) | Read aloud? (qual) | Active wks (1-5) | WTP | NPS | Top quote |
|--------|-----------|------------------------------|--------|--------------|-----------|----------|----------------------------|--------------------|------------------|-----|-----|-----------|
| F1 | | | | | | | | | | | | |
| … | | | | | | | | | | | | |

Aggregate row at the bottom should match the `/dashboard/pilot` numbers — if it
doesn't, reconcile (usually a child who never finished onboarding).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pilot run on emoji + TTS → measures the wrong thing | **Pre-flight gate:** one real illustrated + native-voiced slice before recruiting |
| iOS Safari speech recognition flaky (speak/probe) | Productive ASR never gates progress; probe audio has a tap-to-replay button. Note device per family. |
| n=10 over-reads noise | Treat as design partners; weight qual; report rates with the raw counts (x/10) |
| Families drop off silently | Weekly check-ins catch it; a no-show *is* data (retention signal) |
| Re-probe resets promoted levels | Only re-probe at week 6 (§3); consider the "re-assess" follow-up if scaling |
| Thin content caps strands fast | Expected; note it but don't fix pre-validation — it resolves when content scales |

---

## 9. What this pilot does **not** do (scope guard)

- It is **not** a marketing launch. 10 families, hand-held, private.
- It does **not** justify building more engine features. Per §11.5, the kill-list
  (multi-locale, native app, server ASR, B2B, print) stays frozen until a GO.
- It does **not** need statistical rigor. It needs an honest, qualitative-rich
  read on whether the core loop changes a real diaspora child's Persian reading.
