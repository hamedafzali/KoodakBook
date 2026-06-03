-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Launch Fixes
-- - De-duplicate words & letters (earlier seeds were not idempotent)
-- - Add unique constraints so duplicates can never recur
-- - Persian-first lesson titles
-- - Seed effort badges
-- - Author pages for the 3 stories that shipped empty
-- ═══════════════════════════════════════════════════════════

-- ── 1. De-duplicate letters (keep earliest row per character) ──────────────
-- Re-point lesson_items to the surviving letter first to satisfy the FK.
with ranked as (
  select id, character,
         first_value(id) over (partition by character order by ctid) as keep_id
  from letters
)
update lesson_items li
set letter_id = r.keep_id
from ranked r
where li.letter_id = r.id and li.letter_id <> r.keep_id;

delete from letters l
using letters dup
where l.character = dup.character
  and l.ctid > dup.ctid;

-- Remove duplicate lesson_items that now point to the same letter in a lesson
delete from lesson_items li
using lesson_items dup
where li.lesson_id = dup.lesson_id
  and li.letter_id is not null
  and li.letter_id = dup.letter_id
  and li.ctid > dup.ctid;

-- ── 2. De-duplicate words (keep earliest row per persian+english) ──────────
-- Re-point lesson_items / story_page_words to the surviving word first.
with ranked as (
  select id, persian, english,
         first_value(id) over (partition by persian, english order by ctid) as keep_id
  from words
)
update lesson_items li
set word_id = r.keep_id
from ranked r
where li.word_id = r.id and li.word_id <> r.keep_id;

with ranked as (
  select id, persian, english,
         first_value(id) over (partition by persian, english order by ctid) as keep_id
  from words
)
update story_page_words spw
set word_id = r.keep_id
from ranked r
where spw.word_id = r.id and spw.word_id <> r.keep_id;

with ranked as (
  select id, persian, english,
         first_value(id) over (partition by persian, english order by ctid) as keep_id
  from words
)
update letters lt
set example_word_id = r.keep_id
from ranked r
where lt.example_word_id = r.id and lt.example_word_id <> r.keep_id;

-- child_word_progress: drop dup-pointing rows that would collide with the
-- keeper's row, then re-point the rest (unique (child_id, word_id)).
with ranked as (
  select id, persian, english,
         first_value(id) over (partition by persian, english order by ctid) as keep_id
  from words
)
delete from child_word_progress cwp
using ranked r
where cwp.word_id = r.id and cwp.word_id <> r.keep_id
  and exists (
    select 1 from child_word_progress k
    where k.child_id = cwp.child_id and k.word_id = r.keep_id
  );

with ranked as (
  select id, persian, english,
         first_value(id) over (partition by persian, english order by ctid) as keep_id
  from words
)
update child_word_progress cwp
set word_id = r.keep_id
from ranked r
where cwp.word_id = r.id and cwp.word_id <> r.keep_id;

delete from words w
using words dup
where w.persian = dup.persian
  and w.english = dup.english
  and w.ctid > dup.ctid;

-- Remove duplicate lesson_items that now point to the same word in a lesson
delete from lesson_items li
using lesson_items dup
where li.lesson_id = dup.lesson_id
  and li.word_id is not null
  and li.word_id = dup.word_id
  and li.ctid > dup.ctid;

-- ── 3. Unique constraints to prevent future duplicates ─────────────────────
create unique index if not exists letters_character_key on letters (character);
create unique index if not exists words_persian_english_key on words (persian, english);

-- ── 4. Persian-first lesson titles ─────────────────────────────────────────
update lessons set title = 'حیوانات'            where title = 'Animals';
update lessons set title = 'رنگ‌ها'             where title = 'Colors';
update lessons set title = 'خانواده'            where title = 'Family';
update lessons set title = 'بدن'                where title = 'Body Parts';
update lessons set title = 'خوراکی‌ها'          where title = 'Food & Drink';
update lessons set title = 'عددها'              where title = 'Numbers';
update lessons set title = 'شکل‌ها'             where title = 'Shapes';
update lessons set title = 'طبیعت'              where title = 'Nature';
update lessons set title = 'در خانه'            where title = 'At Home';
update lessons set title = 'احساس‌ها'           where title = 'Feelings';
update lessons set title = 'کارها'              where title = 'Actions';
update lessons set title = 'سلام و احوال‌پرسی'  where title = 'Greetings';
update lessons set title = 'الفبا - گروه ۱'     where title = 'Alphabet Group 1';
update lessons set title = 'الفبا - گروه ۲'     where title = 'Alphabet Group 2';
update lessons set title = 'الفبا - گروه ۳'     where title = 'Alphabet Group 3';
update lessons set title = 'الفبا - گروه ۴'     where title = 'Alphabet Group 4';
update lessons set title = 'الفبا - گروه ۵'     where title = 'Alphabet Group 5';
update lessons set title = 'الفبا - گروه ۶'     where title = 'Alphabet Group 6';
update lessons set title = 'الفبا - گروه ۷'     where title = 'Alphabet Group 7';
update lessons set title = 'الفبا - گروه ۸'     where title = 'Alphabet Group 8';

-- ── 5. Effort badges ───────────────────────────────────────────────────────
insert into badges (key, title, description) values
  ('tried_today',     'امروز تلاش کردی!', 'امروز وارد اپ شدی و تمرین کردی'),
  ('practiced_again', 'دوباره تمرین!',    'یک کلمه را دوباره مرور کردی'),
  ('streak_3',        '۳ روز پشت سرهم!',  '۳ روز متوالی تمرین کردی')
on conflict (key) do nothing;

-- ── 6. Pages for the 3 stories that shipped with no pages ──────────────────
insert into story_pages (story_id, page_number, text_persian, text_english)
select s.id, p.num, p.fa, p.en
from stories s
join (values
  (1, 'خانواده‌ی خرس در جنگل زندگی می‌کرد.',   'The bear family lived in the forest.'),
  (2, 'بابا خرس بزرگ و قوی بود.',               'Papa bear was big and strong.'),
  (3, 'مامان خرس مهربان بود.',                  'Mama bear was kind.'),
  (4, 'بچه خرس کوچک و بازیگوش بود.',            'Baby bear was small and playful.'),
  (5, 'آن‌ها با هم عسل خوردند.',                'They ate honey together.'),
  (6, 'خانواده‌ی خرس خوشحال بودند.',            'The bear family was happy.')
) as p(num, fa, en) on true
where s.title_english = 'The Bear Family';

insert into story_pages (story_id, page_number, text_persian, text_english)
select s.id, p.num, p.fa, p.en
from stories s
join (values
  (1, 'صبح زود مادربزرگ نان می‌پخت.',          'Early in the morning, grandma baked bread.'),
  (2, 'بوی نان تازه در خانه پیچید.',            'The smell of fresh bread filled the house.'),
  (3, 'بچه‌ها از خواب بیدار شدند.',             'The children woke up.'),
  (4, 'همه دور هم نشستند.',                     'Everyone sat together.'),
  (5, 'نان گرم را با عسل خوردند.',              'They ate the warm bread with honey.'),
  (6, 'چه صبح خوبی بود!',                       'What a lovely morning it was!')
) as p(num, fa, en) on true
where s.title_english = 'The Morning Bread';

insert into story_pages (story_id, page_number, text_persian, text_english)
select s.id, p.num, p.fa, p.en
from stories s
join (values
  (1, 'یک ماهی کوچک در دریا زندگی می‌کرد.',     'A little fish lived in the sea.'),
  (2, 'ماهی دوست داشت شنا کند.',                'The fish loved to swim.'),
  (3, 'یک روز یک ماهی بزرگ دید.',               'One day it saw a big fish.'),
  (4, 'ماهی بزرگ گفت: «بیا با هم بازی کنیم!»',  'The big fish said: "Let''s play together!"'),
  (5, 'آن‌ها در دریا شنا کردند.',               'They swam in the sea.'),
  (6, 'دریا خانه‌ی قشنگی بود.',                 'The sea was a beautiful home.')
) as p(num, fa, en) on true
where s.title_english = 'The Fish and the Sea';
