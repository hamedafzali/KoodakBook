-- AI-personalized stories: generated per child at their level, kept out of the
-- shared catalogue so they only surface for the child they were made for.
alter table stories add column if not exists ai_generated boolean not null default false;
alter table stories add column if not exists created_for_child uuid references children(id) on delete cascade;

create index if not exists idx_stories_created_for_child on stories (created_for_child);
