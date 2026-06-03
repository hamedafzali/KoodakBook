-- ═══════════════════════════════════════════════════════════
-- KoodakBook — Content Expansion
-- Adds: ~114 new words, 10 new stories, 7 new lessons, 3 badges
-- ═══════════════════════════════════════════════════════════

-- ── Extended Animals ─────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('اردک',    'duck',       'ordak',      'animals', 1),
  ('قورباغه', 'frog',       'ghurbaghe',  'animals', 1),
  ('خرس',     'bear',       'khers',      'animals', 1),
  ('شتر',     'camel',      'shotor',     'animals', 1),
  ('میمون',   'monkey',     'mimoon',     'animals', 1),
  ('طاووس',   'peacock',    'tavoos',     'animals', 1),
  ('لاک‌پشت', 'turtle',     'lakposht',   'animals', 1),
  ('زنبور',   'bee',        'zanboor',    'animals', 1);

-- ── Extended Colors ───────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('بنفش',     'purple',    'banafsh',    'colors', 1),
  ('قهوه‌ای',  'brown',     'ghahve-ei',  'colors', 1),
  ('خاکستری',  'grey',      'khakestari', 'colors', 1),
  ('طلایی',    'golden',    'talayi',     'colors', 1);

-- ── Extended Family ───────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('عمو',      'uncle',     'amu',        'family', 1),
  ('عمه',      'aunt',      'amme',       'family', 1),
  ('دایی',     'uncle',     'dayi',       'family', 1),
  ('خاله',     'aunt',      'khale',      'family', 1),
  ('پسر عمو',  'cousin',    'pesar amu',  'family', 1),
  ('نوزاد',    'baby',      'nowzad',     'family', 1);

-- ── Extended Body ─────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مو',       'hair',      'mu',         'body', 1),
  ('ابرو',     'eyebrow',   'abru',       'body', 1),
  ('شکم',      'belly',     'shekam',     'body', 1),
  ('زانو',     'knee',      'zanu',       'body', 1),
  ('انگشت',    'finger',    'angosht',    'body', 1),
  ('گردن',     'neck',      'gardan',     'body', 1);

-- ── Extended Food ─────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('موز',      'banana',    'moz',        'food', 1),
  ('پرتقال',   'orange',    'porteghal',  'food', 1),
  ('انگور',    'grapes',    'angoor',     'food', 1),
  ('هندوانه',  'watermelon','hendavane',  'food', 1),
  ('هویج',     'carrot',    'havij',      'food', 1),
  ('ماست',     'yogurt',    'mast',       'food', 1);

-- ── Numbers ───────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('یک',       'one',       'yek',        'nature', 1),
  ('دو',       'two',       'do',         'nature', 1),
  ('سه',       'three',     'se',         'nature', 1),
  ('چهار',     'four',      'chahar',     'nature', 1),
  ('پنج',      'five',      'panj',       'nature', 1),
  ('شش',       'six',       'shesh',      'nature', 1),
  ('هفت',      'seven',     'haft',       'nature', 1),
  ('هشت',      'eight',     'hasht',      'nature', 1),
  ('نه',       'nine',      'noh',        'nature', 1),
  ('ده',       'ten',       'dah',        'nature', 1);

-- ── Shapes ────────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('دایره',    'circle',    'dayere',     'objects', 1),
  ('مربع',     'square',    'moraba',     'objects', 1),
  ('مثلث',     'triangle',  'mosallas',   'objects', 1),
  ('ستاره',    'star',      'setare',     'objects', 1),
  ('قلب',      'heart',     'ghalb',      'objects', 1),
  ('مستطیل',   'rectangle', 'mostatil',   'objects', 1);

-- ── Nature ────────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('درخت',     'tree',      'derakht',    'nature', 1),
  ('گل',       'flower',    'gol',        'nature', 1),
  ('آفتاب',    'sun',       'aftab',      'nature', 1),
  ('ابر',      'cloud',     'abr',        'nature', 1),
  ('باران',    'rain',      'baran',      'nature', 1),
  ('ماه',      'moon',      'mah',        'nature', 1),
  ('برف',      'snow',      'barf',       'nature', 1),
  ('دریا',     'sea',       'darya',      'nature', 1),
  ('کوه',      'mountain',  'kuh',        'nature', 1),
  ('رودخانه',  'river',     'rudkhane',   'nature', 1),
  ('باد',      'wind',      'bad',        'nature', 1),
  ('آسمان',    'sky',       'aseman',     'nature', 1);

-- ── Home Objects ──────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('کتاب',     'book',      'ketab',      'objects', 1),
  ('قلم',      'pen',       'ghalam',     'objects', 1),
  ('میز',      'table',     'miz',        'objects', 1),
  ('صندلی',    'chair',     'sandali',    'objects', 1),
  ('در',       'door',      'dar',        'objects', 1),
  ('پنجره',    'window',    'panjare',    'objects', 1),
  ('کیف',      'bag',       'kif',        'objects', 1),
  ('ساعت',     'clock',     'saat',       'objects', 1),
  ('ماشین',    'car',       'mashin',     'objects', 1),
  ('توپ',      'ball',      'tup',        'objects', 1),
  ('عروسک',    'doll',      'aroosak',    'objects', 1),
  ('تخت',      'bed',       'takht',      'objects', 1);

-- ── Feelings ──────────────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('خوشحال',   'happy',     'khoshhaal',  'body', 1),
  ('ناراحت',   'sad',       'narahat',    'body', 1),
  ('خسته',     'tired',     'khaste',     'body', 1),
  ('گرسنه',    'hungry',    'gorosne',    'body', 1),
  ('ترسیده',   'scared',    'tarsside',   'body', 1),
  ('خنده',     'laugh',     'khande',     'body', 1),
  ('گریه',     'cry',       'gerye',      'body', 1),
  ('عصبانی',   'angry',     'asabani',    'body', 1);

-- ── Actions / Verbs ───────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('خوردن',    'eat',       'khordan',    'objects', 2),
  ('خوابیدن',  'sleep',     'khabidan',   'objects', 2),
  ('دویدن',    'run',       'davidan',    'objects', 2),
  ('بازی',     'play',      'bazi',       'objects', 2),
  ('خواندن',   'read',      'khandan',    'objects', 2),
  ('نوشتن',    'write',     'neveshtan',  'objects', 2),
  ('رفتن',     'go',        'raftan',     'objects', 2),
  ('آمدن',     'come',      'amadan',     'objects', 2),
  ('نشستن',    'sit',       'neshestan',  'objects', 2),
  ('ایستادن',  'stand',     'istadan',    'objects', 2);

-- ── Greetings & Phrases ───────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('سلام',      'hello',    'salam',      'objects', 1),
  ('خداحافظ',   'goodbye',  'khodahafez', 'objects', 1),
  ('ممنون',     'thank you','mamnoon',    'objects', 1),
  ('بله',       'yes',      'bale',       'objects', 1),
  ('نه',        'no',       'na',         'objects', 1),
  ('لطفاً',    'please',   'lotfan',     'objects', 1);

-- ═══════════════════════════════════════════════════════════
-- New Lessons
-- ═══════════════════════════════════════════════════════════

insert into lessons (title, type, stage, order_index, description) values
  ('Numbers',        'vocabulary', 1, 14, 'Count from one to ten in Persian'),
  ('Shapes',         'vocabulary', 1, 15, 'Learn Persian names for basic shapes'),
  ('Nature',         'vocabulary', 1, 16, 'Trees, flowers, sun, rain and more'),
  ('At Home',        'vocabulary', 1, 17, 'Things you find around the house'),
  ('Feelings',       'vocabulary', 1, 18, 'How do you feel today?'),
  ('Actions',        'vocabulary', 2, 19, 'Everyday verbs in Persian'),
  ('Greetings',      'vocabulary', 1, 20, 'Say hello, goodbye and thank you');

-- Wire lesson_items for new lessons
-- Numbers
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Numbers' and w.english in ('one','two','three','four','five','six','seven','eight','nine','ten');

-- Shapes
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Shapes' and w.english in ('circle','square','triangle','star','heart','rectangle');

-- Nature
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Nature' and w.category = 'nature' and w.english not in ('one','two','three','four','five','six','seven','eight','nine','ten');

-- At Home
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'At Home' and w.english in ('book','pen','table','chair','door','window','bag','clock','car','ball','doll','bed');

-- Feelings
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Feelings' and w.english in ('happy','sad','tired','hungry','scared','laugh','cry','angry');

-- Actions
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Actions' and w.english in ('eat','sleep','run','play','read','write','go','come','sit','stand');

-- Greetings
insert into lesson_items (lesson_id, item_type, word_id, order_index)
select l.id, 'word', w.id, row_number() over (order by w.persian)
from lessons l, words w
where l.title = 'Greetings' and w.english in ('hello','goodbye','thank you','yes','no','please');

-- ═══════════════════════════════════════════════════════════
-- New Badges
-- ═══════════════════════════════════════════════════════════

insert into badges (key, title, description) values
  ('words_25',    'Word Master!',     'Learned 25 Persian words'),
  ('stories_3',   'Book Lover!',      'Read 3 Persian stories'),
  ('lessons_5',   'Star Student!',    'Completed 5 lessons')
  on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════
-- New Stories
-- ═══════════════════════════════════════════════════════════

insert into stories (title_persian, title_english, stage, age_min, age_max) values
  ('خرس کوچک و عسل',        'Little Bear and Honey',      3, 4, 7),
  ('پرنده‌ی آبی',            'The Blue Bird',               3, 4, 7),
  ('خانه‌ی ما',              'Our Home',                    3, 4, 7),
  ('جشن نوروز',              'Nowruz Celebration',          3, 5, 9),
  ('شب یلدا',                'Yalda Night',                 3, 5, 9),
  ('در مزرعه',               'On the Farm',                 3, 4, 7),
  ('ماهی قرمز کوچولو',       'The Little Red Fish',         3, 5, 8),
  ('درخت سیب',               'The Apple Tree',              3, 4, 7),
  ('دوستان من',              'My Friends',                  3, 4, 7),
  ('روز بارانی',             'A Rainy Day',                 3, 4, 7);

-- ── Story: Little Bear and Honey ─────────────────────────
with s as (select id from stories where title_english = 'Little Bear and Honey')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک خرس کوچک در جنگل زندگی می‌کرد.',           'A little bear lived in the forest.'),
  ((select id from s), 2, 'خرس عاشق عسل بود.',                             'The bear loved honey.'),
  ((select id from s), 3, 'هر روز دنبال عسل می‌گشت.',                      'Every day he searched for honey.'),
  ((select id from s), 4, 'یک روز یک کندوی بزرگ پیدا کرد.',               'One day he found a big beehive.'),
  ((select id from s), 5, 'زنبورها گفتند: «با ما دوست باش!»',              'The bees said: "Be our friend!"'),
  ((select id from s), 6, 'خرس دوست زنبورها شد و عسل خورد.',               'The bear became friends with the bees and ate honey.'),
  ((select id from s), 7, 'خرس و زنبورها خوشحال بودند.',                   'The bear and the bees were happy.');

-- ── Story: The Blue Bird ──────────────────────────────────
with s as (select id from stories where title_english = 'The Blue Bird')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک پرنده‌ی آبی روی درخت نشسته بود.',           'A blue bird sat on a tree.'),
  ((select id from s), 2, 'پرنده آواز قشنگی می‌خواند.',                    'The bird sang a beautiful song.'),
  ((select id from s), 3, 'همه‌ی حیوان‌ها گوش می‌دادند.',                  'All the animals listened.'),
  ((select id from s), 4, 'گربه گفت: «چه صدای زیبایی!»',                   'The cat said: "What a beautiful voice!"'),
  ((select id from s), 5, 'پرنده پر زد و رفت.',                             'The bird flapped its wings and flew away.'),
  ((select id from s), 6, 'اما آهنگش در جنگل ماند.',                       'But its song stayed in the forest.');

-- ── Story: Our Home ──────────────────────────────────────
with s as (select id from stories where title_english = 'Our Home')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'این خانه‌ی ماست.',                              'This is our home.'),
  ((select id from s), 2, 'در اتاق میز و صندلی داریم.',                    'In the room we have a table and chairs.'),
  ((select id from s), 3, 'پنجره دارد. از پنجره آفتاب می‌آید.',           'It has a window. Sunshine comes through the window.'),
  ((select id from s), 4, 'کتاب‌هایم روی میز است.',                        'My books are on the table.'),
  ((select id from s), 5, 'مامان در آشپزخانه است.',                        'Mom is in the kitchen.'),
  ((select id from s), 6, 'شب‌ها همه دور هم می‌نشینیم.',                  'In the evenings we all sit together.');

-- ── Story: Nowruz Celebration ─────────────────────────────
with s as (select id from stories where title_english = 'Nowruz Celebration')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'نوروز آمد! سال نو شد.',                         'Nowruz is here! The new year has come.'),
  ((select id from s), 2, 'مامان سفره‌ی هفت‌سین چید.',                    'Mom set up the Haft-Sin table.'),
  ((select id from s), 3, 'سبزه‌ی سبز روییده بود.',                       'The green sprouts had grown.'),
  ((select id from s), 4, 'لباس نو پوشیدیم.',                              'We wore new clothes.'),
  ((select id from s), 5, 'پیش مادربزرگ رفتیم.',                           'We went to grandmas house.'),
  ((select id from s), 6, 'مادربزرگ عیدی داد.',                            'Grandma gave us a gift.'),
  ((select id from s), 7, 'همه خندیدند و خوشحال بودند.',                  'Everyone laughed and was happy.');

-- ── Story: Yalda Night ────────────────────────────────────
with s as (select id from stories where title_english = 'Yalda Night')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'شب یلدا طولانی‌ترین شب سال است.',              'Yalda night is the longest night of the year.'),
  ((select id from s), 2, 'همه‌ی خانواده دور هم جمع شدند.',               'The whole family gathered together.'),
  ((select id from s), 3, 'هندوانه و انار خوردیم.',                        'We ate watermelon and pomegranate.'),
  ((select id from s), 4, 'بابابزرگ شعر خواند.',                           'Grandpa read poetry.'),
  ((select id from s), 5, 'ما گوش دادیم.',                                 'We listened.'),
  ((select id from s), 6, 'شمع‌ها می‌سوختند و دل‌مان گرم بود.',          'The candles burned and our hearts were warm.');

-- ── Story: On the Farm ────────────────────────────────────
with s as (select id from stories where title_english = 'On the Farm')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'ما به مزرعه رفتیم.',                            'We went to the farm.'),
  ((select id from s), 2, 'گاو و اسب دیدیم.',                              'We saw a cow and a horse.'),
  ((select id from s), 3, 'مرغ‌ها روی زمین راه می‌رفتند.',                'The chickens were walking on the ground.'),
  ((select id from s), 4, 'یک سگ خوشحال دوید.',                            'A happy dog ran toward us.'),
  ((select id from s), 5, 'سیب از درخت چیدیم.',                            'We picked apples from the tree.'),
  ((select id from s), 6, 'روز قشنگی بود.',                                'It was a beautiful day.');

-- ── Story: The Little Red Fish ────────────────────────────
with s as (select id from stories where title_english = 'The Little Red Fish')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک ماهی قرمز کوچولو در رودخانه بود.',          'A little red fish lived in the river.'),
  ((select id from s), 2, 'ماهی می‌خواست دریا را ببیند.',                  'The fish wanted to see the sea.'),
  ((select id from s), 3, 'مادرش گفت: «دریا خیلی بزرگ است.»',             'His mother said: "The sea is very big."'),
  ((select id from s), 4, 'ماهی شنا کرد و شنا کرد.',                      'The fish swam and swam.'),
  ((select id from s), 5, 'به دریای بزرگ رسید.',                           'He reached the great sea.'),
  ((select id from s), 6, 'ماهی گفت: «چه زیباست!»',                       'The fish said: "How beautiful!"'),
  ((select id from s), 7, 'او شاد بود که شجاع بود.',                       'He was glad he was brave.');

-- ── Story: The Apple Tree ─────────────────────────────────
with s as (select id from stories where title_english = 'The Apple Tree')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'یک درخت سیب در باغچه بود.',                    'There was an apple tree in the garden.'),
  ((select id from s), 2, 'بهار آمد. شکوفه داد.',                          'Spring came. It blossomed.'),
  ((select id from s), 3, 'تابستان آمد. سیب‌های قرمز شدند.',              'Summer came. The apples turned red.'),
  ((select id from s), 4, 'پرنده‌ها روی درخت می‌نشستند.',                 'Birds sat on the tree.'),
  ((select id from s), 5, 'بچه‌ها سیب می‌چیدند.',                         'Children picked the apples.'),
  ((select id from s), 6, 'درخت هر سال هدیه می‌داد.',                     'Every year the tree gave a gift.');

-- ── Story: My Friends ─────────────────────────────────────
with s as (select id from stories where title_english = 'My Friends')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'من دوستان خوبی دارم.',                          'I have good friends.'),
  ((select id from s), 2, 'با هم بازی می‌کنیم.',                           'We play together.'),
  ((select id from s), 3, 'وقتی ناراحتم، دوستم کمکم می‌کند.',             'When I am sad, my friend helps me.'),
  ((select id from s), 4, 'با هم می‌خندیم.',                               'We laugh together.'),
  ((select id from s), 5, 'دوست داشتن قشنگ است.',                          'Having friends is beautiful.');

-- ── Story: A Rainy Day ────────────────────────────────────
with s as (select id from stories where title_english = 'A Rainy Day')
insert into story_pages (story_id, page_number, text_persian, text_english) values
  ((select id from s), 1, 'صبح باران می‌آمد.',                             'In the morning it was raining.'),
  ((select id from s), 2, 'ابرهای خاکستری آسمان را پوشانده بودند.',       'Grey clouds covered the sky.'),
  ((select id from s), 3, 'چکمه پوشیدم و بیرون رفتم.',                    'I put on my boots and went outside.'),
  ((select id from s), 4, 'در آبِ باران پریدم!',                           'I jumped in the rain puddles!'),
  ((select id from s), 5, 'مامان خندید.',                                  'Mom laughed.'),
  ((select id from s), 6, 'باران قشنگ است.',                               'Rain is beautiful.');
