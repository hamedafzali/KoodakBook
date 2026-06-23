-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 020: placement (per-strand levels)
--
-- Replaces the self-declared onboarding level with a measured placement probe.
-- The probe sets children.level (drives existing curriculum placement) AND
-- records an independent level per learning strand (project.md §11.1), so the
-- heritage profile "understands spoken Persian but can't read" is captured as
-- high V / low D rather than collapsed into one number.
--
-- Additive: child_strand_levels is forward-looking (Phase-B unlock logic will
-- read it); children.level stays authoritative for today's readers.
-- ═══════════════════════════════════════════════════════════

alter table children add column if not exists placement_done boolean not null default false;

create table if not exists child_strand_levels (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  strand     char(1) not null check (strand in ('P', 'D', 'V', 'F', 'C')),
  level      int not null default 1,
  source     text not null default 'placement' check (source in ('placement', 'manual', 'auto')),
  updated_at timestamptz not null default now(),
  unique (child_id, strand)
);
create index if not exists idx_child_strand_levels_child on child_strand_levels (child_id);
