-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 013: story fixes (from content audit)
--
--   1. Rewrite five weak stories into the target shape: Hook → Repetition →
--      Interaction → Small challenge → Resolution → Vocabulary recap.
--      - The Bear Family / The Fish and the Sea / The Morning Bread were filled
--        by migration 004 but with formulaic endings, no child interaction and
--        no vocab recap — exactly the audit's story critique.
--      - Colors of the Garden was a color word-list; My Friends was a slogan.
--   2. Age fix: stage-3 stories are independent-reading content, so age_min 4
--      (a pre-literate age) is wrong — raise those to 5.
--
-- Each rewrite deletes the story's existing pages (and their translations)
-- first, so it is idempotent and never duplicates. All pages are then
-- dual-written into content_translations.
-- ═══════════════════════════════════════════════════════════

-- ── 1. Age fix ────────────────────────────────────────────
update stories set age_min = 5 where stage = 3 and age_min = 4;

-- ── 2. The Bear Family (rewrite of 004's version) ─────────
delete from content_translations
where entity_type = 'story_page'
  and entity_id in (select id from story_pages where story_id = (select id from stories where title_english = 'The Bear Family'));
delete from story_pages
where story_id = (select id from stories where title_english = 'The Bear Family');
with s as (select id from stories where title_english = 'The Bear Family')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک خانواده‌ی خرس در جنگل زندگی می‌کرد.',  'A bear family lived in the forest.'),
  ((select id from s), 2, 'مامان‌خرس، باباخرس و خرس کوچولو.',          'Mama bear, papa bear, and little bear.'),
  ((select id from s), 3, 'هر روز با هم بازی می‌کردند و می‌خندیدند.', 'Every day they played and laughed together.'),
  ((select id from s), 4, 'تو با خانواده‌ات چه بازی می‌کنی؟',          'What do you play with your family?'),
  ((select id from s), 5, 'یک روز خرس کوچولو گم شد و ترسید.',          'One day little bear got lost and was scared.'),
  ((select id from s), 6, 'مامان و بابا او را پیدا کردند و بغلش کردند.','Mama and papa found him and hugged him.'),
  ((select id from s), 7, 'خانواده یعنی با هم بودن.',                  'Family means being together.');

-- ── 3. The Fish and the Sea (rewrite of 004's version) ────
delete from content_translations
where entity_type = 'story_page'
  and entity_id in (select id from story_pages where story_id = (select id from stories where title_english = 'The Fish and the Sea'));
delete from story_pages
where story_id = (select id from stories where title_english = 'The Fish and the Sea');
with s as (select id from stories where title_english = 'The Fish and the Sea')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک ماهی کوچک در دریا شنا می‌کرد.',      'A little fish swam in the sea.'),
  ((select id from s), 2, 'شنا کرد و شنا کرد و شنا کرد.',          'It swam and swam and swam.'),
  ((select id from s), 3, 'یک لاک‌پشت دید و سلام کرد.',            'It saw a turtle and said hello.'),
  ((select id from s), 4, 'تو در دریا چه چیزهایی می‌بینی؟',        'What things do you see in the sea?'),
  ((select id from s), 5, 'یک موج بزرگ آمد و ماهی ترسید.',        'A big wave came and the fish was scared.'),
  ((select id from s), 6, 'دوستانش کمک کردند. دریا خانه‌ی اوست.', 'Its friends helped. The sea is its home.');

-- ── 4. The Morning Bread (rewrite of 004's version) ───────
delete from content_translations
where entity_type = 'story_page'
  and entity_id in (select id from story_pages where story_id = (select id from stories where title_english = 'The Morning Bread'));
delete from story_pages
where story_id = (select id from stories where title_english = 'The Morning Bread');
with s as (select id from stories where title_english = 'The Morning Bread')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'صبح زود بود و هوا سرد بود.',             'It was early morning and the weather was cold.'),
  ((select id from s), 2, 'بابا گفت: «برویم نان تازه بخریم.»',      'Dad said: "Let''s go buy fresh bread."'),
  ((select id from s), 3, 'راه رفتیم و راه رفتیم تا نانوایی.',      'We walked and walked to the bakery.'),
  ((select id from s), 4, 'تو نان را با چی دوست داری؟',             'What do you like to eat bread with?'),
  ((select id from s), 5, 'نانوا نان گرم و خوشبو پخت.',            'The baker made warm, fragrant bread.'),
  ((select id from s), 6, 'نان گرم را با پنیر خوردیم.',            'We ate the warm bread with cheese.'),
  ((select id from s), 7, 'صبح با نانِ تازه قشنگ‌تر است.',         'Morning is nicer with fresh bread.');

-- ── 5. Rewrite "Colors of the Garden" (was a word list) ───
delete from content_translations
where entity_type = 'story_page'
  and entity_id in (select id from story_pages where story_id = (select id from stories where title_english = 'Colors of the Garden'));
delete from story_pages
where story_id = (select id from stories where title_english = 'Colors of the Garden');
with s as (select id from stories where title_english = 'Colors of the Garden')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'مینا به باغچه رفت.',                          'Mina went to the garden.'),
  ((select id from s), 2, 'گل‌های قرمز دید و گفت: «چه قشنگ!»',           'She saw red flowers and said: "How pretty!"'),
  ((select id from s), 3, 'یک پروانه‌ی زرد و یک پروانه‌ی آبی. تو کدام رنگ را دوست داری؟', 'A yellow butterfly and a blue butterfly. Which color do you like?'),
  ((select id from s), 4, 'یک ابر آمد و باغچه خاکستری شد.',              'A cloud came and the garden turned grey.'),
  ((select id from s), 5, 'باران بارید و یک رنگین‌کمان آمد.',            'Rain fell and a rainbow appeared.'),
  ((select id from s), 6, 'باغچه پر از رنگ بود: قرمز، زرد، آبی، سبز.',   'The garden was full of colors: red, yellow, blue, green.');

-- ── 6. Rewrite "My Friends" (was a slogan) ────────────────
delete from content_translations
where entity_type = 'story_page'
  and entity_id in (select id from story_pages where story_id = (select id from stories where title_english = 'My Friends'));
delete from story_pages
where story_id = (select id from stories where title_english = 'My Friends');
with s as (select id from stories where title_english = 'My Friends')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'من یک دوست دارم. اسمش سارا است.',       'I have a friend. Her name is Sara.'),
  ((select id from s), 2, 'با هم بازی می‌کنیم و با هم می‌خندیم.',  'We play together and we laugh together.'),
  ((select id from s), 3, 'تو با کی بازی می‌کنی؟',                  'Who do you play with?'),
  ((select id from s), 4, 'یک روز سارا ناراحت بود. چرا؟',          'One day Sara was sad. Why?'),
  ((select id from s), 5, 'من بغلش کردم و گفتم: «من کنارت هستم.»', 'I hugged her and said: "I am here with you."'),
  ((select id from s), 6, 'دوست خوب همیشه کمک می‌کند.',            'A good friend always helps.');

-- ── 7. Dual-write all (new + rewritten) pages into content_translations ──
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story_page', id, 'fa', 'text', text_persian from story_pages
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'story_page', id, 'en', 'text', text_english from story_pages where text_english is not null and text_english <> ''
on conflict do nothing;
