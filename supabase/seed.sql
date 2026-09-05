-- ── Badges ────────────────────────────────────────────────
insert into badges (key, title, description) values
  ('first_lesson', 'First Step!',      'Completed your first lesson'),
  ('first_story',  'Storyteller!',     'Read your first Persian story'),
  ('words_10',     'Word Collector!',  'Learned 10 Persian words'),
  ('streak_7',     '7 Days Strong!',   'Practiced 7 days in a row'),
  ('all_alphabet', 'Alphabet Hero!',   'Completed the full alphabet module')
on conflict (key) do nothing;

-- ── Words — Animals ───────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('گربه',    'cat',      'gorbe',       'animals', 1),
  ('سگ',      'dog',      'sag',         'animals', 1),
  ('اسب',     'horse',    'asb',         'animals', 1),
  ('گاو',     'cow',      'gav',         'animals', 1),
  ('مرغ',     'chicken',  'morgh',       'animals', 1),
  ('ماهی',    'fish',     'mahi',        'animals', 1),
  ('خرگوش',   'rabbit',   'khargoosh',   'animals', 1),
  ('فیل',     'elephant', 'fil',         'animals', 1)
on conflict (persian, english) do nothing;

-- ── Words — Colors ────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('قرمز',    'red',      'ghermez',     'colors', 1),
  ('آبی',     'blue',     'abi',         'colors', 1),
  ('سبز',     'green',    'sabz',        'colors', 1),
  ('زرد',     'yellow',   'zard',        'colors', 1),
  ('سفید',    'white',    'sefid',       'colors', 1),
  ('مشکی',    'black',    'meshki',      'colors', 1),
  ('نارنجی',  'orange',   'naranji',     'colors', 1),
  ('صورتی',   'pink',     'surati',      'colors', 1)
on conflict (persian, english) do nothing;

-- ── Words — Family ────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مامان',   'mom',      'maman',       'family', 1),
  ('بابا',    'dad',      'baba',        'family', 1),
  ('خواهر',   'sister',   'khahar',      'family', 1),
  ('برادر',   'brother',  'baradar',     'family', 1),
  ('مادربزرگ','grandma',  'madarbozorg', 'family', 1),
  ('پدربزرگ', 'grandpa',  'pedarbozorg', 'family', 1)
on conflict (persian, english) do nothing;

-- ── Words — Body ──────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('سر',      'head',     'sar',         'body', 1),
  ('چشم',     'eye',      'cheshm',      'body', 1),
  ('دهان',    'mouth',    'dahan',       'body', 1),
  ('دست',     'hand',     'dast',        'body', 1),
  ('پا',      'foot',     'pa',          'body', 1),
  ('گوش',     'ear',      'gush',        'body', 1)
on conflict (persian, english) do nothing;

-- ── Words — Food ──────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('نان',     'bread',    'nan',         'food', 1),
  ('آب',      'water',    'ab',          'food', 1),
  ('شیر',     'milk',     'shir',        'food', 1),
  ('سیب',     'apple',    'sib',         'food', 1),
  ('برنج',    'rice',     'berenji',     'food', 1),
  ('تخم‌مرغ', 'egg',      'tokhm morgh', 'food', 1)
on conflict (persian, english) do nothing;

-- ── Letters ───────────────────────────────────────────────
-- آ (alef + madda) is a diacritic form of ا, not a distinct letter of the
-- 32-letter Persian alphabet — see migration 058_merge_alef_mad.sql, which
-- also removes it from any database seeded before this line changed.
insert into letters (character, name_persian, name_english, "group", order_in_group) values
  ('ا', 'الف',     'Alef',    1, 1),
  ('ب', 'به',      'Be',      2, 1),
  ('پ', 'په',      'Pe',      2, 2),
  ('ت', 'ته',      'Te',      2, 3),
  ('ث', 'ثه',      'Se',      2, 4),
  ('ج', 'جیم',     'Jim',     3, 1),
  ('چ', 'چه',      'Che',     3, 2),
  ('ح', 'حه',      'He',      3, 3),
  ('خ', 'خه',      'Khe',     3, 4),
  ('د', 'دال',     'Dal',     4, 1),
  ('ذ', 'ذال',     'Zal',     4, 2),
  ('ر', 'ره',      'Re',      4, 3),
  ('ز', 'زه',      'Ze',      4, 4),
  ('ژ', 'ژه',      'Zhe',     4, 5),
  ('س', 'سین',     'Sin',     5, 1),
  ('ش', 'شین',     'Shin',    5, 2),
  ('ص', 'صاد',     'Sad',     6, 1),
  ('ض', 'ضاد',     'Zad',     6, 2),
  ('ط', 'طا',      'Ta',      6, 3),
  ('ظ', 'ظا',      'Za',      6, 4),
  ('ع', 'عین',     'Eyn',     7, 1),
  ('غ', 'غین',     'Gheyn',   7, 2),
  ('ف', 'فه',      'Fe',      7, 3),
  ('ق', 'قاف',     'Ghaf',    7, 4),
  ('ک', 'کاف',     'Kaf',     8, 1),
  ('گ', 'گاف',     'Gaf',     8, 2),
  ('ل', 'لام',     'Lam',     8, 3),
  ('م', 'میم',     'Mim',     8, 4),
  ('ن', 'نون',     'Nun',     8, 5),
  ('و', 'واو',     'Vav',     8, 6),
  ('ه', 'هه',      'He',      8, 7),
  ('ی', 'یه',      'Ye',      8, 8)
on conflict (character) do nothing;

-- Diacritized letter names for TTS (mirrors migration 030 for fresh installs):
-- without harakat, engines read «ره» as the word "rah" instead of the letter.
-- Fresh installs run this seed BEFORE the backend applies migrations, so the
-- column must be created here too (030 is add-if-not-exists — safe both ways).
alter table letters add column if not exists tts_text text;
update letters set tts_text = v.t
from (values
  ('ا', 'اَلِف'), ('آ', 'اَلِف مَد'), ('ب', 'بِه'), ('پ', 'پِه'), ('ت', 'تِه'),
  ('ث', 'ثِه'), ('چ', 'چِه'), ('ح', 'حِه'), ('خ', 'خِه'), ('ر', 'رِه'),
  ('ز', 'زِه'), ('ژ', 'ژِه'), ('ف', 'فِه'), ('ه', 'هِه'), ('ی', 'یِه')
) as v(c, t)
where letters.character = v.c and letters.tts_text is null;

-- ── Lessons ───────────────────────────────────────────────
insert into lessons (title, type, stage, order_index, description) values
  ('Animals',          'vocabulary', 1,  1, 'Learn Persian names for common animals'),
  ('Colors',           'vocabulary', 1,  2, 'Learn Persian color words'),
  ('Family',           'vocabulary', 1,  3, 'Learn Persian family member names'),
  ('Body Parts',       'vocabulary', 1,  4, 'Learn Persian body part names'),
  ('Food & Drink',     'vocabulary', 1,  5, 'Learn Persian food and drink words'),
  ('Alphabet Group 1', 'alphabet',   2,  6, 'Alef family letters'),
  ('Alphabet Group 2', 'alphabet',   2,  7, 'Be, Pe, Te, Se'),
  ('Alphabet Group 3', 'alphabet',   2,  8, 'Jim, Che, He, Khe'),
  ('Alphabet Group 4', 'alphabet',   2,  9, 'Dal, Zal, Re, Ze, Zhe'),
  ('Alphabet Group 5', 'alphabet',   2, 10, 'Sin, Shin'),
  ('Alphabet Group 6', 'alphabet',   2, 11, 'Sad, Zad, Ta, Za'),
  ('Alphabet Group 7', 'alphabet',   2, 12, 'Eyn, Gheyn, Fe, Ghaf'),
  ('Alphabet Group 8', 'alphabet',   2, 13, 'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye')
on conflict (order_index) do nothing;

-- ── Lesson items ──────────────────────────────────────────
-- Use INSERT ... SELECT so there is no scalar subquery risk
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (partition by l.id order by w.persian)
from lessons l join words w on w.category = 'animals'
where l.title = 'Animals';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (partition by l.id order by w.persian)
from lessons l join words w on w.category = 'colors'
where l.title = 'Colors';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (partition by l.id order by w.persian)
from lessons l join words w on w.category = 'family'
where l.title = 'Family';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (partition by l.id order by w.persian)
from lessons l join words w on w.category = 'body'
where l.title = 'Body Parts';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (partition by l.id order by w.persian)
from lessons l join words w on w.category = 'food'
where l.title = 'Food & Drink';

insert into lesson_items (lesson_id, item_type, letter_id, order_index)
select l.id, 'letter', lt.id, lt.order_in_group
from lessons l
join letters lt on lt."group" = (l.order_index - 5)
where l.type = 'alphabet';

-- ── Stories ───────────────────────────────────────────────
insert into stories (title_persian, title_english, stage, age_min, age_max) values
  ('گربه‌ی کوچک',    'The Little Cat',       3, 4, 7),
  ('رنگ‌های باغچه',  'Colors of the Garden', 3, 4, 7),
  ('خانواده‌ی خرس',  'The Bear Family',      3, 5, 8),
  ('ماهی و دریا',    'The Fish and the Sea', 3, 5, 8),
  ('نان سحرگاه',     'The Morning Bread',    3, 6, 9)
on conflict (title_english) do nothing;

-- ── Story pages — use JOIN instead of scalar subquery ─────
insert into story_pages (story_id, page_number, text_persian, text_english)
select s.id, p.num, p.fa, p.en
from stories s
join (values
  (1, 'یک گربه‌ی کوچک بود.',         'There was a little cat.'),
  (2, 'گربه چشم‌های آبی داشت.',      'The cat had blue eyes.'),
  (3, 'گربه با یک سگ دوست شد.',      'The cat became friends with a dog.'),
  (4, 'آن‌ها با هم بازی کردند.',     'They played together.'),
  (5, 'شب شد. گربه به خانه رفت.',    'Night came. The cat went home.')
) as p(num, fa, en) on true
where s.title_english = 'The Little Cat';

insert into story_pages (story_id, page_number, text_persian, text_english)
select s.id, p.num, p.fa, p.en
from stories s
join (values
  (1, 'در باغچه گل‌های قرمز بود.',   'In the garden there were red flowers.'),
  (2, 'پرنده‌های آبی پریدند.',        'Blue birds flew.'),
  (3, 'سبزه‌های سبز رشد کردند.',     'Green grass grew.'),
  (4, 'خورشید زرد می‌درخشید.',       'The yellow sun shone.'),
  (5, 'باغچه خیلی زیبا بود.',        'The garden was very beautiful.')
) as p(num, fa, en) on true
where s.title_english = 'Colors of the Garden';
