-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Merge "الف مد" (آ) into "الف" (ا)
--
-- The Persian alphabet is conventionally taught as 32 letters. آ (alef +
-- madda) is a diacritic form of ا, not a distinct letter — but the seed
-- data (seed.sql) gave it its own row in `letters`, making the table
-- report 33. That surfaced publicly: /alphabet's "۳۲ حرف" copy and its
-- JSON-LD numberOfItems disagreed with the actual letter count.
--
-- Verified before writing this: the only FK into `letters` is
-- lesson_items.letter_id (001_schema.sql) — no other table references
-- letters(id). So this is the same re-point-then-delete shape
-- 004_fixes.sql already used to collapse accidental letter duplicates,
-- applied here to a semantic duplicate instead.
-- ═══════════════════════════════════════════════════════════

-- Re-point any lesson_items teaching آ to ا instead, to satisfy the FK
-- before the row is removed.
update lesson_items li
set letter_id = keep.id
from letters keep, letters merge
where keep.character = 'ا'
  and merge.character = 'آ'
  and li.letter_id = merge.id;

-- If a lesson already taught ا in some other slot, re-pointing above may
-- have created two lesson_items in the same lesson pointing at the same
-- letter — drop the redundant one (same de-dup rule as 004_fixes.sql).
delete from lesson_items li
using lesson_items dup
where li.lesson_id = dup.lesson_id
  and li.letter_id is not null
  and li.letter_id = dup.letter_id
  and li.ctid > dup.ctid;

delete from letters where character = 'آ';

-- ا was already order_in_group 1 and is now the only letter in group 1,
-- so no renumbering is needed. (If group 1 ever gains a real second
-- letter, that's the point to double-check ordering here.)
