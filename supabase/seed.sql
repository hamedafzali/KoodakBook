-- ── Badges ────────────────────────────────────────────────
insert into badges (key, title, description) values
  ('first_lesson', 'First Step!',      'Completed your first lesson'),
  ('first_story',  'Storyteller!',     'Read your first Persian story'),
  ('words_10',     'Word Collector!',  'Learned 10 Persian words'),
  ('streak_7',     '7 Days Strong!',   'Practiced 7 days in a row'),
  ('all_alphabet', 'Alphabet Hero!',   'Completed the full alphabet module')
  on conflict do nothing;

-- ── Words — Animals ───────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('گربه',   'cat',      'gorbe',   'animals', 1),
  ('سگ',     'dog',      'sag',     'animals', 1),
  ('اسب',    'horse',    'asb',     'animals', 1),
  ('گاو',    'cow',      'gav',     'animals', 1),
  ('مرغ',    'chicken',  'morgh',   'animals', 1),
  ('ماهی',   'fish',     'mahi',    'animals', 1),
  ('خرگوش',  'rabbit',   'khargoosh','animals',1),
  ('پرنده',  'bird',     'parande', 'animals', 1),
  ('فیل',    'elephant', 'fil',     'animals', 1),
  ('شیر',    'lion',     'shir',    'animals', 1)
  on conflict do nothing;

-- ── Words — Colors ────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('قرمز',   'red',      'ghermez', 'colors', 1),
  ('آبی',    'blue',     'abi',     'colors', 1),
  ('سبز',    'green',    'sabz',    'colors', 1),
  ('زرد',    'yellow',   'zard',    'colors', 1),
  ('سفید',   'white',    'sefid',   'colors', 1),
  ('مشکی',   'black',    'meshki',  'colors', 1),
  ('نارنجی', 'orange',   'narenji', 'colors', 1),
  ('صورتی',  'pink',     'surati',  'colors', 1)
  on conflict do nothing;

-- ── Words — Family ────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مامان',  'mom',       'maman',  'family', 1),
  ('بابا',   'dad',       'baba',   'family', 1),
  ('خواهر',  'sister',    'khvahar','family', 1),
  ('برادر',  'brother',   'baradar','family', 1),
  ('مادربزرگ','grandmother','madar bozorg','family',1),
  ('پدربزرگ','grandfather','pedar bozorg','family',1)
  on conflict do nothing;

-- ── Words — Body ──────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('چشم',   'eye',    'cheshm',  'body', 1),
  ('دست',   'hand',   'dast',    'body', 1),
  ('پا',    'foot',   'pa',      'body', 1),
  ('دهان',  'mouth',  'dahan',   'body', 1),
  ('گوش',   'ear',    'gush',    'body', 1),
  ('بینی',  'nose',   'bini',    'body', 1)
  on conflict do nothing;

-- ── Words — Food ──────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('نان',   'bread',  'nan',     'food', 1),
  ('آب',    'water',  'ab',      'food', 1),
  ('شیر',   'milk',   'shir',    'food', 1),
  ('سیب',   'apple',  'sib',     'food', 1),
  ('برنج',  'rice',   'berenji', 'food', 1),
  ('تخم‌مرغ','egg',   'tokhm morgh','food',1)
  on conflict do nothing;

-- ── Letters ───────────────────────────────────────────────
insert into letters (character, name_persian, name_english, "group", order_in_group) values
  -- Group 1: Alef family
  ('ا', 'الف',  'Alef',  1, 1),
  ('آ', 'الف مد','Alef Mad',1,2),
  -- Group 2: Be family
  ('ب', 'به',   'Be',    2, 1),
  ('پ', 'په',   'Pe',    2, 2),
  ('ت', 'ته',   'Te',    2, 3),
  ('ث', 'ثه',   'Se',    2, 4),
  -- Group 3: Jim family
  ('ج', 'جیم',  'Jim',   3, 1),
  ('چ', 'چه',   'Che',   3, 2),
  ('ح', 'حه',   'He',    3, 3),
  ('خ', 'خه',   'Khe',   3, 4),
  -- Group 4: Dal family
  ('د', 'دال',  'Dal',   4, 1),
  ('ذ', 'ذال',  'Zal',   4, 2),
  ('ر', 'ره',   'Re',    4, 3),
  ('ز', 'زه',   'Ze',    4, 4),
  ('ژ', 'ژه',   'Zhe',   4, 5),
  -- Group 5: Sin family
  ('س', 'سین',  'Sin',   5, 1),
  ('ش', 'شین',  'Shin',  5, 2),
  -- Group 6: Sad family
  ('ص', 'صاد',  'Sad',   6, 1),
  ('ض', 'ضاد',  'Zad',   6, 2),
  ('ط', 'طاه',  'Ta',    6, 3),
  ('ظ', 'ظاه',  'Za',    6, 4),
  -- Group 7: Eyn family
  ('ع', 'عین',  'Eyn',   7, 1),
  ('غ', 'غین',  'Gheyn', 7, 2),
  ('ف', 'فه',   'Fe',    7, 3),
  ('ق', 'قاف',  'Ghaf',  7, 4),
  -- Group 8: Kaf family
  ('ک', 'کاف',  'Kaf',   8, 1),
  ('گ', 'گاف',  'Gaf',   8, 2),
  ('ل', 'لام',  'Lam',   8, 3),
  ('م', 'میم',  'Mim',   8, 4),
  ('ن', 'نون',  'Nun',   8, 5),
  ('و', 'واو',  'Vav',   8, 6),
  ('ه', 'هه',   'He',    8, 7),
  ('ی', 'یه',   'Ye',    8, 8)
  on conflict do nothing;

-- ── Lessons ───────────────────────────────────────────────
insert into lessons (title, type, stage, order_index, description) values
  ('Animals',          'vocabulary', 1, 1,  'Learn Persian names for common animals'),
  ('Colors',           'vocabulary', 1, 2,  'Learn Persian color words'),
  ('Family',           'vocabulary', 1, 3,  'Learn Persian family member names'),
  ('Body Parts',       'vocabulary', 1, 4,  'Learn Persian body part names'),
  ('Food & Drink',     'vocabulary', 1, 5,  'Learn Persian food and drink words'),
  ('Alphabet Group 1', 'alphabet',   2, 6,  'Alef family letters'),
  ('Alphabet Group 2', 'alphabet',   2, 7,  'Be, Pe, Te, Se'),
  ('Alphabet Group 3', 'alphabet',   2, 8,  'Jim, Che, He, Khe'),
  ('Alphabet Group 4', 'alphabet',   2, 9,  'Dal, Zal, Re, Ze, Zhe'),
  ('Alphabet Group 5', 'alphabet',   2, 10, 'Sin, Shin'),
  ('Alphabet Group 6', 'alphabet',   2, 11, 'Sad, Zad, Ta, Za'),
  ('Alphabet Group 7', 'alphabet',   2, 12, 'Eyn, Gheyn, Fe, Ghaf'),
  ('Alphabet Group 8', 'alphabet',   2, 13, 'Kaf, Gaf, Lam, Mim, Nun, Vav, He, Ye')
  on conflict do nothing;

-- ── Lesson items ─────────────────────────────────────────
-- Animals lesson
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Animals' and w.category = 'animals'
  on conflict do nothing;

-- Colors lesson
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Colors' and w.category = 'colors'
  on conflict do nothing;

-- Family lesson
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Family' and w.category = 'family'
  on conflict do nothing;

-- Body Parts lesson
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Body Parts' and w.category = 'body'
  on conflict do nothing;

-- Food & Drink lesson
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Food & Drink' and w.category = 'food'
  on conflict do nothing;

-- Alphabet lessons — each group maps to its letters
insert into lesson_items (lesson_id, item_type, letter_id, order_index)
select l.id, 'letter', lt.id, lt.order_in_group
from lessons l
join letters lt on lt."group" = (l.order_index - 5)
where l.type = 'alphabet'
  on conflict do nothing;

-- ── Stories ───────────────────────────────────────────────
insert into stories (title_persian, title_english, stage, age_min, age_max) values
  ('گربه‌ی کوچک',          'The Little Cat',       3, 4, 7),
  ('رنگ‌های باغچه',        'Colors of the Garden', 3, 4, 7),
  ('خانواده‌ی خرس',        'The Bear Family',      3, 5, 8),
  ('ماهی و دریا',          'The Fish and the Sea', 3, 5, 8),
  ('نان سحرگاه',           'The Morning Bread',    3, 6, 9)
  on conflict do nothing;

-- ── Story pages — Story 1: The Little Cat ────────────────
with s as (select id from stories where title_english = 'The Little Cat')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک گربه‌ی کوچک بود.',          'There was a little cat.'),
  ((select id from s), 2, 'گربه چشم‌های آبی داشت.',       'The cat had blue eyes.'),
  ((select id from s), 3, 'گربه با یک سگ دوست شد.',       'The cat became friends with a dog.'),
  ((select id from s), 4, 'آن‌ها با هم بازی کردند.',      'They played together.'),
  ((select id from s), 5, 'شب شد. گربه به خانه رفت.',     'Night came. The cat went home.')
  on conflict do nothing;

-- ── Story pages — Story 2: Colors of the Garden ──────────
with s as (select id from stories where title_english = 'Colors of the Garden')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'در باغچه گل‌های قرمز بود.',   'In the garden there were red flowers.'),
  ((select id from s), 2, 'پرنده‌های آبی پریدند.',        'Blue birds flew.'),
  ((select id from s), 3, 'سبزه‌های سبز رشد کردند.',     'Green grass grew.'),
  ((select id from s), 4, 'خورشید زرد می‌درخشید.',       'The yellow sun shone.'),
  ((select id from s), 5, 'باغچه خیلی زیبا بود.',        'The garden was very beautiful.')
  on conflict do nothing;
