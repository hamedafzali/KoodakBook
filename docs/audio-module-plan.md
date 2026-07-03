# Audio Module — Design Plan

**Status:** proposal (no code changed yet)
**Owner:** admin/content pipeline
**Replaces:** `apps/backend/src/lib/tts/*`, per-row `audio_url` writes, fixed phonics paths, versioned filenames

---

## 1. Problem

Audio quality is inconsistent and no single voice works well, because audio is
produced by **three uncoordinated systems** across **four content types**:

| Content | Today's source | Path convention |
|---|---|---|
| Letters | Piper/Edge regen job → `letters.audio_url` | `/uploads/letters/<id>-<ts>.wav` (versioned) |
| Phonics syllables | Regen job → fixed file | `/uploads/phonics/<slug>.wav` (path built **client-side**) |
| Words | Regen job → `words.audio_url` | `/uploads/words/<id>-<ts>.wav` (versioned) |
| Story pages | On-generate synthesis (cloud if premium+key, else sidecar) | `/uploads/ai-stories/<story>-<page>.<ext>` |

Structural problems, independent of which engine is used:

1. **No single voice identity.** Letters, words and stories can each be
   synthesized with a different engine/voice depending on settings at the time
   they were generated. A child hears a different narrator on every screen.
2. **Quality decided at synthesis time, forever.** Whatever the engine produced
   is what ships. There is no listen/approve step, no way to see which items
   sound wrong, no way to fix one item except re-uploading manually.
3. **TTS is weakest exactly where we need it most.** Isolated letters («ره» read
   as the word *rah*), phonics syllables («بَ بِ بُ»), and homographs
   (کرم = *kerm/karam/…*) are the worst case for every Persian TTS engine,
   because Persian script omits short vowels.
4. **The asset layer exists but is bypassed.** Migrations 017–019 built
   `audio_assets` + `primary_audio()` + sync triggers precisely for
   "TTS→native hot-swap". But:
   - the regen job **deletes** `audio_assets` rows and writes `audio_url`
     directly (the trigger then re-inserts the TTS file mislabeled
     `source='native'`);
   - phonics bypasses the DB entirely (fixed path, no entity rows);
   - story-page synthesis writes files without asset rows.
5. **Cache-busting via versioned filenames** is a workaround for mutable URLs;
   content-addressed files make it unnecessary.
6. **Pronunciation fixes don't scale.** The new per-row `tts_text` columns
   (mig 030) fix a word on *its own* card but not the same homograph inside a
   story, and they're invisible to any future content.

**Key insight:** nothing here is live TTS. Everything is synthesized to files
and played later, and the core catalog is *bounded* (~32 letters, ~130
syllables, a few hundred words). So premium-engine cost is a **one-time**
catalog-generation cost (well inside ElevenLabs/Azure starter tiers), and the
right architecture is a **curated content-asset pipeline** — generate → listen
→ approve → store forever — not an on-the-fly synthesis stack with fallbacks
silently deciding quality.

---

## 2. Goals / non-goals

**Goals**

- One module owns everything audio: text preparation, synthesis, storage,
  resolution, review.
- One consistent voice identity across all content types ("voice profile").
- Human-quality audio for the bounded core catalog (letters, phonics, words);
  good-enough automatic audio for unbounded AI stories.
- A pronunciation lexicon that applies to *all* text (cards **and** stories).
- Every generated clip is reviewable; nothing unreviewed silently replaces
  something approved.
- Idempotent batch generation: only stale items are re-synthesized.

**Non-goals**

- Real-time / streaming TTS.
- Client-side voice selection (the child never chooses a voice).
- Multi-locale audio (schema stays locale-aware, but only `fa` ships).

---

## 3. Architecture

```
apps/backend/src/audio/
├── index.ts          public API (resolve / generate / regenerate / approve)
├── engines/
│   ├── types.ts      interface AudioEngine { id; synthesize(req): Promise<Clip> }
│   ├── elevenlabs.ts azure.ts  openai.ts  google.ts   (premium, keyed)
│   ├── edge.ts       piper.ts                          (free, via sidecar)
├── profiles.ts       voice-profile resolution (DB-backed)
├── pronounce.ts      normalize + lexicon + per-entity override → synth text
├── store.ts          content-addressed files + audio_assets rows
└── jobs.ts           batch generation, staleness check, progress state
```

### 3.1 Engine interface

Every engine implements the same contract; nothing outside `engines/` knows
provider details:

```ts
interface SynthRequest {
  text: string            // already normalized + lexicon-applied
  voice: string           // engine-specific voice id
  rate?: number           // 0.5–1.5, engines map to their own scale
  pause?: 'none' | 'word' // wrap letters/syllables with silence padding
}
interface Clip { buf: Buffer; mime: 'audio/mpeg' | 'audio/wav'; engine: string }

interface AudioEngine {
  id: 'elevenlabs' | 'azure' | 'openai' | 'google' | 'edge' | 'piper'
  available(): boolean                       // key present / sidecar reachable
  synthesize(req: SynthRequest): Promise<Clip>
}
```

The existing Piper/Edge sidecar stays as-is (it's already dual-engine with
offline fallback); `edge.ts`/`piper.ts` are thin HTTP clients for it.

### 3.2 Voice profiles

A profile is *the* app voice: primary engine+voice, an ordered fallback chain,
and per-content-type prosody. Stored in DB, edited in admin (replaces today's
five scattered voice dropdowns):

```ts
interface VoiceProfile {
  id: string                      // 'narrator' (default), future: 'narrator-female'
  chain: { engine: EngineId; voice: string }[]   // try in order
  prosody: Partial<Record<ContentType, { rate?: number; pause?: 'word' }>>
  // e.g. { letter: { rate: 0.85, pause: 'word' }, phonics: { rate: 0.8 } }
}
```

Generation records which engine/voice actually produced each clip, so a
fallback-produced clip is visibly lower-tier in review.

### 3.3 Pronunciation layer (`pronounce.ts`)

Applied to **every** text before synthesis, in order:

1. **Normalize** — Arabic→Persian codepoints, tatweel, digits, whitespace
   (exists: `lib/tts/normalize.ts`, moves here).
2. **Per-entity override** — `tts_text` when set (letters' diacritized names).
3. **Lexicon** — global `pronunciation_lexicon` table: `surface → tts_form`
   (`کرم → کِرم`). Token-level replacement with ZWNJ-aware word boundaries, so
   the fix applies inside story sentences too. Admin-editable; grows over time
   into a curated Persian homograph list.

### 3.4 Asset store (`store.ts`) — extends mig 017, doesn't replace it

Files are **content-addressed**: `/uploads/audio/<sha256[0:16]>.<ext>`.
Same bytes → same URL → immutable → no cache-busting, no versioned names.

`audio_assets` becomes the single source of truth (schema delta in §4):

- `status`: `draft | approved | rejected` — resolution prefers approved.
- `source`: `human | premium_tts | free_tts` (replaces `native | tts`).
- `profile`, `engine`, `voice`: provenance.
- `text_hash`: sha256 of the *final synth text* — staleness check.
- `entity_key`: text key for entities without DB rows (phonics slugs).

**Resolution order** (one rule, everywhere):

```
approved human > approved TTS > draft (newest) > null
```

`primary_audio()` (mig 018) is updated to encode this order; `is_primary`
becomes a derived convenience rather than something jobs fight over. The mig
019 sync triggers stay during migration (admin uploads keep working), then are
retired when uploads go through the module.

### 3.5 Generation jobs (`jobs.ts`)

Replaces `lib/tts/regenerate.ts`:

- **Idempotent**: an item is regenerated only if it has no asset for the
  active profile or its `text_hash` changed. "Regenerate all" after a
  lexicon fix touches only affected items.
- Writes `draft` assets; **never** demotes an `approved human` recording.
- Keeps the existing pacing/retry behavior (memory-capped sidecar host).
- Story pages are auto-approved `draft→approved` by default (unbounded
  content can't all be reviewed), but still land in the review screen for
  spot-checks.

### 3.6 Review workflow (admin)

One screen: filter by content type / status / engine, play button per item,
**approve / regenerate / record**. The existing mic-recorder component slots
in as the *record* action — a human take is inserted as
`source='human', status='approved'` and immediately wins resolution.

### 3.7 Client resolution

Kill client-built paths. One endpoint:

- `GET /api/audio/manifest?type=letter|word|phonics` → `{ [key]: url }`
  (fetched once per screen; phonics keys are the slugs).
- Story pages keep embedding the resolved URL in the story payload.
- Browser `speechSynthesis` remains the last-resort client fallback when the
  manifest has no entry (unchanged behavior).

---

## 4. Schema changes (one migration)

```sql
-- 03x_audio_module.sql

-- Widen audio_assets into the single source of truth.
alter table audio_assets
  add column if not exists entity_key text,            -- phonics slug etc.
  add column if not exists profile    text not null default 'narrator',
  add column if not exists engine     text,            -- 'elevenlabs' | 'azure' | ...
  add column if not exists status     text not null default 'approved'
    check (status in ('draft', 'approved', 'rejected')),
  add column if not exists text_hash  text;            -- sha256 of final synth text

-- entity_id becomes optional (phonics has no row); exactly one key required.
alter table audio_assets alter column entity_id drop not null;
alter table audio_assets add constraint chk_audio_entity
  check (entity_id is not null or entity_key is not null);
alter table audio_assets drop constraint audio_assets_entity_type_check;
alter table audio_assets add constraint audio_assets_entity_type_check
  check (entity_type in ('word', 'letter', 'story', 'story_page', 'phonics'));

-- Source becomes three-tier (map old values: native→human, tts→free_tts).
update audio_assets set source = 'human'    where source = 'native';
update audio_assets set source = 'free_tts' where source = 'tts';
alter table audio_assets drop constraint audio_assets_source_check;
alter table audio_assets add constraint audio_assets_source_check
  check (source in ('human', 'premium_tts', 'free_tts'));

create index if not exists idx_audio_assets_key
  on audio_assets (entity_type, entity_key) where entity_key is not null;

-- Global pronunciation lexicon (applies to cards AND story text).
create table if not exists pronunciation_lexicon (
  id         uuid primary key default gen_random_uuid(),
  surface    text not null unique,   -- کرم
  tts_form   text not null,          -- کِرم
  note       text,                   -- 'worm (not generosity)'
  updated_by text,
  updated_at timestamptz default now()
);

-- Voice profiles (replaces piper_voice + provider/voice fields over time).
create table if not exists audio_profiles (
  id      text primary key,          -- 'narrator'
  chain   jsonb not null,            -- [{engine, voice}, ...] in fallback order
  prosody jsonb not null default '{}'::jsonb
);
insert into audio_profiles (id, chain) values ('narrator', '[
  {"engine": "azure", "voice": "fa-IR-FaridNeural"},
  {"engine": "edge",  "voice": "fa-IR-FaridNeural"},
  {"engine": "piper", "voice": "fa_IR-amir-medium"}
]') on conflict (id) do nothing;

-- primary_audio(): encode the resolution order (approved human > approved tts
-- > newest draft), keyed by id or key. Replaces the is_primary-only lookup.
```

Later cleanup migration (Phase 4): drop per-row `audio_url` columns, the
mig-019 triggers, and (optionally) fold `tts_text` into the lexicon.

---

## 5. Module public API

```ts
// apps/backend/src/audio/index.ts
resolve(ref: EntityRef): Promise<string | null>          // URL by resolution order
manifest(type: ContentType): Promise<Record<string, string>>
generate(ref: EntityRef, opts?: { profile?: string }): Promise<AudioAsset>  // one item, draft
startBatch(scope: Scope): boolean                        // stale-only batch job
batchStatus(): BatchState
approve(assetId: string): Promise<void>
reject(assetId: string): Promise<void>
attachHumanRecording(ref: EntityRef, file: Buffer): Promise<AudioAsset>  // approved human take

type EntityRef =
  | { type: 'word' | 'letter' | 'story_page'; id: string }
  | { type: 'phonics'; key: string }
```

**HTTP surface**

| Route | Purpose |
|---|---|
| `GET  /api/audio/manifest?type=` | client resolution (public) |
| `POST /api/admin/audio/generate` | one item or `{scope}` batch |
| `GET  /api/admin/audio/review?type=&status=` | review queue |
| `POST /api/admin/audio/:assetId/approve` / `reject` | review actions |
| `POST /api/admin/audio/:ref/record` | human recording upload |
| CRUD `/api/admin/audio/lexicon` | pronunciation lexicon |
| CRUD `/api/admin/audio/profiles` | voice profiles |

---

## 6. Content strategy (what the pipeline is *for*)

| Tier | Content | Volume | Source | Review |
|---|---|---|---|---|
| 1 | Letters + phonics | ~160 clips, fixed | **Human recording** (best) or premium TTS with diacritized text | 100% listened |
| 2 | Core words | few hundred, slow-changing | Premium TTS (profile chain) + lexicon | 100% listened |
| 3 | AI story pages | unbounded | Same profile chain automatically | spot-check |

Premium engine choice is a config decision, not an architecture one — the
profile chain makes it swappable. Recommendation: **Azure** first (already
integrated, `fa-IR-FaridNeural`/`DilaraNeural` are the same voices Edge serves
unofficially, free tier 500K chars/month covers the whole catalog many times
over) and evaluate **ElevenLabs** for tier 1 if Azure's letters still
disappoint. Tier-1 human recording remains the gold standard: ~1 hour of mic
time with the existing admin recorder beats every TTS at «بَ بِ بُ».

---

## 7. Migration plan (each phase ships independently)

**Phase 1 — module + store, readers unchanged.**
Create `audio/` module + migration. Import legacy files as `approved` assets
(they're already mirrored in `audio_assets`; add `text_hash` lazily). Point
`synthesizeStoryPages` and the regen job internals at the module. Add the
manifest endpoint. Nothing user-visible changes.

**Phase 2 — pronunciation + profiles.**
Move normalize/lexicon in; seed lexicon from letters' `tts_text` (mig 030).
Admin: profile editor replaces the voice dropdowns; lexicon CRUD.

**Phase 3 — review workflow + catalog regeneration.**
Review screen (play/approve/record). Generate tiers 1–2 with the chosen
premium profile as drafts; approve pass; record human takes where TTS fails.
Client switches to the manifest (fixes the phonics fixed-path coupling).

**Phase 4 — cleanup.**
Delete `lib/tts/regenerate.ts` versioned-filename logic, per-row `audio_url`
writes + mig-019 triggers, per-row `tts_text` (folded into lexicon), and the
`piper_voice`/provider fields in `tts_settings` superseded by profiles.

---

## 8. Decisions needed before Phase 1

1. **Premium engine for the catalog** — Azure (recommended start) vs
   ElevenLabs vs OpenAI. Needs `TTS_API_KEY` provisioned in ACM either way.
2. **Human recording for tier 1** — who records, and is one narrator voice
   (male or female) the brand voice?
3. **Story-page auto-approval** — auto-approve drafts (recommended) or hold
   stories until spot-checked?
4. **Keep browser-TTS client fallback?** (Recommended: yes, unchanged — it
   only fires when an item has no asset at all.)
