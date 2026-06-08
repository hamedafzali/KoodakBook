# Language-Agnostic Content — Migration Plan

## Why
The content model is bilingual-hardcoded:

| Table | Columns |
|---|---|
| `words` | `persian`, `english`, `finglish` |
| `letters` | `name_persian`, `name_english` |
| `stories` | `title_persian`, `title_english` |
| `story_pages` | `text_persian`, `text_english` |

Adding a second heritage language (Arabic, Hindi, Armenian, …) under this shape
means new columns everywhere + rewriting every reader/writer/UI — an expensive
rewrite. The platform thesis (Persian as a beachhead, then other heritage
languages) requires language to be **data, not schema**.

## Target model (shipped, additive — migration 009)
- `locales(code, name, direction)` — language + script direction as first-class data.
- `content_translations(entity_type, entity_id, locale, field, value)` — one row
  per translatable field per locale. `entity_type` ∈ word|letter|story|story_page;
  `field` ∈ text|name|title.

Migration 009 **backfills** this from the legacy columns and leaves them in place.
Nothing reads the new model yet, so the app is unaffected and the change is
reversible (drop the two tables to revert).

## Cutover phases (each independently shippable & reversible)
1. **Foundation (done, this branch):** add tables + backfill + `lib/translations.ts`
   read helper. No behavior change.
2. **Dual-write (done, this branch):** admin create/update/delete for words,
   stories and story pages also writes `content_translations` via
   `lib/translations.ts` (`upsertTranslations`/`deleteEntityTranslations`), so the
   two representations can't drift. Letters have no name-edit endpoint, so they
   need no dual-write. (TODO: a CI/cron parity check.)
3. **Read cutover:** curriculum routes accept `?locale=` (default `fa`/`en`) and
   read from `content_translations` via the helper, returning a normalized
   `{ text, ... }` shape. Frontend reads the normalized shape instead of
   `persian`/`english`. Ship behind a flag; verify byte-for-byte parity.
4. **Drop legacy columns:** once readers/writers no longer touch them and a full
   backup exists, drop `persian/english/finglish/name_*/title_*/text_*`.

## Notes / decisions
- `audio_url`/`image_url` stay per-row for now; per-locale media is a later concern
  (a `locale` could key media too if a language needs different recordings).
- Direction (RTL/LTR) comes from `locales.direction`, so the UI stops hardcoding
  `dir="rtl"` and derives it from the active content locale.
- Keep `entity_id` a loose reference (no cross-table FK); `entity_type` disambiguates.

## Status
Phases 1–2 on branch `i18n-foundation`, **not** yet on `main`. With dual-write in
place the translations model can no longer drift, so this branch is now safe to
merge. Phases 3 (read cutover) and 4 (drop legacy columns) remain — and Phase 3
is the larger change (touches every curriculum reader + the frontend), so it
warrants its own branch + review.
