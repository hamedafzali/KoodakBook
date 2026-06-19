-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Migration 012: curriculum expansion (from content audit)
--
-- Adds the Critical missing categories the audit flagged as higher-ROI than
-- more nouns: opposites, question words, prepositions, clothes, transportation,
-- weather, school, plus numbers 11–20 and the natural toddler word نی‌نی.
--
-- Transliteration follows one scheme for all new rows: long vowels u / i,
-- short a/e/o, digraphs kh gh ch sh zh. (A full regen of the older ~210 rows
-- is tracked separately — see the audit's top-ROI list.)
--
-- Dual-writes every new word into content_translations (fa / en / fa-Latn).
-- ═══════════════════════════════════════════════════════════

-- ── Widen the category check to admit the new themes ──────
alter table words drop constraint if exists words_category_check;
alter table words add constraint words_category_check check (category in (
  'animals','colors','family','food','body','nature','objects',
  'numbers','shapes','feelings','actions','greetings',
  'clothes','transportation','weather','school','opposites','questions','prepositions'
));

-- ── Family: the natural toddler word for "baby" ───────────
insert into words (persian, english, finglish, category, stage) values
  ('نی‌نی', 'baby', 'nini', 'family', 1)
on conflict (persian, english) do nothing;

-- ── Numbers 11–20 ─────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('یازده',   'eleven',    'yazdah',    'numbers', 1),
  ('دوازده',  'twelve',    'davazdah',  'numbers', 1),
  ('سیزده',   'thirteen',  'sizdah',    'numbers', 1),
  ('چهارده',  'fourteen',  'chahardah', 'numbers', 1),
  ('پانزده',  'fifteen',   'panzdah',   'numbers', 1),
  ('شانزده',  'sixteen',   'shanzdah',  'numbers', 1),
  ('هفده',    'seventeen', 'hefdah',    'numbers', 1),
  ('هجده',    'eighteen',  'hejdah',    'numbers', 1),
  ('نوزده',   'nineteen',  'nuzdah',    'numbers', 1),
  ('بیست',    'twenty',    'bist',      'numbers', 1)
on conflict (persian, english) do nothing;

-- ── Clothes ───────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('لباس',    'clothes',  'lebas',    'clothes', 1),
  ('پیراهن',  'shirt',    'pirahan',  'clothes', 1),
  ('شلوار',   'pants',    'shalvar',  'clothes', 1),
  ('کفش',     'shoes',    'kafsh',    'clothes', 1),
  ('کلاه',    'hat',      'kolah',    'clothes', 1),
  ('جوراب',   'socks',    'jurab',    'clothes', 1),
  ('کاپشن',   'jacket',   'kapshen',  'clothes', 1)
on conflict (persian, english) do nothing;

-- ── Transportation ────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('اتوبوس',  'bus',         'otobus',    'transportation', 1),
  ('هواپیما', 'airplane',    'havapeyma', 'transportation', 1),
  ('قطار',    'train',       'ghatar',    'transportation', 1),
  ('دوچرخه',  'bicycle',     'docharkhe', 'transportation', 1),
  ('کشتی',    'ship',        'kashti',    'transportation', 1),
  ('قایق',    'boat',        'ghayegh',   'transportation', 1),
  ('موتور',   'motorcycle',  'motor',     'transportation', 1)
on conflict (persian, english) do nothing;

-- ── Weather ───────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('هوا',     'weather', 'hava',   'weather', 1),
  ('گرم',     'hot',     'garm',   'weather', 1),
  ('سرد',     'cold',    'sard',   'weather', 1),
  ('آفتابی',  'sunny',   'aftabi', 'weather', 1),
  ('بارانی',  'rainy',   'barani', 'weather', 1),
  ('ابری',    'cloudy',  'abri',   'weather', 1),
  ('برفی',    'snowy',   'barfi',  'weather', 1)
on conflict (persian, english) do nothing;

-- ── School ────────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مدرسه',   'school',   'madrese', 'school', 1),
  ('معلم',    'teacher',  'moallem', 'school', 1),
  ('کلاس',    'class',    'kelas',   'school', 1),
  ('مداد',    'pencil',   'medad',   'school', 1),
  ('دفتر',    'notebook', 'daftar',  'school', 1),
  ('درس',     'lesson',   'dars',    'school', 1)
on conflict (persian, english) do nothing;

-- ── Opposites (Stage 2 — more abstract) ───────────────────
insert into words (persian, english, finglish, category, stage) values
  ('بزرگ',    'big',    'bozorg', 'opposites', 2),
  ('کوچک',    'small',  'kuchak', 'opposites', 2),
  ('بلند',    'tall',   'boland', 'opposites', 2),
  ('کوتاه',   'short',  'kutah',  'opposites', 2),
  ('باز',     'open',   'baz',    'opposites', 2),
  ('بسته',    'closed', 'baste',  'opposites', 2),
  ('تند',     'fast',   'tond',   'opposites', 2),
  ('آرام',    'slow',   'aram',   'opposites', 2),
  ('روشن',    'light',  'roshan', 'opposites', 2),
  ('تاریک',   'dark',   'tarik',  'opposites', 2)
on conflict (persian, english) do nothing;

-- ── Question words (Stage 2) ──────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('چی',      'what',     'chi',   'questions', 2),
  ('کی',      'who',      'ki',    'questions', 2),
  ('کجا',     'where',    'koja',  'questions', 2),
  ('چرا',     'why',      'chera', 'questions', 2),
  ('چند',     'how many', 'chand', 'questions', 2),
  ('کِی',     'when',     'key',   'questions', 2)
on conflict (persian, english) do nothing;

-- ── Prepositions (Stage 2) ────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('روی',     'on',          'ruye',  'prepositions', 2),
  ('زیر',     'under',       'zir',   'prepositions', 2),
  ('داخل',    'inside',      'dakhel','prepositions', 2),
  ('کنار',    'beside',      'kenar', 'prepositions', 2),
  ('پشت',     'behind',      'posht', 'prepositions', 2),
  ('جلو',     'in front of', 'jelo',  'prepositions', 2),
  ('بیرون',   'outside',     'birun', 'prepositions', 2)
on conflict (persian, english) do nothing;

-- ═══════════════════════════════════════════════════════════
-- New lessons (order_index continues after 20 = Greetings)
-- ═══════════════════════════════════════════════════════════
insert into lessons (title, type, stage, order_index, description) values
  ('Clothes',         'vocabulary', 1, 21, 'What we wear every day'),
  ('Transportation',  'vocabulary', 1, 22, 'How we get around'),
  ('Weather',         'vocabulary', 1, 23, 'Sunny, rainy, hot and cold'),
  ('At School',       'vocabulary', 1, 24, 'Words for the classroom'),
  ('Numbers 11–20',   'vocabulary', 1, 25, 'Keep counting past ten'),
  ('Opposites',       'vocabulary', 2, 26, 'Big and small, fast and slow'),
  ('Question Words',  'vocabulary', 2, 27, 'Who, what, where and why'),
  ('Where Things Are','vocabulary', 2, 28, 'On, under, inside and beside')
on conflict (order_index) do nothing;

-- ── Wire lesson_items (membership by english, like migration 003) ──
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Clothes' and w.category = 'clothes';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Transportation' and w.category = 'transportation';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Weather' and w.category = 'weather';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'At School' and w.category = 'school';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Numbers 11–20'
  and w.english in ('eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty');

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Opposites' and w.category = 'opposites';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Question Words' and w.category = 'questions';

insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Where Things Are' and w.category = 'prepositions';

-- ── Dual-write new words into the language-agnostic model ──
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'fa', 'text', persian from words
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'en', 'text', english from words
on conflict do nothing;
insert into content_translations (entity_type, entity_id, locale, field, value)
  select 'word', id, 'fa-Latn', 'text', finglish from words where finglish is not null and finglish <> ''
on conflict do nothing;
