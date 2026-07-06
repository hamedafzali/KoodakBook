# Design, Motion & Content Plan

**Lens:** graphic design + animation direction for a children's product, ages 3–10.
**Builds on:** mig 014 (animations-as-data: `animation_template`/`animation_params`,
`scene_plan`, `image_brief`, review workflow), Framer Motion already in the child app,
levels 1–4, placement test.

**Current content (prod, July 2026):** 189 words · 15 curated stories · 28 lessons ·
32 letters · ~130 phonics syllables. 20 word categories exist in code; most are
nearly empty. ⚠️ The landing page claims «۴۰۰+ واژه» — reach it (Phase C) or soften it.

---

## 1. Age bands drive everything

One app, three registers. A 4-year-old and a 9-year-old must not get the same
screen personality — younger kids need bigger/slower/warmer; older kids reject
anything "babyish". The existing `level` (1–4) + birth year already tell us the band.

| Band | Ages | Level | Mode name | Interaction | Motion register |
|---|---|---|---|---|---|
| خردسال | 3–5 | 1 | «گوش کن و بگو» | listen/tap/speak only — **zero reading required** | big (1.5× scale), slow (400–600ms), bouncy springs, frequent small celebrations |
| نوآموز | 6–7 | 2–3 | «بخوان و بنویس» | phonics, tracing, first reading | standard (250–400ms), celebration after each completed *task* |
| مستقل | 8–10 | 4 | «بخوان و بساز» | fluent reading, bilingual toggle, writing | subtle (150–250ms), "cooler" effects (particles > balloons), celebrations only at milestones |

Concrete rule for every new feature: specify its behavior in all three bands or it
doesn't ship. (Most features differ only in timing/scale tokens — cheap to do if
decided up front.)

---

## 2. Visual design system

**Palette.** Keep amber/orange as the brand anchor (already everywhere). Add a
fixed accent per module so kids navigate by color before they can read:
lessons=green, letters=blue, phonics=orange, review=violet, speak=pink,
stories=teal, rewards=gold. (These accents already exist ad-hoc in PageHeader
gradients — formalize them as tokens in `tailwind.config` / shared constants.)

**Typography.** Vazirmatn stays. Rules for children:
- Learning text (words, syllables, letter names): ≥ 32px, `line-height ≥ 1.8`.
- **Harakat legibility is a design requirement**: zebar/zir/pish must be clearly
  separated from the letter body — test هِ، بُ، اَ at target sizes on a cheap
  Android tablet, not a Mac.
- Band 1 sees almost no UI text; icons + audio carry navigation.

**Illustration style guide (one page, before any asset is made):**
- Flat shapes, thick rounded outlines, no gradients inside characters,
  soft-shadow blobs for ground. (Matches the SVGs already on the landing/auth pages.)
- Characters: round, big eyes, no realistic proportions. Palette limited to the
  module accents + 3 neutrals.
- Format: **SVG only** (animatable, tiny, sharp on every screen). Raster only
  for photographic scenes — none planned.

**Scene library (the backbone of story visuals):**
- v1 = **12 scenes**: جنگل، خانه، اتاق کودک، مدرسه، پارک، دریا، کوه، بازار،
  آشپزخانه، حیاط، شهر، آسمان شب. Each with day/night variant + 2 loose
  foreground layers (clouds/fireflies/leaves) for parallax.
- Stored as layered SVGs in the repo (`packages/shared/scenes/` or uploads),
  keyed by slug — the AI story generator will reference them by slug.

---

## 3. Motion system

**Motion tokens** (shared constants, consumed by Framer Motion):
`duration.{xs,sm,md,lg}` per age band, one spring config (`stiffness 300, damping 20`
— springy but not rubbery), stagger step 60ms. Every animation in the app uses
tokens — this is what makes the app feel like *one* character.
`prefers-reduced-motion` collapses everything to fades. Non-negotiable.

**Teaching animations (they ARE the lesson — highest priority):**
1. **Letter tracing** (`letter` template, reserved since mig 014): letter draws
   itself stroke-by-stroke (SVG `stroke-dashoffset`), a pencil dot leads, then the
   child traces with a tolerant hit-path. Needs: stroke-order path data for 32
   letters (one-time asset job, ~2–3 letters/day of careful work).
2. **Phonics merge**: consonant slides + vowel mark drops in → "snap" → syllable
   plays. The merge visualizes blending — the core phonics concept. Pure Framer
   Motion, no assets needed. **Best effort-to-value in the whole plan.**
3. **Word reveal**: after a correct answer the word's little scene loops once
   (bird flaps, car drives). Uses the existing per-word `animation_template`
   picker in admin; ship 4 generic templates (bounce, float, drive-in, wiggle) so
   every word has *something*, custom scenes only for the top 50 words.

**Reward animations (rationed by band):**
- One celebration component, three intensities: sticker-pop (band 3) →
  confetti burst (band 2) → full-screen stars + mascot dance (band 1).
- ≤ 1.5s, skippable by tap, never during a task.

**Ambient motion:** child home tiles get a 4s idle "breath" (scale 1↔1.02);
buttons squash on press (scale .95). Nothing else moves uninvited.

**Mascot (last, once motion language is settled):** one character — suggestion:
a little Persian cat «نارنجی». Five states (idle, happy, encouraging, sleeping,
celebrating) as Lottie or sprite-SVG. Appears in: empty states, celebrations,
story progress path, placement test host. A face makes every other animation
read as personality instead of effects.

---

## 4. Story experience (backgrounds + progress)

1. **`scene_plan` goes live** (column exists since mig 014): story generator
   prompt gains one field per page — `{scene: "forest", time: "night"}`,
   validated against the scene-library slugs, fallback = previous page's scene.
   Curated stories get scenes assigned once in admin.
2. **Ken Burns player**: background drifts slowly (20s pan/zoom loop), parallax
   foreground layer at 0.5× speed. Text sits on a soft card so contrast is
   guaranteed over any scene. Reduced-motion → static image.
3. **Progress path**: under the story, a dotted trail with one node per page;
   the marker (mascot later) hops a node per page-turn; flag at the end +
   celebration on arrival. Kids see "how far to go" without numbers.
4. **No per-page AI images for now** — character consistency + review burden +
   per-story cost. Revisit only for *curated* stories via `image_brief` with the
   human-approval workflow (columns already exist).

---

## 5. Content plan (the "more content" half)

Production rule for everything below: **AI drafts → admin reviews → publish**
(same pattern as audio review + `animation_review`). Nothing AI-made reaches a
child unreviewed except AI stories themselves (already the accepted exception).

**A. Words: 189 → 600** (fixes the landing claim honestly at «۶۰۰+»)
Fill the 20 existing categories to ~30 words each, prioritized:
numbers & shapes → food → clothes → weather/nature → school → actions (فعل‌های
پرکاربرد: می‌خورم، می‌روم…) → feelings → opposites → greetings/questions.
Pipeline: AI drafts word + finglish + english + category + stage + tts_text
(diacritized) in batches of 30 → admin approves in the words page → audio batch
regen (module from the audio plan) → template animation assigned by default.

**B. Folk tales pack: +10 curated stories**
Public-domain Persian classics: کدو قلقله‌زن، شنگول و منگول، خاله سوسکه،
موش و گربه، حسنی، ماهی سیاه کوچولو (rights-check this one)… Illustrated with
the scene library, narrated via the audio pipeline (premium voice or human).
Cultural anchor + zero licensing cost + exactly what diaspora parents want.

**C. Songs & rhymes module: 10 pieces** (band-1 killer feature)
اتل متل توتوله، دویدم و دویدم، عمو زنجیرباف، جم جمک برگ خزون… Karaoke-style:
line highlights as it's sung, tap-to-repeat a line. Reuses story-page
infrastructure (pages = lines, audio per line). Recording: human voice strongly
preferred here — TTS cannot sing.

**D. Numbers & counting mini-module**
۰–۲۰ + counting games (tap 3 apples). Fills the `numbers`/`shapes` categories
and gives band 1 a non-language win. Mostly reuses lesson mechanics.

**E. Seasonal packs (twice a year)**
نوروز (هفت‌سین vocabulary + one story + a song) and یلدا (same shape). Seasonal
content is the strongest re-engagement lever for lapsed families; admin
schedules visibility (plans-style `is_public` flag on lessons).

**F. Printables**
Per-letter handwriting worksheet PDFs (trace the letter, color the word) —
generated from the same stroke-path assets as tracing. Parents love printables;
`pdf_url` columns already exist. Cheap once tracing paths exist.

**G. Game templates (data-driven, like animations): 3 to start**
- Memory match (word ↔ picture) — works for every category automatically.
- Sorting (کدام‌ها حیوان‌اند؟) — category data is the game data.
- Letter hunt (find all «ب»s in the word cloud) — reuses letters data.
One template = infinite content because it feeds off the growing word DB.

---

## 6. Phases

| Phase | Scope | Key deliverables |
|---|---|---|
| **1. Foundation** (design work, little code) | style guide, motion tokens, module color tokens, scene library v1 (12 scenes), letter stroke paths (32) | one-page style guide in docs/, tokens in shared, SVG assets |
| **2. Teaching motion** | phonics merge, letter tracing, word-reveal templates ×4, celebration component with 3 band intensities | the two "the-animation-is-the-lesson" features live |
| **3. Story experience** | scene_plan in generator + admin, Ken Burns player, progress path | every story visually illustrated + progress feel |
| **4. Content wave 1** | words → 400 (batches via AI-draft pipeline), folk tales ×5, numbers module | landing stat becomes honest; band 1 has a home |
| **5. Content wave 2 + play** | words → 600, songs module, game templates ×3, folk tales ×5, printables | full catalog |
| **6. Personality** | mascot (5 states), age-adaptive theming pass, seasonal Nowruz pack (timed) | the app has a face |

Order rationale: assets before animations that need them; teaching motion before
decorative; content waves after the pipeline exists so growth is cheap; mascot
last so it inherits a settled motion language.

---

## 7. Decisions needed

1. Mascot yes/no, and species/name (suggestion: cat «نارنجی»).
2. Scene library production: commission an illustrator vs AI-generate + hand-pick
   + unify colors ourselves (cheaper, needs a careful eye).
3. Songs: who sings? (TTS can't; needs one human session — same session as the
   tier-1 letter recordings from the audio plan.)
4. Word target for the landing claim: fix text to «۲۰۰+» now, or hold until
   Phase 4 delivers 400.
