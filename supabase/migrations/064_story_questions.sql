-- KoodakBook — Migration 064: story comprehension questions
--
-- Closes part of the "path and plans" competitive-gap review (Claude Project
-- doc claude/enhancement-phases.md): AI-generated stories already adapt
-- difficulty and vocabulary to the child's level (routes/ai.ts), but nothing
-- ever checked whether the story landed — no comprehension check existed
-- anywhere in the app. This adds storage for a short multiple-choice quiz
-- per story.
--
-- Generated inline, in the SAME model call as the story itself
-- (lib/ai/index.ts), so the questions are grounded in the actual narrative
-- the model just wrote — not a second, decoupled call re-reading the
-- finished text after the fact. Best-effort: a missing/invalid questions
-- block never fails story generation, same fail-open pattern as page-audio
-- synthesis a few lines below it in routes/ai.ts.
--
-- Not scoped to ai_generated stories by the schema itself — just by what
-- currently populates it (routes/ai.ts, on new AI story generation only).
-- The fixed curriculum library (stories.ai_generated = false) can get
-- questions later, by hand or backfilled, with no schema change.

create table if not exists story_questions (
  id               uuid primary key default gen_random_uuid(),
  story_id         uuid not null references stories(id) on delete cascade,
  question_number  int not null,
  question_persian text not null,
  choices          jsonb not null,   -- string[3], Persian answer options
  correct_index    int not null check (correct_index between 0 and 2),
  created_at       timestamptz not null default now(),
  unique (story_id, question_number)
);

create index if not exists idx_story_questions_story on story_questions (story_id);
