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
- Playwright E2E suite (smoke + learning-loop + UI journeys) and ACM CI/CD pipeline (e2e → deploy)
- Content audit pass (migrations 011–013): fixed transliteration/gloss/register
  and kinship defects, added 7 Critical categories (opposites, question words,
  prepositions, clothes, transportation, weather, school) + numbers 11–20,
  rewrote 5 weak stories to a Hook→…→Recap structure with child interaction.
  Now ~189 words / 19 categories / 28 lessons / 15 stories / 94 pages.

### 🔜 Next — Content & Beta

- [ ] Partner with a Persian language teacher to validate curriculum structure
- [ ] Source or commission original Persian children's stories
- [ ] Record audio narrations with a native Persian voice actor
- [ ] **Beta blockers (content production, not data):** word/story images are
      still ~0; story narration is incomplete; ~80+ words (incl. the new ones)
      have no audio yet
- [ ] Upload word images and audio via admin panel
- [ ] Cross-device testing (iOS Safari, Android Chrome)
- [ ] RTL layout QA on all screens
- [ ] Deploy to production server
- [ ] Recruit first 10 diaspora families for beta testing

### 🔮 V2 Roadmap
- Speech recognition for pronunciation (OpenAI Whisper)
- AI story personalization (Claude API)
- Offline mode (PWA service worker)
- Physical book + QR code integration
- Teacher accounts for weekend Persian schools
