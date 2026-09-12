-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 062: Persian lesson titles + descriptions
--
-- lessons.title/description were seeded English-only (seed.sql for the 13
-- foundation lessons; migrations 003 and 012 for the next 15). Migration 004
-- later translated the *title* column for the first 20 lessons to Persian
-- ('حیوانات', 'الفبا - گروه ۱', 'عددها', ...) but never touched
-- `description` — so today those 20 lessons show a Persian title with an
-- English description directly underneath it on the child lesson list
-- (apps/web/src/app/child/lesson/page.tsx:113). Migration 012's 8 lessons
-- (Clothes, Transportation, Weather, At School, Numbers 11-20, Opposites,
-- Question Words, Where Things Are) were added after 004 ran and were never
-- translated at all — both title and description are still English there,
-- and that's also what every read site (child/home, lesson list, lesson
-- detail, and the TTS prompt strings that speak lesson.title aloud via
-- speakPersian()) reads directly.
--
-- Unlike words/letters/stories, lessons were never brought into the
-- content_translations model from migration 009 — they had no bilingual
-- columns to backfill from at the time, so they were simply missed.
--
-- Per docs/i18n-plan.md this migration:
--   1. Adds 'lesson' to content_translations.entity_type so lessons join the
--      same generalized model as word/letter/story/story_page.
--   2. Inserts the real Persian title/description (translation content, not
--      a schema change) as locale='fa' for ALL 28 lessons, keyed by
--      order_index (stable and unique per the existing seed/migration
--      `on conflict (order_index)` clauses) rather than by title, since 20
--      of the 28 lessons already carry a Persian title on the legacy column
--      today and a title-string join would silently match zero rows for
--      them (exactly what the first draft of this migration got wrong).
--   3. Preserves the *original* English title/description as locale='en',
--      hardcoded from the seed/migration source rather than read back from
--      the live column, since the live column is a mix of English and
--      Persian across different lessons today — same additive pattern
--      migration 009 used everywhere else.
--   4. Updates the legacy lessons.title/description columns to the Persian
--      text for all 28 lessons (idempotent for the 20 whose title is
--      already Persian; it's the description that's the live bug there).
--      This is the interim fix, since the read-cutover to
--      content_translations (i18n-plan.md phase 3) has not landed yet.
--
-- Reversible: content_translations rows can be deleted by entity_type, and
-- lessons.title/description can be restored from the locale='en' rows this
-- same migration writes.
-- ═══════════════════════════════════════════════════════════

alter table content_translations drop constraint if exists content_translations_entity_type_check;
alter table content_translations add constraint content_translations_entity_type_check
  check (entity_type in ('word', 'letter', 'story', 'story_page', 'lesson'));

-- ── All 28 lessons, keyed by the stable order_index, with their original
--    English source content and their Persian translation ─────────────────
with lesson_content (order_index, title_en, description_en, title_fa, description_fa) as (values
  ( 1, 'Animals',            'Learn Persian names for common animals', 'حیوانات',          'اسم حیوان‌های آشنا رو یاد بگیر'),
  ( 2, 'Colors',             'Learn Persian color words',              'رنگ‌ها',            'کلمه‌های رنگ رو به فارسی یاد بگیر'),
  ( 3, 'Family',             'Learn Persian family member names',      'خانواده',           'اسم اعضای خانواده رو یاد بگیر'),
  ( 4, 'Body Parts',         'Learn Persian body part names',          'بدن',               'اسم اعضای بدن رو یاد بگیر'),
  ( 5, 'Food & Drink',       'Learn Persian food and drink words',     'خوراکی‌ها',         'کلمه‌های خوراکی و نوشیدنی رو یاد بگیر'),
  ( 6, 'Alphabet Group 1',   'Alef family letters',                    'الفبا - گروه ۱',   'حروف خانواده‌ی الف'),
  ( 7, 'Alphabet Group 2',   'Be, Pe, Te, Se',                         'الفبا - گروه ۲',   'ب، پ، ت، ث'),
  ( 8, 'Alphabet Group 3',   'Jim, Che, He, Khe',                      'الفبا - گروه ۳',   'ج، چ، ح، خ'),
  ( 9, 'Alphabet Group 4',   'Dal, Zal, Re, Ze, Zhe',                  'الفبا - گروه ۴',   'د، ذ، ر، ز، ژ'),
  (10, 'Alphabet Group 5',   'Sin, Shin',                              'الفبا - گروه ۵',   'س، ش'),
  (11, 'Alphabet Group 6',   'Sad, Zad, Ta, Za',                       'الفبا - گروه ۶',   'ص، ض، ط، ظ'),
  (12, 'Alphabet Group 7',   'Eyn, Gheyn, Fe, Ghaf',                   'الفبا - گروه ۷',   'ع، غ، ف، ق'),
  (13, 'Alphabet Group 8',   'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',   'الفبا - گروه ۸',   'ک، گ، ل، م، ن، و، ه، ی'),
  (14, 'Numbers',            'Count from one to ten in Persian',       'عددها',             'از یک تا ده بشمار'),
  (15, 'Shapes',             'Learn Persian names for basic shapes',   'شکل‌ها',            'اسم شکل‌های ساده رو یاد بگیر'),
  (16, 'Nature',             'Trees, flowers, sun, rain and more',     'طبیعت',             'درخت، گل، خورشید، باران و بیشتر'),
  (17, 'At Home',            'Things you find around the house',      'در خانه',           'چیزهایی که توی خونه پیدا می‌کنی'),
  (18, 'Feelings',           'How do you feel today?',                 'احساس‌ها',          'امروز چه حسی داری؟'),
  (19, 'Actions',            'Everyday verbs in Persian',              'کارها',             'فعل‌های هر روزه به فارسی'),
  (20, 'Greetings',          'Say hello, goodbye and thank you',       'سلام و احوال‌پرسی', 'سلام، خداحافظ و ممنون رو یاد بگیر'),
  (21, 'Clothes',            'Things we wear every day',               'لباس‌ها',           'چیزهایی که هر روز می‌پوشیم'),
  (22, 'Transportation',     'How we get around',                      'وسایل نقلیه',       'با چی جابه‌جا می‌شیم'),
  (23, 'Weather',            'Sunny, rainy, hot and cold',             'آب و هوا',          'آفتابی، بارونی، گرم و سرد'),
  (24, 'At School',          'Words for the classroom',                'مدرسه',             'کلمه‌های کلاس درس'),
  (25, 'Numbers 11-20',      'Keep counting past ten',                 'اعداد ۱۱ تا ۲۰',   'بعد از ده هم بشمار'),
  (26, 'Opposites',          'Big and small, fast and slow',           'متضادها',           'بزرگ و کوچیک، تند و کند'),
  (27, 'Question Words',     'Who, what, where and why',               'کلمه‌های پرسشی',    'کی، چی، کجا و چرا'),
  (28, 'Where Things Are',   'On, under, inside and next to',          'کجاست؟',            'روی، زیر، داخل و کنار')
)

-- ── Preserve the original English (title + description) as locale='en' ──
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'lesson', l.id, 'en', 'title', c.title_en
  from lessons l join lesson_content c on l.order_index = c.order_index
on conflict do nothing;

with lesson_content (order_index, title_en, description_en, title_fa, description_fa) as (values
  ( 1, 'Animals',            'Learn Persian names for common animals', 'حیوانات',          'اسم حیوان‌های آشنا رو یاد بگیر'),
  ( 2, 'Colors',             'Learn Persian color words',              'رنگ‌ها',            'کلمه‌های رنگ رو به فارسی یاد بگیر'),
  ( 3, 'Family',             'Learn Persian family member names',      'خانواده',           'اسم اعضای خانواده رو یاد بگیر'),
  ( 4, 'Body Parts',         'Learn Persian body part names',          'بدن',               'اسم اعضای بدن رو یاد بگیر'),
  ( 5, 'Food & Drink',       'Learn Persian food and drink words',     'خوراکی‌ها',         'کلمه‌های خوراکی و نوشیدنی رو یاد بگیر'),
  ( 6, 'Alphabet Group 1',   'Alef family letters',                    'الفبا - گروه ۱',   'حروف خانواده‌ی الف'),
  ( 7, 'Alphabet Group 2',   'Be, Pe, Te, Se',                         'الفبا - گروه ۲',   'ب، پ، ت، ث'),
  ( 8, 'Alphabet Group 3',   'Jim, Che, He, Khe',                      'الفبا - گروه ۳',   'ج، چ، ح، خ'),
  ( 9, 'Alphabet Group 4',   'Dal, Zal, Re, Ze, Zhe',                  'الفبا - گروه ۴',   'د، ذ، ر، ز، ژ'),
  (10, 'Alphabet Group 5',   'Sin, Shin',                              'الفبا - گروه ۵',   'س، ش'),
  (11, 'Alphabet Group 6',   'Sad, Zad, Ta, Za',                       'الفبا - گروه ۶',   'ص، ض، ط، ظ'),
  (12, 'Alphabet Group 7',   'Eyn, Gheyn, Fe, Ghaf',                   'الفبا - گروه ۷',   'ع، غ، ف، ق'),
  (13, 'Alphabet Group 8',   'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',   'الفبا - گروه ۸',   'ک، گ، ل، م، ن، و، ه، ی'),
  (14, 'Numbers',            'Count from one to ten in Persian',       'عددها',             'از یک تا ده بشمار'),
  (15, 'Shapes',             'Learn Persian names for basic shapes',   'شکل‌ها',            'اسم شکل‌های ساده رو یاد بگیر'),
  (16, 'Nature',             'Trees, flowers, sun, rain and more',     'طبیعت',             'درخت، گل، خورشید، باران و بیشتر'),
  (17, 'At Home',            'Things you find around the house',      'در خانه',           'چیزهایی که توی خونه پیدا می‌کنی'),
  (18, 'Feelings',           'How do you feel today?',                 'احساس‌ها',          'امروز چه حسی داری؟'),
  (19, 'Actions',            'Everyday verbs in Persian',              'کارها',             'فعل‌های هر روزه به فارسی'),
  (20, 'Greetings',          'Say hello, goodbye and thank you',       'سلام و احوال‌پرسی', 'سلام، خداحافظ و ممنون رو یاد بگیر'),
  (21, 'Clothes',            'Things we wear every day',               'لباس‌ها',           'چیزهایی که هر روز می‌پوشیم'),
  (22, 'Transportation',     'How we get around',                      'وسایل نقلیه',       'با چی جابه‌جا می‌شیم'),
  (23, 'Weather',            'Sunny, rainy, hot and cold',             'آب و هوا',          'آفتابی، بارونی، گرم و سرد'),
  (24, 'At School',          'Words for the classroom',                'مدرسه',             'کلمه‌های کلاس درس'),
  (25, 'Numbers 11-20',      'Keep counting past ten',                 'اعداد ۱۱ تا ۲۰',   'بعد از ده هم بشمار'),
  (26, 'Opposites',          'Big and small, fast and slow',           'متضادها',           'بزرگ و کوچیک، تند و کند'),
  (27, 'Question Words',     'Who, what, where and why',               'کلمه‌های پرسشی',    'کی، چی، کجا و چرا'),
  (28, 'Where Things Are',   'On, under, inside and next to',          'کجاست؟',            'روی، زیر، داخل و کنار')
)
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'lesson', l.id, 'en', 'description', c.description_en
  from lessons l join lesson_content c on l.order_index = c.order_index
on conflict do nothing;

-- ── Persian title + description (translation content) for all 28 ─────────
with lesson_content (order_index, title_en, description_en, title_fa, description_fa) as (values
  ( 1, 'Animals',            'Learn Persian names for common animals', 'حیوانات',          'اسم حیوان‌های آشنا رو یاد بگیر'),
  ( 2, 'Colors',             'Learn Persian color words',              'رنگ‌ها',            'کلمه‌های رنگ رو به فارسی یاد بگیر'),
  ( 3, 'Family',             'Learn Persian family member names',      'خانواده',           'اسم اعضای خانواده رو یاد بگیر'),
  ( 4, 'Body Parts',         'Learn Persian body part names',          'بدن',               'اسم اعضای بدن رو یاد بگیر'),
  ( 5, 'Food & Drink',       'Learn Persian food and drink words',     'خوراکی‌ها',         'کلمه‌های خوراکی و نوشیدنی رو یاد بگیر'),
  ( 6, 'Alphabet Group 1',   'Alef family letters',                    'الفبا - گروه ۱',   'حروف خانواده‌ی الف'),
  ( 7, 'Alphabet Group 2',   'Be, Pe, Te, Se',                         'الفبا - گروه ۲',   'ب، پ، ت، ث'),
  ( 8, 'Alphabet Group 3',   'Jim, Che, He, Khe',                      'الفبا - گروه ۳',   'ج، چ، ح، خ'),
  ( 9, 'Alphabet Group 4',   'Dal, Zal, Re, Ze, Zhe',                  'الفبا - گروه ۴',   'د، ذ، ر، ز، ژ'),
  (10, 'Alphabet Group 5',   'Sin, Shin',                              'الفبا - گروه ۵',   'س، ش'),
  (11, 'Alphabet Group 6',   'Sad, Zad, Ta, Za',                       'الفبا - گروه ۶',   'ص، ض، ط، ظ'),
  (12, 'Alphabet Group 7',   'Eyn, Gheyn, Fe, Ghaf',                   'الفبا - گروه ۷',   'ع، غ، ف، ق'),
  (13, 'Alphabet Group 8',   'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',   'الفبا - گروه ۸',   'ک، گ، ل، م، ن، و، ه، ی'),
  (14, 'Numbers',            'Count from one to ten in Persian',       'عددها',             'از یک تا ده بشمار'),
  (15, 'Shapes',             'Learn Persian names for basic shapes',   'شکل‌ها',            'اسم شکل‌های ساده رو یاد بگیر'),
  (16, 'Nature',             'Trees, flowers, sun, rain and more',     'طبیعت',             'درخت، گل، خورشید، باران و بیشتر'),
  (17, 'At Home',            'Things you find around the house',      'در خانه',           'چیزهایی که توی خونه پیدا می‌کنی'),
  (18, 'Feelings',           'How do you feel today?',                 'احساس‌ها',          'امروز چه حسی داری؟'),
  (19, 'Actions',            'Everyday verbs in Persian',              'کارها',             'فعل‌های هر روزه به فارسی'),
  (20, 'Greetings',          'Say hello, goodbye and thank you',       'سلام و احوال‌پرسی', 'سلام، خداحافظ و ممنون رو یاد بگیر'),
  (21, 'Clothes',            'Things we wear every day',               'لباس‌ها',           'چیزهایی که هر روز می‌پوشیم'),
  (22, 'Transportation',     'How we get around',                      'وسایل نقلیه',       'با چی جابه‌جا می‌شیم'),
  (23, 'Weather',            'Sunny, rainy, hot and cold',             'آب و هوا',          'آفتابی، بارونی، گرم و سرد'),
  (24, 'At School',          'Words for the classroom',                'مدرسه',             'کلمه‌های کلاس درس'),
  (25, 'Numbers 11-20',      'Keep counting past ten',                 'اعداد ۱۱ تا ۲۰',   'بعد از ده هم بشمار'),
  (26, 'Opposites',          'Big and small, fast and slow',           'متضادها',           'بزرگ و کوچیک، تند و کند'),
  (27, 'Question Words',     'Who, what, where and why',               'کلمه‌های پرسشی',    'کی، چی، کجا و چرا'),
  (28, 'Where Things Are',   'On, under, inside and next to',          'کجاست؟',            'روی، زیر، داخل و کنار')
)
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'lesson', l.id, 'fa', 'title', c.title_fa
  from lessons l join lesson_content c on l.order_index = c.order_index
on conflict do nothing;

with lesson_content (order_index, title_en, description_en, title_fa, description_fa) as (values
  ( 1, 'Animals',            'Learn Persian names for common animals', 'حیوانات',          'اسم حیوان‌های آشنا رو یاد بگیر'),
  ( 2, 'Colors',             'Learn Persian color words',              'رنگ‌ها',            'کلمه‌های رنگ رو به فارسی یاد بگیر'),
  ( 3, 'Family',             'Learn Persian family member names',      'خانواده',           'اسم اعضای خانواده رو یاد بگیر'),
  ( 4, 'Body Parts',         'Learn Persian body part names',          'بدن',               'اسم اعضای بدن رو یاد بگیر'),
  ( 5, 'Food & Drink',       'Learn Persian food and drink words',     'خوراکی‌ها',         'کلمه‌های خوراکی و نوشیدنی رو یاد بگیر'),
  ( 6, 'Alphabet Group 1',   'Alef family letters',                    'الفبا - گروه ۱',   'حروف خانواده‌ی الف'),
  ( 7, 'Alphabet Group 2',   'Be, Pe, Te, Se',                         'الفبا - گروه ۲',   'ب، پ، ت، ث'),
  ( 8, 'Alphabet Group 3',   'Jim, Che, He, Khe',                      'الفبا - گروه ۳',   'ج، چ، ح، خ'),
  ( 9, 'Alphabet Group 4',   'Dal, Zal, Re, Ze, Zhe',                  'الفبا - گروه ۴',   'د، ذ، ر، ز، ژ'),
  (10, 'Alphabet Group 5',   'Sin, Shin',                              'الفبا - گروه ۵',   'س، ش'),
  (11, 'Alphabet Group 6',   'Sad, Zad, Ta, Za',                       'الفبا - گروه ۶',   'ص، ض، ط، ظ'),
  (12, 'Alphabet Group 7',   'Eyn, Gheyn, Fe, Ghaf',                   'الفبا - گروه ۷',   'ع، غ، ف، ق'),
  (13, 'Alphabet Group 8',   'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',   'الفبا - گروه ۸',   'ک، گ، ل، م، ن، و، ه، ی'),
  (14, 'Numbers',            'Count from one to ten in Persian',       'عددها',             'از یک تا ده بشمار'),
  (15, 'Shapes',             'Learn Persian names for basic shapes',   'شکل‌ها',            'اسم شکل‌های ساده رو یاد بگیر'),
  (16, 'Nature',             'Trees, flowers, sun, rain and more',     'طبیعت',             'درخت، گل، خورشید، باران و بیشتر'),
  (17, 'At Home',            'Things you find around the house',      'در خانه',           'چیزهایی که توی خونه پیدا می‌کنی'),
  (18, 'Feelings',           'How do you feel today?',                 'احساس‌ها',          'امروز چه حسی داری؟'),
  (19, 'Actions',            'Everyday verbs in Persian',              'کارها',             'فعل‌های هر روزه به فارسی'),
  (20, 'Greetings',          'Say hello, goodbye and thank you',       'سلام و احوال‌پرسی', 'سلام، خداحافظ و ممنون رو یاد بگیر'),
  (21, 'Clothes',            'Things we wear every day',               'لباس‌ها',           'چیزهایی که هر روز می‌پوشیم'),
  (22, 'Transportation',     'How we get around',                      'وسایل نقلیه',       'با چی جابه‌جا می‌شیم'),
  (23, 'Weather',            'Sunny, rainy, hot and cold',             'آب و هوا',          'آفتابی، بارونی، گرم و سرد'),
  (24, 'At School',          'Words for the classroom',                'مدرسه',             'کلمه‌های کلاس درس'),
  (25, 'Numbers 11-20',      'Keep counting past ten',                 'اعداد ۱۱ تا ۲۰',   'بعد از ده هم بشمار'),
  (26, 'Opposites',          'Big and small, fast and slow',           'متضادها',           'بزرگ و کوچیک، تند و کند'),
  (27, 'Question Words',     'Who, what, where and why',               'کلمه‌های پرسشی',    'کی، چی، کجا و چرا'),
  (28, 'Where Things Are',   'On, under, inside and next to',          'کجاست؟',            'روی، زیر، داخل و کنار')
)
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'lesson', l.id, 'fa', 'description', c.description_fa
  from lessons l join lesson_content c on l.order_index = c.order_index
on conflict do nothing;

-- ── Interim fix: point the legacy columns everything still reads at Persian
--    (idempotent for the 20 lessons whose title migration 004 already
--    translated — it's their description that this actually fixes) ────────
with lesson_content (order_index, title_en, description_en, title_fa, description_fa) as (values
  ( 1, 'Animals',            'Learn Persian names for common animals', 'حیوانات',          'اسم حیوان‌های آشنا رو یاد بگیر'),
  ( 2, 'Colors',             'Learn Persian color words',              'رنگ‌ها',            'کلمه‌های رنگ رو به فارسی یاد بگیر'),
  ( 3, 'Family',             'Learn Persian family member names',      'خانواده',           'اسم اعضای خانواده رو یاد بگیر'),
  ( 4, 'Body Parts',         'Learn Persian body part names',          'بدن',               'اسم اعضای بدن رو یاد بگیر'),
  ( 5, 'Food & Drink',       'Learn Persian food and drink words',     'خوراکی‌ها',         'کلمه‌های خوراکی و نوشیدنی رو یاد بگیر'),
  ( 6, 'Alphabet Group 1',   'Alef family letters',                    'الفبا - گروه ۱',   'حروف خانواده‌ی الف'),
  ( 7, 'Alphabet Group 2',   'Be, Pe, Te, Se',                         'الفبا - گروه ۲',   'ب، پ، ت، ث'),
  ( 8, 'Alphabet Group 3',   'Jim, Che, He, Khe',                      'الفبا - گروه ۳',   'ج، چ، ح، خ'),
  ( 9, 'Alphabet Group 4',   'Dal, Zal, Re, Ze, Zhe',                  'الفبا - گروه ۴',   'د، ذ، ر، ز، ژ'),
  (10, 'Alphabet Group 5',   'Sin, Shin',                              'الفبا - گروه ۵',   'س، ش'),
  (11, 'Alphabet Group 6',   'Sad, Zad, Ta, Za',                       'الفبا - گروه ۶',   'ص، ض، ط، ظ'),
  (12, 'Alphabet Group 7',   'Eyn, Gheyn, Fe, Ghaf',                   'الفبا - گروه ۷',   'ع، غ، ف، ق'),
  (13, 'Alphabet Group 8',   'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',   'الفبا - گروه ۸',   'ک، گ، ل، م، ن، و، ه، ی'),
  (14, 'Numbers',            'Count from one to ten in Persian',       'عددها',             'از یک تا ده بشمار'),
  (15, 'Shapes',             'Learn Persian names for basic shapes',   'شکل‌ها',            'اسم شکل‌های ساده رو یاد بگیر'),
  (16, 'Nature',             'Trees, flowers, sun, rain and more',     'طبیعت',             'درخت، گل، خورشید، باران و بیشتر'),
  (17, 'At Home',            'Things you find around the house',      'در خانه',           'چیزهایی که توی خونه پیدا می‌کنی'),
  (18, 'Feelings',           'How do you feel today?',                 'احساس‌ها',          'امروز چه حسی داری؟'),
  (19, 'Actions',            'Everyday verbs in Persian',              'کارها',             'فعل‌های هر روزه به فارسی'),
  (20, 'Greetings',          'Say hello, goodbye and thank you',       'سلام و احوال‌پرسی', 'سلام، خداحافظ و ممنون رو یاد بگیر'),
  (21, 'Clothes',            'Things we wear every day',               'لباس‌ها',           'چیزهایی که هر روز می‌پوشیم'),
  (22, 'Transportation',     'How we get around',                      'وسایل نقلیه',       'با چی جابه‌جا می‌شیم'),
  (23, 'Weather',            'Sunny, rainy, hot and cold',             'آب و هوا',          'آفتابی، بارونی، گرم و سرد'),
  (24, 'At School',          'Words for the classroom',                'مدرسه',             'کلمه‌های کلاس درس'),
  (25, 'Numbers 11-20',      'Keep counting past ten',                 'اعداد ۱۱ تا ۲۰',   'بعد از ده هم بشمار'),
  (26, 'Opposites',          'Big and small, fast and slow',           'متضادها',           'بزرگ و کوچیک، تند و کند'),
  (27, 'Question Words',     'Who, what, where and why',               'کلمه‌های پرسشی',    'کی، چی، کجا و چرا'),
  (28, 'Where Things Are',   'On, under, inside and next to',          'کجاست؟',            'روی، زیر، داخل و کنار')
)
update lessons l
  set title = c.title_fa,
      description = c.description_fa
  from lesson_content c
  where l.order_index = c.order_index;

-- ── Sanity check: every lesson must now have fa title+description
--    translations, and none of the 28 known English source titles or
--    descriptions should remain on the legacy columns ───────────────────
do $$
declare
  missing_fa_title int;
  missing_fa_desc int;
  still_english_title int;
  still_english_desc int;
  total_lessons int;
begin
  select count(*) into total_lessons from lessons;
  if total_lessons <> 28 then
    raise exception 'migration 062: expected 28 lessons, found %. Review lesson_content before proceeding.', total_lessons;
  end if;

  select count(*) into missing_fa_title
    from lessons l
    where not exists (
      select 1 from content_translations t
      where t.entity_type = 'lesson' and t.entity_id = l.id
        and t.locale = 'fa' and t.field = 'title'
    );
  if missing_fa_title > 0 then
    raise exception 'migration 062: % lesson(s) still missing a fa title translation', missing_fa_title;
  end if;

  select count(*) into missing_fa_desc
    from lessons l
    where not exists (
      select 1 from content_translations t
      where t.entity_type = 'lesson' and t.entity_id = l.id
        and t.locale = 'fa' and t.field = 'description'
    );
  if missing_fa_desc > 0 then
    raise exception 'migration 062: % lesson(s) still missing a fa description translation', missing_fa_desc;
  end if;

  select count(*) into still_english_title
    from lessons
    where title in (
      'Animals','Colors','Family','Body Parts','Food & Drink',
      'Alphabet Group 1','Alphabet Group 2','Alphabet Group 3','Alphabet Group 4',
      'Alphabet Group 5','Alphabet Group 6','Alphabet Group 7','Alphabet Group 8',
      'Numbers','Shapes','Nature','At Home','Feelings','Actions','Greetings',
      'Clothes','Transportation','Weather','At School','Numbers 11-20',
      'Opposites','Question Words','Where Things Are'
    );
  if still_english_title > 0 then
    raise exception 'migration 062: % lesson(s) still have an English title on the legacy column', still_english_title;
  end if;

  select count(*) into still_english_desc
    from lessons
    where description in (
      'Learn Persian names for common animals', 'Learn Persian color words',
      'Learn Persian family member names', 'Learn Persian body part names',
      'Learn Persian food and drink words', 'Alef family letters',
      'Be, Pe, Te, Se', 'Jim, Che, He, Khe', 'Dal, Zal, Re, Ze, Zhe',
      'Sin, Shin', 'Sad, Zad, Ta, Za', 'Eyn, Gheyn, Fe, Ghaf',
      'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye',
      'Count from one to ten in Persian', 'Learn Persian names for basic shapes',
      'Trees, flowers, sun, rain and more', 'Things you find around the house',
      'How do you feel today?', 'Everyday verbs in Persian',
      'Say hello, goodbye and thank you', 'Things we wear every day',
      'How we get around', 'Sunny, rainy, hot and cold', 'Words for the classroom',
      'Keep counting past ten', 'Big and small, fast and slow',
      'Who, what, where and why', 'On, under, inside and next to'
    );
  if still_english_desc > 0 then
    raise exception 'migration 062: % lesson(s) still have an English description on the legacy column', still_english_desc;
  end if;
end $$;
