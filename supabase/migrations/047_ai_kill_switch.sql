-- KoodakBook — Migration 047: AI kill switch (Item 3, Pass A)
-- A single global flag to instantly disable every live LLM call — story
-- generation, character chat, and translation — WITHOUT a deploy. When false,
-- each AI surface serves its deterministic fallback instead of calling a
-- provider: character chat drops to scripted lines, story generation and
-- translation return "temporarily off". Defaults true so behaviour is unchanged
-- until an admin flips it. This is the fast lever to pull if the gate is ever
-- seen to leak; the fuller content-safety gate (Pass B) lands on top of it.

alter table ai_settings add column if not exists ai_enabled boolean not null default true;
