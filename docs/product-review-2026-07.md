# KoodakBook — Full Product Review (July 2026)

**Prompt corrections applied before executing.** The review brief assumed a
Flutter app (Riverpod/Bloc, Flutter animations, mobile-first perf targets).
Reality: **Next.js 15 / React / TypeScript monorepo** (web + admin), Express +
Postgres backend, framer-motion, Docker Compose on a **home server (LAN-only)**,
PWA — no native apps yet. Flutter sections were re-scoped to the real stack.
Second correction: the brief's premise "Free users receive low-quality voice"
was verified **true in production config** (every section runs Piper for free
users; Edge was available but never enabled) — so the strategic directive is
evaluated against that reality, not the intended one.

**Evidence baseline (prod, 2026-07-12):** 3 users · 2 children · 295 words
(295 with ElevenLabs audio, **0 with images**) · 32 letters (**0 premium
audio, no premium voice configured**) · 20 curated stories (**0 covers**) ·
177 story pages (148 with premium audio) · 3 AI stories · free tier voice =
Piper everywhere · 1 tablet lead · 0 non-English translations used yet ·
uploads 203 MB · no payments · no tests in CI · no error monitoring · no
backups · LAN-only.

---

## 1. Executive summary

The product is **feature-rich far beyond its stage** — per-section dual-tier
audio pipeline, AI stories with scene illustration + multi-language
translation, math world, games, placement, spaced repetition, design system,
kid-login — and simultaneously **unshippable as a business**: nobody outside
the house can reach it, nobody can pay, the free tier sounds robotic, the
most pedagogically fragile content (letters) has the worst voice, and the
visual content layer (word photos, story covers) is 0% populated despite the
tooling existing. The gap is not engineering capability; it is **distribution,
monetization plumbing, and content operations**.

**Verdict on the strategic directive (remove Piper, ElevenLabs-only):**
directionally correct, executed with one refinement. The decisive fact: the
catalog (letters, words, phonics, math, curated stories) is **pre-generated
files** — serving ElevenLabs to every user has *zero marginal cost* after a
one-time generation (~100K chars, trivial credits). So quality tiers on the
catalog are pure self-harm: they make the free experience worse without
saving money. The only place ElevenLabs costs per-use is **AI story
narration** (unbounded) — which is exactly where usage limits belong.
Refined model, implemented with this review:

- **Catalog audio: ElevenLabs for everyone.** No quality tiers. (Serving flip
  + missing-file generation.)
- **AI stories: same great voice for all, capped by count.** Free = 1/day
  (was: unlimited — a monetization hole), solo 2, duo 4, family unlimited.
- **Piper/Edge sidecar: demoted to infrastructure fallback** (generation-time
  resilience when the ElevenLabs API fails). Not user-facing, not removed —
  removing the container buys nothing; removing it from the *experience* is
  the actual intent.

## 2–3. Scores

- **Current: 5.5 / 10.** Engineering breadth 8; product completeness for a
  real family 4 (no reach, no pay, thin visual content, robotic free voice).
- **World-class target: 9 / 10** — reachable with the roadmap below; the
  architecture does not need a rewrite.

## 4. Top 20 improvements (ranked by impact)

| # | Improvement | Sev | Effort | Conf |
|---|---|---|---|---|
| 1 | **Go public**: domain + HTTPS (Cloudflare Tunnel first, VPS later) | Critical | S | High |
| 2 | **Stripe checkout** → plans already exist; flip «قابل خرید» after | Critical | M | High |
| 3 | **ElevenLabs catalog for all** (this review's execution) | Critical | S | High |
| 4 | **Letters premium generation** + letter section voice (was none!) | Critical | XS | High |
| 5 | **Backups**: nightly pg_dump + uploads → off-host | Critical | S | High |
| 6 | Word photos: run the picker over top 100 words (content op) | High | S(ops) | High |
| 7 | Story covers: 20 curated covers (scene-based or commissioned) | High | M(ops) | High |
| 8 | Error monitoring (Sentry) + uptime check | High | S | High |
| 9 | Free plan story cap (1/day) — closes unlimited-free hole | High | XS | High |
| 10 | Audio preloading in StoryReader (prefetch next page clip) | High | S | High |
| 11 | PWA offline: cache catalog audio + shell (service worker) | High | M | Med |
| 12 | Letter tracing with verified stroke paths (plan's last teaching gap) | High | L | Med |
| 13 | Parent weekly progress email (retention lever parents feel) | High | M | High |
| 14 | Capacitor wrap → Play Store/App Store presence (waitlist exists) | High | L | Med |
| 15 | Learning telemetry: per-exercise outcomes → tune difficulty | Med | M | Med |
| 16 | Pronunciation scoring on speak page (premium feature) | Med | L | Low |
| 17 | Test suite in CI for prod images (the compose gotcha recurs) | Med | M | High |
| 18 | Pronunciation lexicon (global) + per-story-page tts override | Med | M | High |
| 19 | A11y audit pass: focus traps, reduced-motion coverage, contrast CI | Med | S | Med |
| 20 | Seasonal packs (Nowruz/Yalda) — re-engagement calendar | Med | M(ops) | Med |

## 5. Critical problems (why the score is 5.5, not 7)

1. **LAN-only.** Every other line of this review is theoretical until a URL
   exists. (Effort: an afternoon with Cloudflare Tunnel.)
2. **No checkout.** Five plans, presentation controls, entitlement
   enforcement — and zero ability to take money.
3. **Quality inversion.** Letters — where TTS is hardest and children are
   youngest — had *no* premium voice configured; free users heard Piper
   everywhere. Fixed with this review.
4. **No backups.** 203 MB of generated/curated content + family data on one
   home disk. One failure erases the product.
5. **Zero images.** The picker works; the content operation never happened.
   Kids' products live and die on visual richness.

## 6. Quick wins (1–2 days) — ✅ = executed with this review

- ✅ Letter section premium voice + generate 33 letter clips
- ✅ Generate 29 missing premium story-page clips (mode=missing)
- ✅ Serve ElevenLabs catalog to all users (backend + client flip)
- ✅ Free AI-story cap 1/day (migration 041)
- StoryReader next-page audio prefetch (#10)
- Sentry DSN + nightly pg_dump cron (#5, #8)
- Landing copy: claim the real numbers (295 words, 20 stories, 8 languages)

## 7. Medium (1–2 weeks)

Public deployment + Stripe + backups/monitoring hardening; photo/cover
content sprint (admin ops, ~2 evenings); parent weekly email; PWA offline
caching; CI running prod Dockerfiles + the existing e2e path.

## 8. Major (1–3 months)

Letter tracing (asset job + engine); Capacitor mobile shells + store
listings; pronunciation scoring; learning telemetry + difficulty tuning;
AI conversation practice (premium flagship); pronunciation lexicon system.

## 9–12. Design / UX / Motion / Architecture notes (stack-corrected)

- **Design system («نارنج»)**: real tokens exist (module hues, 2 shadows,
  radius scale, chunky action language). Gaps: inner screens (lesson player,
  review, speak, memory) still pre-system; emoji-as-icon layer should become
  curated assets (Fluent/MIT) via one `<Pic>` component; folk-tale covers.
- **UX**: strongest = home (smart-next, windowed rows, age bands), story
  reader (auto-read, scenes, path). Weakest = onboarding funnel (signup →
  child → placement has no progress framing), error/empty states outside the
  child app, subscription flow (doesn't exist).
- **Motion**: framer-motion tokens are consistent (one spring, capped
  celebrations, reduced-motion). Missing: page transitions between child
  routes (Next view transitions), mascot state machine (Rive is the right
  target — registry already anticipates it).
- **Architecture**: Express+Postgres is appropriately boring and scales past
  this stage. Real risks: single-host coupling (db+files+app on one box —
  fine until public), uploads on local volume (fine; add backup, later S3),
  in-memory regen/rate-limit state (fine single-node; document as such),
  `select *` payloads (trim when public), no tests in CI (the known prod
  Dockerfile rot bit once already). 1M-user talk is premature by 4 orders of
  magnitude — the correct scalability work now is backups, monitoring, and a
  clean path to a VPS, all listed above.

## 13. AI audio architecture (§10 of the brief)

Current: pre-generation (catalog) + on-demand (AI stories) + per-section
config + tiered variants + missing-mode + per-word one-offs + fallback chain
(premium → free → browser TTS) — this is the right architecture; the brief's
concerns (caching, cost, retry, failure states) are already answered by
files-on-disk + missing-mode + sidecar fallback. Post-flip: single quality
tier simplifies the client chain (premium-first for everyone). Remaining:
preloading (#10), offline cache (#11), lexicon (#18).

## 14. Accessibility

Good: aria labels/roles broadly present, reduced-motion honored, RTL-native,
48px+ targets, harakat-aware type sizing. To do: systematic keyboard/focus
audit (admin especially), contrast checks in CI, dyslexia-friendly option
(larger tracking + line height toggle), screen-reader pass on quiz flows.

## 15. Monetization plan (final)

Identical education for all (voice, content quality). Pay for **quantity and
family features**: AI stories/day (1→2→4→∞), children (1→2→5), co-read,
parental recording, weekly reports, offline packs, (later) AI conversation
and pronunciation scoring. Yearly = 2 months free. Trials: 7-day premium on
signup once checkout exists (plans table already supports trial_days).

## 16. Roadmap (order of operations)

**Week 1:** public URL → Stripe → backups/Sentry → content sprint (photos,
covers) → quick wins above.
**Month 1:** parent email, PWA offline, onboarding polish, CI/tests,
inner-screen design-system migration.
**Quarter:** tracing, Capacitor stores, telemetry, lexicon, conversation
practice, seasonal packs.

The engine is genuinely strong. Ship the doors and the cash register.
