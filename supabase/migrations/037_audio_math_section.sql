-- KoodakBook — Migration 037: math gets its own audio section
--
-- The دنیای اعداد pack (numbers 0–100 + phrases) was voiced with the word
-- section's engine, with no way to pick a different voice for it. Numbers are
-- their own content type (very short clips, TTS-hostile like letters), so they
-- get their own audio_sections row — seeded from the word section so nothing
-- changes until the admin picks otherwise.
alter table audio_sections drop constraint if exists audio_sections_section_check;
alter table audio_sections add constraint audio_sections_section_check
  check (section in ('story', 'letter', 'word', 'phonics', 'math'));

insert into audio_sections (section, engine, voice)
select 'math', engine, voice from audio_sections where section = 'word'
on conflict (section) do nothing;
