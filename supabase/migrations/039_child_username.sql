-- KoodakBook — Migration 039: child usernames (kid-mode direct login)
--
-- A parent gives each child a simple username («sara2018»). The child types
-- ONLY that name on the «ورود بچه‌ها» screen and lands straight in child mode
-- for their own profile — no password (kids can't type them), the parent area
-- stays PIN-gated. Globally unique, case-insensitive. Future: the same entry
-- point can be wired to face recognition instead of typing.
alter table children add column if not exists username text;
create unique index if not exists idx_children_username on children (lower(username)) where username is not null;
