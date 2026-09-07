# KoodakBook — Project Document

> Helping diaspora children learn Persian through stories, play, and family connection.

---

## 1. The Problem

Millions of Persian-speaking families live outside Iran. Parents deeply want their children to speak, read, and write Persian — not just for practical reasons, but as a connection to identity, culture, and grandparents. Yet no dedicated, high-quality digital product exists to serve this specific need.

Diaspora children are **heritage learners**, not foreign language learners. They often understand some spoken Persian but have zero literacy. They are surrounded by a dominant language (English, German, French, etc.) and have no immersive Persian environment outside the home.

---

## 2. Stakeholders

| Stakeholder | Role | What They Need |
|---|---|---|
| **Child** | The learner | Engaging stories, audio, visuals, rewards, short sessions |
| **Parent** | Buyer + motivator | Easy onboarding, visible progress, trust in quality |
| **Persian Language Teacher** | Curriculum validator | Alignment with proper progression, phonics, script rules |
| **Child Development Expert** | Learning science | Age-appropriate cognitive load, spaced repetition |
| **Grandparents** | Hidden emotional driver | Shareable stories, low-tech access |
| **Weekend Persian Schools** | Distribution channel | Curriculum alignment, institutional partnership |

---

## 3. Curriculum & Learning Progression

### Stages

**Stage 1 — Phonemic Awareness (Age 3–5)**
- No reading yet — pure audio and visuals
- Familiar vocabulary: family, food, colors, animals, body parts
- Songs, rhymes, and repetition
- Goal: child recognizes 50–100 Persian words by sound

**Stage 2 — Script Introduction (Age 5–7)**
- Alphabet grouped by shape similarity, not alphabetical order
- Right-to-left direction awareness
- Connect letters to words from Stage 1
- Short vowels (zabar/zir/pish) as a dedicated module
- Goal: child can read simple 2–3 letter words

**Stage 3 — Reading Simple Stories (Age 6–9)**
- Short sentences with familiar vocabulary
- Bilingual support (Persian + English) with toggle to hide English
- Audio narration for self-paced reading
- Goal: child can read a short story independently

**Stage 4 — Reading for Meaning (Age 8–12)**
- Longer stories with richer vocabulary
- Persian cultural content: Nowruz, Yalda, Hafez poems, simplified Shahnameh
- Optional writing exercises
- Goal: child can consume original Persian content

### Key Curriculum Decisions

| Decision | Recommendation | Reason |
|---|---|---|
| Dialect | Tehran standard | Most widely understood in diaspora |
| Script system | Finglish as bridge → phase out | Reduces initial friction |
| Vocabulary source | Everyday modern first | Cultural classics after foundation is built |
| Bilingual mode | Parent-controlled toggle | Different families have different preferences |
| Grammar | Implicit through stories | Explicit optional for older children |

### Minimum Viable Curriculum

- 10 audio-visual vocabulary lessons (Stage 1) — animals, colors, family
- Alphabet introduction module (Stage 2) — letters grouped by shape
- 3–5 short bilingual stories (Stage 3)

---

## 4. Product Structure

### User Roles

| Role | Description |
|---|---|
| **Child** | The learner — uses the child interface |
| **Parent** | Creates family account, manages child profiles, views analytics |
| **Admin** | Internal — manages content, curriculum, user support |
| **Content Creator** | Future role — teachers or writers who submit stories |

### Core Features

#### Must Have (MVP)
- Child profile with age-based curriculum placement
- Audio-visual vocabulary lessons (Stage 1)
- Alphabet module with tap-to-hear letters (Stage 2)
- 3–5 bilingual short stories with audio narration (Stage 3)
- Basic parent dashboard: streak, words learned, recent activity
- Bilingual toggle (show/hide English)

#### Should Have (V2)
- Spaced repetition review system for vocabulary
- Visual curriculum progress map
- Weekly email digest for parents
- Shareable grandparent card
- Expanded story library (10+)

#### Nice to Have (V3)
- Letter writing/tracing exercises
- Offline mode
- Multi-child support per parent account
- Teacher accounts for weekend Persian schools
- Community-submitted stories with review workflow

### Key Screens

**Onboarding (Parent)**
1. Sign up → create family profile
2. Add child: name, age, current Persian level
3. How-it-works tour
4. First lesson auto-recommended

**Child Interface**
- Home: "Continue Story", "Today's Lesson", "Play a Game"
- Story reader: large text, illustrations, tap-to-hear per word/sentence
- Lesson screen: alphabet, vocabulary, phonics — interactive
- Rewards: badges, stars, sticker collection

**Parent Interface**
- Dashboard: activity summary, streak, words learned, stories completed
- Progress detail: curriculum map by stage and lesson
- Content library: browse stories and lessons, mark favorites
- Settings: bilingual mode, daily reminders, notification preferences
- Sharing: generate progress card for grandparents

**Admin Interface** *(internal)*
- Content management: add/edit stories, lessons, vocabulary
- User management
- Analytics overview

### User Flow — First Session

```
Parent signs up
    → Creates child profile (name, age, level)
    → Sees recommended starting point
    → Hands device to child

Child opens app
    → Sees personalized home screen
    → Taps first lesson (e.g. "Animals in Persian")
    → Completes audio-visual vocab lesson (5–10 min)
    → Earns first badge

Parent receives notification
    → "Layla completed her first lesson and learned 8 new words!"
    → Opens dashboard, sees progress
```

---

## 5. Parent Dashboard — Progress & Analytics

### Metrics

**Emotional (high value, easy to understand)**
- Weekly activity summary: "Layla read 3 stories this week"
- Streak counter — consecutive days engaged
- Cumulative vocabulary count: "Layla knows 47 Persian words"
- Recent achievements and badges

**Learning (deeper insight)**
- Letters and words: introduced vs. mastered
- Time spent per session and per week
- Stories completed vs. started
- Words replayed often (struggling) vs. skipped (easy)

**Progress over time**
- Weekly/monthly summary via push notification or email
- Visual progression through curriculum stages
- Gentle expected-pace indicator

### Data Model

```
session:            { child_id, date, duration }
word_interaction:   { child_id, word_id, result: heard|recognized|mastered, timestamp }
story_interaction:  { child_id, story_id, completion_pct, replays, timestamp }
lesson_completion:  { child_id, lesson_id, score, timestamp }
```

### Design Principles

- Parent dashboard and child interface are completely separate UX experiences
- Weekly email digest — most parents won't open the app daily
- Celebrate small wins: "First story completed!", "Learned the letter Alef!"
- Never show failure directly — "5 words to practice more", not "failed 5 words"

### Grandparent Sharing

A shareable card parents can send via WhatsApp: "Layla read her first Persian story!" — low effort to build, high emotional value, and organic marketing.

---

## 6. Tech Stack

### Platform — Web First (PWA), Then Mobile

Start with a **Progressive Web App (PWA)**:
- No app store approval delay — ship faster
- Works on any device parents already have (tablet, phone, desktop)
- Can be installed on home screen like a native app
- Later wrap with React Native or Capacitor for native app stores

### Frontend

**React + Next.js**
- SSR/SSG for fast initial load
- Strong RTL support for Persian text via CSS `direction: rtl`
- Large ecosystem for audio, animation, and interactive components
- Easy deployment on Vercel

Key libraries:
- `Framer Motion` — animations and reward celebrations
- `Howler.js` — audio playback for narration and tap-to-hear
- `React Query` — data fetching and caching
- `Tailwind CSS` — fast styling with RTL support
- `Vazirmatn` — best open-source Persian web font

### Backend

**Next.js API routes** (MVP) → dedicated **Node.js/Express** service later

### Database & Infrastructure

**Supabase** (Postgres + Auth + Storage + Realtime)
- Built-in row-level security for isolating family data
- Storage bucket for audio files and images
- Auth handles parent login out of the box

### Content & Audio Delivery

| Content type | Solution |
|---|---|
| Story illustrations | Supabase Storage + CDN |
| Audio narration | Supabase Storage + CDN (human-recorded) |
| Story/lesson text | Postgres via API |
| Persian font | Vazirmatn |

### Notifications & Analytics

| Need | Tool |
|---|---|
| Email digest | Resend |
| Push notifications | PWA Web Push / OneSignal |
| Product analytics | PostHog (open source, GDPR-friendly) |

### Full Stack at a Glance

```
Frontend:   Next.js (React) + Tailwind + Framer Motion + Howler.js
Backend:    Next.js API routes → Express later
Database:   Supabase (Postgres + Auth + Storage)
Hosting:    Vercel + Supabase
Email:      Resend
Analytics:  PostHog
Font:       Vazirmatn
```

---

## 7. AI Integration

AI should be **invisible to the child** — no chatbot UI, no "AI" branding. It works silently behind the scenes to make content feel personal and lessons feel right.

### High Value — Build These

**Adaptive Learning Path**
- Tracks which words/letters a child struggles with and adjusts lesson order
- Model: spaced repetition + performance scoring (no LLM needed)

**Speech Recognition for Pronunciation**
- Child taps a word, speaks it, AI checks pronunciation
- Tool: OpenAI Whisper (open source, supports Persian/Farsi)

**Story Personalization**
- Generate story variations where the main character shares the child's name or interests
- "Layla and the dragon" instead of a generic story
- Tool: Claude API with strict Persian language + age-appropriate prompt

**Parent Q&A Assistant**
- Parents ask: "How do I help my 6-year-old practice letters at home?"
- Answers grounded in the curriculum via RAG
- Tool: Claude API over curriculum content

### Medium Value — V2

**Automatic Difficulty Assessment**
- Short adaptive quiz on signup places the child in the right stage automatically
- Model: decision tree on interaction patterns

**Narration TTS Fallback**
- Generate Persian TTS when human narration is not yet available
- Tool: ElevenLabs or Azure TTS — use as fallback only, human narration preferred

**Writing/Tracing Feedback**
- Child traces a letter, AI checks stroke quality
- Tool: TensorFlow.js (on-device, no server round-trip)

### V3

**Conversation Practice**
- Simple AI character the child can speak Persian with
- Responds simply, corrects gently, stays age-appropriate
- Requires careful prompt engineering

### AI Stack

| Use case | Tool |
|---|---|
| Story personalization, parent Q&A | Claude API (Anthropic) |
| Speech recognition | OpenAI Whisper |
| TTS narration fallback | ElevenLabs or Azure TTS |
| Adaptive learning logic | Custom (Postgres + scoring rules) |
| Writing recognition | TensorFlow.js (on-device) |

---

## 8. Hardcopy Books & eBook Reader

### eBook Reader

**Recommendation: rich story reader inside KoodakBook, not a separate app.**
- Full-screen, page-by-page, beautiful Persian typography
- Tap-to-hear per word/sentence, bilingual toggle, highlight on playback
- Works offline (PWA cache)
- Export to PDF/ePub as a bonus feature later
- Do not compete with Kindle/Apple Books — build for the Persian learning experience they can't offer

### Hardcopy Books

**Not for MVP — too much operational complexity.**

The case for physical books:
- Emotional resonance for diaspora parents who grew up with Persian books
- Screen-free reading time — something parents actively want
- Grandparents can send as a gift — strong gifting market
- QR codes inside the book link to the app for audio narration

Roadmap:
- **MVP**: "Print at home" PDF — zero cost, tests demand
- **V2/V3**: Print-on-demand via Lulu or IngramSpark
- **B2B**: Sell book bundles to weekend Persian schools

### The Hybrid Model

```
Digital app (KoodakBook)
    → Rich story reader with audio, bilingual toggle, tap-to-hear
    → Tracks reading progress, feeds parent dashboard

Printable PDF companion
    → Same story, print at home
    → QR code on each page → opens that page in app with audio

Physical book (V2/V3)
    → Premium printed version sold via website
    → QR codes → deep links into app
    → Gifting product for grandparents and B2B channel for Persian schools
```

---

## 9. Technical Specification

### 9.1 MVP Scope

**Built and shipped:**
- Parent signup, login, logout (JWT auth — self-hosted, no third-party)
- Child profile creation with age-based level placement
- Stage 1: Vocabulary lessons with tap-to-hear words and images
- Stage 2: Alphabet module (32 letters in 8 shape groups) with tap-to-hear
- Stage 3: 5 bilingual short stories with per-page audio and bilingual toggle
- Progress tracking (words, lessons, stories, sessions)
- Badge/reward system (5 milestone badges with animated popup)
- Parent dashboard: streak, words learned, stories completed, lessons completed
- Parent progress detail: words by mastery status, lesson history, story history, sessions
- Admin panel (port 3001, localhost only): words, stories + pages, letters, lesson items — all with file upload
- PWA manifest + icons (installable on mobile)
- Docker dev setup (hot reload, persistent volumes)
- Docker prod setup (Nginx reverse proxy, Let's Encrypt SSL)

**Deferred to V2:**
- Speech recognition for pronunciation checking
- AI story personalization (Claude API)
- Spaced repetition engine
- Letter writing/tracing
- Multi-child profiles per parent
- Offline mode
- Email digest for parents
- Grandparent share card

---

### 9.2 Database Schema

#### users
```
id            uuid        PK (managed by Supabase Auth)
email         text        UNIQUE NOT NULL
created_at    timestamptz DEFAULT now()
```

#### children
```
id            uuid        PK DEFAULT gen_random_uuid()
parent_id     uuid        FK → users.id ON DELETE CASCADE
name          text        NOT NULL
birth_year    int
level         int         DEFAULT 1  -- 1=Stage1, 2=Stage2, 3=Stage3, 4=Stage4
avatar_url    text
created_at    timestamptz DEFAULT now()
```

#### words
```
id            uuid        PK DEFAULT gen_random_uuid()
persian       text        NOT NULL
english       text        NOT NULL
finglish      text
category      text        -- animals, colors, family, food, body
stage         int         DEFAULT 1
audio_url     text
image_url     text
```

#### letters
```
id            uuid        PK DEFAULT gen_random_uuid()
character     text        NOT NULL  -- e.g. "ا"
name_persian  text        NOT NULL  -- e.g. "الف"
name_english  text        NOT NULL  -- e.g. "Alef"
group         int         -- shape similarity group (1–8)
order_in_group int
audio_url     text
example_word_id uuid      FK → words.id
```

#### lessons
```
id            uuid        PK DEFAULT gen_random_uuid()
title         text        NOT NULL
type          text        NOT NULL  -- vocabulary | alphabet | phonics
stage         int         NOT NULL
order_index   int         NOT NULL
description   text
thumbnail_url text
```

#### lesson_items
```
id            uuid        PK DEFAULT gen_random_uuid()
lesson_id     uuid        FK → lessons.id ON DELETE CASCADE
item_type     text        NOT NULL  -- word | letter
word_id       uuid        FK → words.id
letter_id     uuid        FK → letters.id
order_index   int         NOT NULL
```

#### stories
```
id            uuid        PK DEFAULT gen_random_uuid()
title_persian text        NOT NULL
title_english text        NOT NULL
stage         int         NOT NULL
age_min       int
age_max       int
cover_url     text
pdf_url       text
audio_url     text        -- full narration
created_at    timestamptz DEFAULT now()
```

#### story_pages
```
id            uuid        PK DEFAULT gen_random_uuid()
story_id      uuid        FK → stories.id ON DELETE CASCADE
page_number   int         NOT NULL
text_persian  text        NOT NULL
text_english  text
image_url     text
audio_url     text        -- per-page narration
```

#### story_page_words
```
id            uuid        PK DEFAULT gen_random_uuid()
page_id       uuid        FK → story_pages.id ON DELETE CASCADE
word_id       uuid        FK → words.id
position      int         -- word order on page, for tap-to-hear mapping
```

#### child_sessions
```
id            uuid        PK DEFAULT gen_random_uuid()
child_id      uuid        FK → children.id ON DELETE CASCADE
started_at    timestamptz DEFAULT now()
ended_at      timestamptz
duration_sec  int
```

#### child_word_progress
```
id            uuid        PK DEFAULT gen_random_uuid()
child_id      uuid        FK → children.id ON DELETE CASCADE
word_id       uuid        FK → words.id
status        text        DEFAULT 'introduced'  -- introduced | practiced | mastered
introduced_at timestamptz DEFAULT now()
mastered_at   timestamptz
replay_count  int         DEFAULT 0
UNIQUE (child_id, word_id)
```

#### child_lesson_progress
```
id            uuid        PK DEFAULT gen_random_uuid()
child_id      uuid        FK → children.id ON DELETE CASCADE
lesson_id     uuid        FK → lessons.id
completed     boolean     DEFAULT false
score         int         -- 0-100
completed_at  timestamptz
UNIQUE (child_id, lesson_id)
```

#### child_story_progress
```
id            uuid        PK DEFAULT gen_random_uuid()
child_id      uuid        FK → children.id ON DELETE CASCADE
story_id      uuid        FK → stories.id
last_page     int         DEFAULT 0
completed     boolean     DEFAULT false
replay_count  int         DEFAULT 0
last_read_at  timestamptz DEFAULT now()
UNIQUE (child_id, story_id)
```

#### badges
```
id            uuid        PK DEFAULT gen_random_uuid()
key           text        UNIQUE NOT NULL  -- first_lesson, first_story, 10_words, 7_day_streak, all_alphabet
title         text        NOT NULL
description   text
image_url     text
```

#### child_badges
```
id            uuid        PK DEFAULT gen_random_uuid()
child_id      uuid        FK → children.id ON DELETE CASCADE
badge_id      uuid        FK → badges.id
earned_at     timestamptz DEFAULT now()
UNIQUE (child_id, badge_id)
```

---

### 9.3 Auth Flow

```
Parent visits app
    → Sign up with email + password → bcryptjs hash stored in users table
    → JWT token returned, stored in localStorage
    → Redirected to onboarding

Onboarding
    → Create child profile (name, birth year, level)
    → Stored in children table with parent_id from JWT

Subsequent visits
    → JWT sent as Authorization: Bearer header on every API request
    → Express middleware verifies token, attaches userId to request
    → Child interface loaded if child profile exists

Admin access
    → Same JWT auth, but backend checks email === ADMIN_EMAIL env var
    → Admin panel on port 3001 (localhost only, SSH tunnel in production)
    → Admin account auto-created on backend startup from ADMIN_EMAIL + ADMIN_PASSWORD env vars
```

---

### 9.4 API Design

All routes under `/api/`. Auth via `Authorization: Bearer <JWT>` header.

#### Auth
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
```

#### Children
```
GET    /api/children
POST   /api/children
PATCH  /api/children/:id
```

#### Curriculum (public read)
```
GET    /api/lessons
GET    /api/lessons/:id
GET    /api/stories
GET    /api/stories/:id
GET    /api/words/:id
GET    /api/letters
```

#### Progress
```
POST   /api/progress/sessions/start
POST   /api/progress/sessions/:id/end
POST   /api/progress/word
POST   /api/progress/lesson
POST   /api/progress/story
GET    /api/progress/:child_id
```

#### Dashboard
```
GET    /api/dashboard/:child_id
GET    /api/badges/:child_id
```

#### Admin (ADMIN_EMAIL only)
```
GET    /api/admin/me
GET    /api/admin/stats
POST   /api/admin/upload/:type        (audio | images | pdfs)
GET/POST/PATCH/DELETE  /api/admin/words
GET/POST/PATCH/DELETE  /api/admin/stories
GET/POST/PATCH/DELETE  /api/admin/stories/:id/pages
GET/POST/DELETE/PATCH  /api/admin/lessons/:id/items
PATCH  /api/admin/letters/:id
```

---

### 9.5 Monorepo Structure

```
apps/
├── web/        Next.js PWA — child interface + parent dashboard (port 3000)
├── admin/      Next.js admin panel — content management (port 3001, localhost only)
├── backend/    Express API — all business logic and DB access (port 4000)
└── mobile/     React Native placeholder (Expo) — V2

packages/
└── shared/     TypeScript types and constants shared across apps

supabase/
├── migrations/001_schema.sql
└── seed.sql
```

#### apps/web key pages
```
(auth)/login, (auth)/signup
onboarding/
child/home, child/lesson, child/lesson/[id], child/story, child/story/[id], child/rewards
parent/dashboard, parent/progress, parent/settings
```

#### apps/admin key pages
```
login/
dashboard/ (stats)
dashboard/lessons (assign words/letters to lessons)
dashboard/stories (create stories + pages with audio/images)
dashboard/words (add/edit words with audio/images)
dashboard/letters (upload audio per letter)
```

---

### 9.6 Deployment & Environment

#### Environment Variables (root .env for Docker)
```
DB_PASSWORD              PostgreSQL password
JWT_SECRET               Min 48-char random string
WEB_URL                  https://yourdomain.com
NEXT_PUBLIC_BACKEND_URL  https://api.yourdomain.com
ADMIN_EMAIL              Admin account email
ADMIN_PASSWORD           Admin account password
DOMAIN                   yourdomain.com
```

#### Environments
```
dev   → docker compose -f docker-compose.dev.yml up   (hot reload)
prod  → docker compose -f docker-compose.prod.yml up  (built images + Nginx + SSL)
```

#### Production Stack
```
Nginx (80/443) → Web (port 3000) + Backend API (port 4000)
Admin panel    → port 3001, localhost only, SSH tunnel access
PostgreSQL     → internal Docker network only
File uploads   → /app/uploads volume, served via Nginx /uploads/
```

See DEPLOY.md for full step-by-step deployment instructions.

---

## 10. Current Status

MVP is fully built and running. All core features are implemented.

### ✅ Done
- Auth, onboarding, child profiles (multiple children per parent)
- Vocabulary lessons + alphabet module with tap-to-hear
- Phonics / short-vowel module (the alphabet→reading bridge)
- Story reader with bilingual toggle and per-page audio
- Progress tracking (words, lessons, stories, sessions)
- Real Leitner spaced-repetition engine (boxes + review scheduling)
- Badge/reward system (5 badges)
- Parent dashboard + detailed progress report
- Grandparent share card + weekly progress digest email
- Neural / recorded Persian audio (recorded preferred, no Arabic TTS fallback)
- i18n foundation: language-agnostic content model with dual-write (Phases 1–2)
- Admin panel (port 3001): words, stories, letters, lesson items, file uploads
- PWA icons and manifest
- Docker dev (hot reload) + prod (Nginx + SSL)
- Deployment guide (DEPLOY.md) + deploy.sh (auto-migrate/seed)
- Playwright E2E suite (smoke + learning-loop + UI journeys) and ACM pipeline (e2e → deploy), invoked explicitly — merging to main does not deploy (see CONTRIBUTING.md "Deploy model")
- Content audit pass (migrations 011–013): fixed transliteration/gloss/register
  and kinship defects, added 7 Critical categories (opposites, question words,
  prepositions, clothes, transportation, weather, school) + numbers 11–20,
  rewrote 5 weak stories to a Hook→…→Recap structure with child interaction.
  Now ~189 words / 19 categories / 28 lessons / 15 stories / 94 pages.
- **v2 Phase-A foundations (code):** receptive/productive Leitner split + mastery
  state machine (mig-016, additive over 006; `/word` route maintains both tracks,
  `track:'productive'` from the speak page); content-scaling spine `content_items`
  + versioned `audio_assets` with provenance (mig-017, additive, backfilled from
  existing content); parent door moved out of the child grid to a 700ms
  hold-to-enter corner gate. See §11 for the full v2→v3 plan.
- **v2 reader cutover (code):** parent dashboard + progress now surface the
  4-state mastery model (consolidated/mastered/practicing/introduced) with a
  segmented breakdown; curriculum + review endpoints resolve each entity's
  `audio_url` from the primary `audio_asset` via `primary_audio()` (mig-018),
  so a native recording hot-swaps the TTS bootstrap with no further code change.
  A trigger (mig-019) mirrors any `*.audio_url` insert/update into `audio_assets`
  as the new primary, so the existing admin upload UI drives the hot-swap with no
  per-handler code. Round-trip verified live: editing a word's audio_url makes
  the resolver serve the new file and demotes the prior take to history.
- **v2 placement probe (code):** onboarding's self-declared level is replaced by
  a measured heuristic probe (mig-020, `/api/placement/probe` + `/result`):
  4 stage-gated, audio-first items (V→D→F→C) built from existing words+letters,
  adaptive stop-on-first-miss, writing `children.level` + per-strand
  `child_strand_levels`. Verified end-to-end on the server.
- **v2 per-strand content gating (code):** the child home and lesson list now
  read `child_strand_levels` (via `GET /api/placement/:child_id`) and lock/order
  lessons & stories per strand (vocabulary→V, alphabet/phonics→D; stories→F/C,
  unlocked two stages early as audio-supported input). Verified live: a high-V /
  low-D heritage profile unlocks vocabulary while the alphabet (the D-strand
  growth edge) is its next step — differentiation a single `children.level`
  could not express. Unlock rule: a strand at level L opens content through
  stage L+1.
- **v2 strand promotion (code):** `promoteStrands()` runs on lesson/story
  completion — clearing ≥85% of a strand's unlocked content raises that strand
  one level (only when the next stage adds content, so thin content settles at
  "cleared everything available" rather than inflating to 4; floor = placement).
  Completion screens celebrate "🔓 new content unlocked." Verified live: clearing
  7/8 alphabet lessons promoted D 1→2 and stopped there. This closes the
  progression loop: probe → gate → master → promote → unlock.
- **v2 pilot instrumentation (code):** `placement_history` snapshots (mig-021,
  written on every probe result) make pre/post literacy gain measurable;
  `GET /api/admin/pilot-metrics` derives the §11.5 funnel from existing tables
  (activation = completed a stage-3 story; weekly retention W1–4 with eligibility
  windows; engagement; avg level gain); the admin "پایلوت" page renders it with
  the target gates (activation ≥60%, W4 retention ≥40%) colored pass/fail.
  Verified live (endpoint 200 + correct funnel, admin page 200).

### 🔜 Next — Content & Beta

- [ ] Partner with a Persian language teacher to validate curriculum structure
- [ ] Source or commission original Persian children's stories
- [ ] Record audio narrations with a native Persian voice actor
- [ ] **Beta blocker (content production, not data):** word/story images are
      still ~0 (everything renders via emoji fallback). Audio now exists for all
      words/letters/pages but is **neural TTS, not native voice** — the
      `audio_assets` hot-swap path (mig-017/019) is built and waiting for native
      takes, which supersede the TTS automatically on upload.
- [ ] Upload word **images** via admin panel (audio is wired; native audio swaps in via `audio_assets`)
- [ ] Cross-device testing (iOS Safari, Android Chrome)
- [ ] RTL layout QA on all screens
- [x] Deploy to production server — running on the LAN server via ACM (web/backend/admin/db)
- [ ] Recruit first 10 diaspora families for beta testing

### 🔮 V2 Roadmap
- Speech recognition for pronunciation (OpenAI Whisper)
- AI story personalization (Claude API)
- Offline mode (PWA service worker)
- Physical book + QR code integration
- Teacher accounts for weekend Persian schools

---

## 11. v2 → v3 Evolution Plan

> From "MVP that demos" to "validated, adaptive heritage-literacy system."
> Designed as a product *system*, not a feature list. Sequenced so the loop is
> proven on a small, gorgeous slice **before** content is scaled.

### 11.0 Direction

| | v2 — "Complete the Slice" | v3 — "Adaptive Heritage Literacy System" |
|---|---|---|
| Thesis | Depth over breadth: make the existing slice illustrated, native-voiced, validated | Scale content + adaptivity + multi-locale + B2B on a proven loop |
| Content | ~300 items, fully illustrated + native-voiced | 2,000–5,000 items via hybrid AI+human pipeline |
| Engine | Per-strand mastery + adaptive placement | Full adaptive sequencing + comprehension diagnostics |

**North-star metric (NSM):** number of children who **independently read a Stage-3
story aloud** — not words learned, not minutes.

**Value reframe:** turn *"my kid understands but can't read Persian"* into
*"my kid just read me a story"* — and show the parent it's working the whole way.

### 11.1 Learning System Architecture

**Braided strands** replace the single coarse `children.level` (1–4):

```
P  Phonological Awareness  → unlocks D
D  Decoding (script)       → unlocks F (per grapheme set)
V  Vocabulary (receptive + productive)   → feeds F & C
F  Fluency                 → unlocks C
C  Comprehension           → NSM
```

Controllable-text invariant: **a story only contains graphemes the child has
decoded (D) and words ≥80% receptively known (V).** This makes both the learner
experience and the content generator tractable.

**Spaced repetition upgrade** (extends Leitner mig-006):
- Split **receptive** (`box_receptive`) vs **productive** (`box_productive`) memory.
- Mastery state machine: `introduced → practicing → mastered → consolidated`,
  with promotion/demotion rules. Productive track *enriches* mastery, never *gates*
  it (ASR is unreliable on Persian/iOS — the loop must never stall on tech limits).

**Adaptive placement** replaces self-declared level: parent cold-start prior →
≤90s audio-first adaptive probe → continuous per-strand recalibration.

**Unlock is mastery-driven, not completion-driven** (you cannot click through).

### 11.2 Content Scaling (200 → 2,000–5,000)

Principle: **AI proposes, native speaker + pedagogue dispose.** The existing
`animation_review` (pending→approved/rejected) + `animation_model`/`engine_version`
columns (mig-014) are already the audit trail for exactly this.

- **Typed content spine** (`content_items`): kind, strand, difficulty vector,
  graphemes/phonemes, frequency_rank, cultural_tags, prereq DAG. Localized text
  stays in `content_translations` (mig-009); audio moves to versioned `audio_assets`.
- **Illustration system:** flat-vector + gouache texture, token-driven palette,
  recurring cast library, `image_brief` schema + conformance check, cultural flags
  (Persian-diaspora identity, no nationalist/religious iconography).
- **Story generator** constrained by the learner model: controlled vocabulary +
  controlled script + house Hook→…→Recap structure → linter → native polish.
- **Audio split rule:** native human for anything judged by ear or imitated
  (stories, core 500 words, letters, phonics); TTS for long-tail + AI-personalized
  stories. `audio_assets` stores provenance and supports hot-swap (TTS → native).

### 11.3 Retention (constrained: ages 3–12, not over-gamified, outcome-aligned)

- **Forgiving streaks:** count days a *learning goal* was met; miss → streak
  *pauses* (practice-debt), never resets. Parent-pausable (travel mode).
- **Mastery-gated rewards:** a collectible unlocks only when a category reaches
  ≥85% mastered — rewards signal learning, not engagement-bait.
- **Grandparent read-aloud loop** is the real moat: child reads → "record for
  Grandma?" → share → grandparent reacts → parent re-engages → renews.

### 11.4 Monetization (reads `users.plan` / `plan_expires_at`, mig-008)

Free tier must deliver **one genuine "my kid read to me" moment** (the proof that
converts); gate *scale*, not the aha. Triggers fire on emotional highs (post-NSM
unlock), never on frustration walls. Annual-default pricing anchored to heritage
value; grandparent **gift** tier via `plan_expires_at`. B2B: seat-licensed school
plan reusing `content_items`.

### 11.5 Validation (non-negotiable gate before scaling)

10-family, 6-week design-partner pilot. Pre/post decoding + receptive-vocab probes.
**Gates to scale:** activation (first read-aloud) ≥60%, W4 retention ≥40%,
meaningful literacy gain, session completion ≥70%, WTP ≥40%.
**Do NOT build until validated:** 2k-item scaling, multi-locale, native mobile app,
Whisper/server-ASR, stroke-scoring, B2B dashboards, print-on-demand.

### 11.6 Phased Execution (ranked by impact × risk-reduction ÷ effort)

**Phase A — 0–30 days · "Make the slice real" (fixes)**
- [ ] Commission + integrate illustrations for core ~150 words + 5 story covers *(content production)*
- [ ] Record native voice for those 150 words + 5 stories; wire `audio_assets` swap *(content production)*
- [x] Move parent door out of the child grid → discreet hold-to-enter corner gate *(code)*
- [x] Mastery state machine + receptive/productive Leitner split — schema + route wiring *(code, mig-016)*
- [x] Content-scaling foundation: `content_items` spine + versioned `audio_assets` *(code, mig-017)*
- [ ] **[OPS] Backup sidecar is currently DISABLED — no restore point exists** —
      `db-backup`/`db-drill` are gated behind Compose profile `backup` (not in the
      default profile set), so a plain `docker compose up` — what the ACM pipeline
      runs — starts neither service. Deliberate, reversible (2026-08-09): the offsite
      destination (R2/S3-compatible) was never provisioned, so keeping the sidecar
      "on" in local-only mode was giving false confidence — local-only is not a
      restore point against disk failure. **While this is off: no backup of any
      kind, offsite or local. A bad migration, an accidental `DELETE`, or a disk
      failure is unrecoverable.** Re-enable: set `COMPOSE_PROFILES=backup` in ACM
      plus `AGE_RECIPIENT`, `BACKUP_DB_PASSWORD`, `DRILL_PGPASSWORD`,
      `HEARTBEAT_BACKUP_URL`, `HEARTBEAT_DRILL_URL`, then redeploy — see
      `docker/db-backup/README.md`. The three DB/encryption vars are soft-defaulted
      in `docker-compose.yml` only so `docker compose config` resolves cleanly with
      the profile inactive; `lib.sh:require_backup_config()` still hard-fails at
      runtime the moment the profile is active and any of them is blank, so this
      can't silently degrade into a fake backup. **PR #1 already merged with
      this off — see below, urgent, not just a pre-merge gate.**
- [ ] **[URGENT] PR #1 (Piper removal / collapse audio to single cloud tier,
      migration 048) merged into `main` 2026-08-09 while the backup sidecar was
      disabled** — migration 048 dropped/folded the free/premium audio columns
      irreversibly (see commit 07772ba), and per the item directly above there is
      currently no restore point, offsite or local, to fall back to if anything
      about that fold turns out wrong once deployed. This is no longer a
      pre-merge gate — it already happened. **Re-enabling the backup sidecar
      (`COMPOSE_PROFILES=backup` + the five vars) and exercising a verified
      restore is now a priority, not a precondition.**
- [ ] **[CORRECTION] "Held at approve-prod" was never the protection for KoodakBook
      deploys — the gated pipeline is not how deploys actually happen here.**
      Verified 2026-08-09 from ACM's own request logs: every KoodakBook deploy since
      at least 2026-06-01 (and 048/049's unreviewed production run) went through the
      ACM dashboard's **Deploy / Sync & Deploy buttons**, which call
      `projectService.deployProject()` **directly** — a code path entirely separate
      from `pipeline-service.ts`'s DAG (`quality` → `e2e` → `approve-prod` → `deploy`).
      `pipeline_runs` has effectively no rows for this project because the gated path
      has gone essentially unused; the raw dashboard button is the actual, habitual
      deploy mechanism. The gate itself checks out — `when: manual` stages genuinely
      pause on `resolveApproval()` — but it was never in the loop, so any merge-order
      or release planning that assumed "won't ship until approve-prod" gave zero
      actual protection. Reassess anything on this roadmap phased around that
      assumption; if approve-prod is meant to be a real gate, either the dashboard's
      raw deploy buttons need to require going through the pipeline, or they need to
      be removed/restricted.
      *(ops/security — incident review 2026-08-09, migration-048 causation investigation)*
- [x] **[SECURITY] Deploy concurrency lock — top of the ACM hardening list, above
      the loopback binds below.** Root cause of the unreviewed 048/049 production
      run (2026-08-09): `projectService.deployProject()` has no in-flight guard —
      repeated clicks on the dashboard's Deploy/Sync-Deploy button (confirmed via
      request logs: two calls 36ms apart, both failing "Service db Building," a
      third succeeding and applying the migrations) fire fully independent,
      concurrent `docker compose up -d --build` runs against the same project, with
      no server-side rejection. **Implemented 2026-08-09:**
      1. Server-side in-flight guard in `deployProject()` (in-memory
         `inFlightDeploys: Map`, check-then-set with no `await` in between — atomic
         against Node's single-threaded event loop) — throws `DeployInProgressError`,
         translated to `409` in both `/projects/:name/deploy` and `/sync-deploy`
         routes. Chose in-memory over the persisted `project.status` field because
         `reconcileStatus()` explicitly skips reconciling a stale `"building"` value
         after an ACM crash/restart — a persisted lock could self-lock a project
         forever; an in-memory one clears naturally on restart. Lives inside
         `deployProject()` itself, so the unauthenticated `:5003` MCP
         `deploy_project`/`sync_project` tools and any webhook/script caller hit the
         same guard, not just the dashboard button.
      2. Client-side: `setPending(projectName, "deploying")` moved to the first line
         of `handleSyncDeploy`/`handleDeployProject` in `Projects.tsx`, before the
         `await checkPortConflicts()` call — closes the double-click window that
         actually caused the incident (the disabled-button guard existed already,
         but arrived after that network round-trip, not before it).
      3. **Deliberately NOT covered — flag if it ever changes:** the gated
         pipeline's own `deploy` stage (`pipeline-service.ts`) runs through a
         separate `spawn()` call, not `projectService.deployProject()`, so it does
         not hit this lock. Left uncovered on purpose here, not missed — the gated
         pipeline is unused for KoodakBook (see the CORRECTION item above), so
         there's nothing today that races through it. If the gated pipeline is ever
         put back into real use, this lock needs extending to cover that path too.
      4. Not yet audited: whether the same unlocked pattern exists on other
         mutating operations (`stopProject`, `restartEnvironment`, rollback,
         `pullLatestProject` standalone) — out of scope for this pass, called out
         separately in case it's picked up later.
      *(ops/security — incident review 2026-08-09, migration-048 causation investigation)*
- [x] **[SECURITY] Fail-open login gate — `/api/settings` sits behind the same
      auth middleware it's used to detect.** `App.tsx` decides whether to render
      the Login screen by first calling `GET /api/settings` to read
      `security.requireAuth`. Once `requireAuth` is actually on, an unauthenticated
      browser gets a `401 {success:false}` from that same call — `result.data` is
      `undefined`, so `result.data?.security?.requireAuth === true` evaluates to
      `false`, and the app concludes auth isn't required and renders the full
      dashboard instead of Login. Every subsequent data call then 401s silently —
      a broken/blank dashboard, not a login prompt. One-line fix: treat any
      non-2xx response from `/api/settings` as "assume auth is required" (fail
      closed), not the current fail-open default. Rides with the concurrency-lock
      work since both need a rebuild. *(found 2026-08-09 enabling requireAuth
      as part of the migration-048 incident response; fixed 2026-08-09 — `App.tsx`
      now sets `requireAuth = true` on any non-2xx or network-error response from
      `/api/settings`, rather than defaulting to `false`)*
- [ ] **[SECURITY] `security.maxLoginAttempts` is a dead setting — defined,
      rendered, editable, enforces nothing.** `settings-service.ts` defaults it to
      `5`; `Settings.tsx:633` renders it as a live numeric field a user can edit
      and save; grepped the entire backend and it is never read anywhere —
      `auth-service.ts` has no failed-attempt counter or lockout logic at all.
      Worse than not offering it: it implies account lockout is configured when
      nothing enforces it. **Recommendation: remove it from the settings surface**
      rather than wire up real lockout — implementing actual lockout (counters,
      unlock windows, interaction with password-change/session-revoke) is new
      security behavior needing its own review, not a fix that rides along with
      the other three items here. Hiding the dead control is the safe immediate
      move; scope real lockout separately later if wanted. *(found 2026-08-09,
      same pass as the fail-open login gate above)*
- [ ] **[RELIABILITY] ACM's tunnel feature is structurally unsafe as built —
      recommend removing it, not fixing it.** `tunnel-service.ts` runs each
      named Cloudflare tunnel's connector as a **child process of the ACM
      container itself** (`spawn("cloudflared", ...)`), and persists connector
      tokens to `tunnels.db` at a path (`/app/data/...`) that is **not** one of
      the compose bind mounts (only `/data/projects` and `/data/db` are
      mounted). Recreating the ACM container therefore kills every connector
      *and* wipes the only copy of the tokens needed to relaunch them — which
      is exactly what happened on 2026-08-09 when the concurrency-lock rebuild
      took `koodakbook.eu.cc`, `trainova.eu.cc`, and `afzali.eu.cc` all offline
      simultaneously with no automatic recovery (the underlying app containers
      never went down — only the public routing did). Tunnel routing/DNS/
      ingress on Cloudflare's side was untouched throughout — only the local
      credential was lost, confirming the token, not the tunnel, is the single
      point of failure. **Recommendation: remove the feature** rather than
      rearchitect it. Fixing it properly would mean (1) managing cloudflared
      as real Docker containers via the Docker API instead of spawning child
      processes, (2) moving `tunnels.db` onto a bind mount, and (3) requiring a
      configured Cloudflare API token so ACM can self-heal tokens — which is a
      non-trivial rearchitecture that ends up reimplementing the exact pattern
      being adopted instead: independent `cloudflared` containers per tunnel,
      `restart: unless-stopped`, tokens in `.env`, managed directly in
      `docker-compose.yml` outside ACM entirely. Keeping a second, ACM-native
      way to manage the same tunnels is pure drift risk with no upside once the
      manual path is in place — remove or clearly disable the in-app tunnel
      UI so nobody reaches for it and gets burned the same way.
      *(found + fixed via independent containers 2026-08-09/10, during the
      concurrency-lock rebuild's fallout)*
- [ ] **[SECURITY] Lock down the ACM control plane + UI + Redis** — Advanced
      Container Manager publishes three services to `0.0.0.0` with **no auth**, all
      reachable by anything on the LAN (and one stray tunnel-ingress edit from the
      public internet). Verified server-side 2026-08-08. **Tracked here on purpose:**
      the ACM repo (`hamedafzali/AdvancedContainerManager`) is **public**, so a
      world-readable issue describing an unauthenticated control plane is a roadmap
      for anyone who locates the box — this stays in the private roadmap. The fix
      itself lands in the ACM repo, outside KoodakBook's branch/PR flow (see sequencing).
      - **`:5003` backend — unauthenticated `/mcp`.** The deploy/stop/restart/logs/exec
        MCP surface is mounted at the app level (`backend/src/index.ts`
        `this.app.post("/mcp", …)`), *separate from and before* the authed `/api`
        router. The auth middleware lives inside `/api` and is itself gated by a
        `security.requireAuth` setting — so **`/mcp` is not covered even when that
        toggle is on**. Keys-to-the-kingdom: an unauthenticated *deploy* API.
      - **`:3000` frontend** — `vite preview --host 0.0.0.0`, management UI, no gate.
      - **`:6379` Redis** (`advanced-manager-redis`) — published `0.0.0.0`, **no
        `requirepass`**. Contents are metrics-only (`advanced_manager:system:metrics`),
        no secrets/sessions/tokens — but still an open, writable cache on the LAN.
      - **At-rest encryption exists but is not the protection here.** Project env vars
        are AES-256-GCM encrypted (`backend/src/utils/encryption.ts`) in
        `manager.sqlite`; auth sessions live in the same sqlite; Redis holds no secrets.
        **But** the key (`data/db/.encryption.key`, `0600`) sits in the same dir as the
        DB, and the API/MCP layer **decrypts on read** — so an unauthenticated caller
        that reaches the control plane retrieves *plaintext* regardless. At-rest
        encryption is not a substitute for network/auth controls; harden those first.
        Consequence for provisioning: anything pasted into ACM variables (R2 creds,
        DB passwords, and esp. the age backup key) is LAN-retrievable in plaintext
        until `:5003` is closed.
      - **Remediation.** *Option 1 (now, reversible):* loopback-bind `5003`+`3000`+`6379`
        in ACM's `docker-compose.yml` (`127.0.0.1:…`) + `docker compose up -d`; off-host
        access becomes SSH-tunnel only. Set Redis `requirepass` in the same edit. No
        code change; revert = edit + recreate. Verified unaffected: the backend
        healthcheck is container-internal, inter-project probing is outbound, and no
        other project connects to the control plane (only a commented example).
        *Option 2 (follow-up, code change):* auth middleware in front of the app-level
        `/mcp` mount so it's protected independently of `security.requireAuth`; MCP
        clients send a bearer token. *Option 3:* Cloudflare Access only if it must be
        remotely reachable — adds a public surface where none exists today, so avoid
        unless needed.
      - **Sequencing.** Option 1 before Option 2 (don't change the control plane's auth
        and its bind at once). Apply host-side (compose edit + `up -d`), **not** through
        ACM's own pipeline — don't depend on the control plane to reconfigure itself.
        Fold in before provisioning R2/age/DB secrets and before the pilot opens.
      *(ops/security — Finding A, tunnel/auth audit 2026-08; verified 2026-08-08.
      Loopback hardening for KoodakBook's own ports was done separately via
      docker-compose.override.yml, branch `harden-loopback-binds`)*
- [ ] **[SECURITY] Stop passing the tunnel token on the cloudflared command line** —
      the three `cloudflared … run --token <JWT>` processes expose the full tunnel
      credentials in `ps`, on a host shared with ~10 other projects. Any account that
      can read the process list gets a token that is sufficient to run the connector
      for our tunnels. Fix: invoke cloudflared with a **credentials-file** (or an
      `--token`-from-env-file / systemd `EnvironmentFile`) instead of the token as an
      argv, so it never appears in `ps`. Do this the next time the tunnel config is
      touched; rotate the tokens afterward since the old ones were exposed.
      *(ops/security — tunnel/auth audit 2026-08, sibling of the ACM item above)*
      **[DEFERRED 2026-08-10]** The three connector tokens also leaked into chat
      twice during the 2026-08-09/10 outage response (extracted for the ad hoc →
      compose-managed tunnel migration). Rotation is **not** in-place — Cloudflare
      only supports invalidating a leaked token by deleting the tunnel object and
      creating a new one, which means real downtime on all three sites for the
      window between delete and the new tunnel's DNS/ingress being live. Given the
      exposure is bounded (chat history only, not a public leak) and the three
      sites just came back from an extended 502 outage, the user chose to defer
      rather than trade a known-bounded exposure for guaranteed fresh downtime.
      **Do this together with the argv fix above** — both need a tunnel
      delete/recreate, so batch them into one maintenance window instead of two.
      See the chat-history session for exactly which commit exposed the tokens
      and the step-by-step Cloudflare-dashboard recreate sequence.
- [ ] **[DECISION] Reconcile or delete `docker-compose.prod.yml`** — it reads like
      the production compose file but is **dormant**: the pipeline deploys plain
      `docker compose up` (docker-compose.yml + docker-compose.override.yml), never
      this file. It has drifted into a different, pre-tunnel architecture — stock db
      image + `DB_PASSWORD` rename, **no piper service / no `PIPER_URL`**, no cloud-TTS
      keys, `NEXT_PUBLIC_BACKEND_URL` browser-direct model, an nginx+Let's Encrypt TLS
      terminator that conflicts with the cloudflared tunnel, and it drops web's
      published port so host 3001 becomes admin — which would make the pipeline health
      gate (`localhost:3001/api/lessons`) 404 and **trip rollback if anyone "cleaned
      up" by switching the deploy to it**. This is a decision, not a task: either
      reconcile it to the live topology (tunnel, piper, TTS keys, 3001=web) or delete
      it. "It's dormant" is not discoverable from reading the file — that's the trap.
      *(ops — tunnel/auth audit 2026-08; loopback hardening was done via
      docker-compose.override.yml instead, see branch `harden-loopback-binds`)*
- [ ] **Progression rebuild** — evidence-recompute gate replacing the ratcheting
      promotion (BUG-C): mastery-gated unlock, bidirectional (damped) gate, placement
      as a decaying prior, `gate_recompute_log` instrumentation *(code, mig-049
      `049_gate_prior_split.sql`; branch `progression-rebuild-impl`, stacks on
      tier2/PR#2; design `docs/placement-progression-rebuild.md`. Blast-radius
      reviewed on live data (n=2, test children — mechanism validated, cohort-scale
      behavior unmeasured; see Phase B re-run item). Merge order: PR#2 → this → PR#3.
      Now merged to main; merging changed nothing in prod — it ships on the next
      explicit ACM deploy, which pushes whatever main then holds. See the deploy
      model in CONTRIBUTING.md.)*
- **Gate:** one polished, voiced, illustrated Stage-1→3 path exists.

**Phase B — 30–90 days · "Prove the engine" (system + pilot)**
- [x] Pilot instrumentation — `GET /api/admin/pilot-metrics` + admin "پایلوت"
      page render the §11.5 funnel (activation/NSM, weekly retention, engagement,
      literacy gain) from existing tables + `placement_history` snapshots
      (mig-021). Verified live. *Still needed: recruit the 10 families + run it.*
- [x] Pilot run-book (`docs/pilot-runbook.md`) — recruitment screener, pre/post
      probe protocol, weekly check-in scripts, tracking sheet, and the go/no-go
      decision rule against the §11.5 gates. The validation is now runnable.
- [x] ~~Adaptive~~ heuristic placement probe (replace self-declared level) —
      mig-020 + `/api/placement/*`; onboarding routes to a 4-item audio-first
      probe (V→D→F→C) that sets `children.level` + per-strand `child_strand_levels`.
      Verified end-to-end (heritage profile captured as high-V / low-D). Upgrade
      to IRT-adaptive once pilot data calibrates `content_items.difficulty`.
- [ ] **Per-letter mastery tracking** (SR for letters, as words have) — unblocks
      D-strand *mastery* gating (today D falls back to completion, so a phonics
      lesson clicked-through still gates the child up — the exact weakness the
      progression rebuild fixes for V/F) **and** a per-strand prior half-life `k`.
      Tracked gap, not a footnote — see `docs/placement-progression-rebuild.md` §7
      (A8/A9). *(code + schema)*
- [ ] **Re-run `gateBlastRadius` against a real pilot cohort** (≥20 children with
      genuine usage history). The pre-merge prod run was **n=2** (test children):
      it established that the recompute *executes correctly against live data and
      behaves as designed*, and **nothing more**. It did NOT answer the original
      distribution question ("does this move a few children by one stage or most by
      three") — that question is only answerable at cohort scale — **and** it did
      NOT exercise the A8/A9 D-strand completion-fallback gap in either direction
      (no child had contradicting phonics-completion history). This re-run is the
      point at which (a) the distribution question becomes answerable and (b) the
      D-strand gap will surface or not. Do not remember the n=2 run as having
      cleared either. Script is committed + read-only (`apps/backend/src/scripts/
      gateBlastRadius.ts`, `'placement'` prior mode). *(ops)*
- [ ] Own numeracy difficulty track — decouple math/memory-game difficulty from
      `children.level` (the literacy coarse level), so a strong-at-math /
      still-learning-to-read heritage child is not mis-served (rebuild §6.2). *(code)*
- [ ] Session engine (Warm-up→Teach→Apply→Stretch→Win) + journey-map child UX
- [ ] Parent literacy-gain model + predictive milestone + 1 intervention (focus area)
- [ ] Grandparent read-aloud loop
- [ ] One conversion trigger on `users.plan` (post-NSM unlock)
- [ ] **Run the 10-family pilot → metrics gate**
- **Gate:** pilot clears activation + literacy-gain thresholds.

**Phase C — 90–180 days · "Scale" (only if Phase B gate cleared)**
- [ ] Hybrid content pipeline (AI-draft → native-review queue over `content_items`)
- [ ] Story generator with controlled-vocabulary constraints
- [ ] Scale to ~1,000 items (illustration + TTS long-tail + batched native for core)
- [ ] Full freemium packaging + annual/gift pricing + billing
- [ ] **Register a real (owned) domain** — the pilot runs on `koodakbook.eu.cc`,
      a free eu.cc subdomain (not an owned TLD). Fine for a pilot; **not** a base
      to run payments (Stripe), email deliverability, or an app-store listing on.
      Register + own the TLD before billing or store submission; re-point the
      Cloudflare tunnel ingress and update `WEB_URL`/`NEXT_PUBLIC_BACKEND_URL`. *(ops)*
- [ ] Co-read / record-voice premium + print PDF companion
      **[SECURITY constraint — read before building record-voice]** `/uploads` is
      served as static files, **world-readable by exact URL with no auth** (index.ts;
      randomized filenames only). It is benign *today* solely because nothing
      child-identifying lands there (verified 2026-08: only generated TTS + content
      audio, plus AI-generated word illustrations under `/uploads/images` — no
      photos, no recordings, no names in paths). The illustrations were an
      explicit call (2026-08-12): unguessable filenames on generated artwork of
      cats and tables is acceptable exposure, since the worst case is someone
      seeing a picture that was going to be public anyway once approved. That
      reasoning does **not** transfer to a child's voice, which is why the line
      below is drawn where it is. A record-voice feature
      breaks that assumption: a child's recorded voice is PII, and dropping it under
      `/uploads` would make it publicly retrievable by anyone who learns the URL.
      Do NOT reuse the open `/uploads` path for it — store child recordings behind an
      auth + ownership gate (a route that checks `requireAuth`/child-owner before
      streaming the file), not on the static mount. *(security — tunnel/auth audit 2026-08)*
- [ ] B2B school pilot (seat licensing) — after teacher curriculum validation

### 11.7 Standing tradeoffs
1. Depth-first delays a content-rich demo — but a wide emoji library is what's
   failing now; one gorgeous slice converts *and* validates.
2. Mastery-gating feels slower to a click-happy child — but it's the line between
   an *activity* and a *literacy system*; the NSM depends on real decoding.
3. Native voice + illustration are slow/costly — so make them the scarce,
   human-reviewed end of an AI-saturated pipeline, spent only on the validated core.

---

## 12. Web ⇄ Mobile Parity Plan

> Full route-by-route audit (2026-09): the core learning loop (auth, child home,
> lessons, phonics, alphabet/writing, stories, review, math, rewards, parent
> dashboard/progress/settings/plan/share/conversations, legal) already has full
> parity and is documented in-code on the mobile side (most mobile screens carry
> a `web: /parent/...` comment pointing at their web counterpart). Three real gaps
> remain, ranked by risk — security first, then a safety-relevant social feature,
> then a bonus game. Sequenced deliberately in that order, not by effort.

**Explicitly not syncing:** `/alphabet` and `/first-100-words` stay web-only —
they exist to be crawled by search engines (see §SEO work, 2026-09), which is
meaningless for an app-store app. Mobile's games hub screen (`games/index.tsx`)
is cosmetic and can ride along with Phase 3 rather than being tracked on its own.

### 12.1 Phase 1 — Kid picture-password + device binding → mobile (security)
- [ ] `apps/mobile/app/login.tsx` — branch on `needs_picture_password` from the
      username lookup (`auth.ts`), same as web; show the 3-tap character picker
      instead of a password field when true.
- [ ] Picture-tap picker screen — reuse the character-roster rendering pattern
      already in `apps/mobile/app/children.tsx` (`pixel-wizards-charachters`).
- [ ] Device binding via `expo-secure-store` (already a dependency) to persist
      the `device_token` returned after a first successful unlock — mobile's
      equivalent of web's `localStorage`-based binding. Send it back on
      subsequent attempts so a bound device skips the parent PIN re-check.
- [ ] No backend or parent-settings work needed — `picture_password` is shared
      account state, set once from either platform (web: `parent/settings`),
      consumed by both.
- **Verify:** set a picture password from web, unlock from a fresh mobile
  install; confirm a second unlock on the same device skips the parent PIN
  check the way web's `device_tokens` binding does.

### 12.2 Phase 2 — Parent friend-request approval → web
- [ ] New `apps/web/src/app/parent/friends/page.tsx` — port mobile's
      `parent/friends.tsx` 1:1: per-child friend code (shareable), incoming
      request list with accept/decline, current friends list. Backend
      (`friends.ts`: `/code/:child_id`, `/requests`, `/requests/:id/accept|decline`)
      is already live and mobile-proven — this is UI only, no backend work.
- [ ] Nav entry in `ParentNav.tsx` + dashboard grid, same pattern as
      `/parent/conversations` (which is a *different* feature — AI-character
      chat transcripts, not child-to-child friend requests; don't conflate them).
- **Verify:** send a friend code from mobile, accept it from the new web page,
  confirm both children see each other in `child/friends`.

### 12.3 Phase 3 — Marpele (مارپله) game → web
- [ ] Move `apps/mobile/lib/marpele.ts` (board layout, ladders/snakes,
      question-building — plain TypeScript, no RN import) into `packages/shared`
      so both platforms share one source of truth instead of forking it.
- [ ] New `apps/web/src/components/child/MarpeleBoard.tsx` — can't reuse
      `apps/mobile/components/MarpeleBoard.tsx` (RN `View`/`Pressable`-based);
      build fresh for web (CSS grid or canvas) against the shared board data.
- [ ] New `apps/web/src/app/child/games/marpele/page.tsx` — solo play first
      (mirrors mobile's `marpele.tsx`).
- [ ] Multiplayer (`marpele-online.tsx`'s `socket.io-client` variant, against
      the backend's existing `lib/realtime.ts` socket server) is a second pass —
      add `socket.io-client` to web, match mobile's connect/disconnect lifecycle.
- **Verify:** solo play end-to-end on web; then a cross-platform match (web
  parent vs. mobile-playing sibling) once the online variant lands.
