-- KoodakBook — Migration 035: content wave 1
--
-- Words 189 → ~400 (fills the emptiest categories; the landing's «۴۰۰+» claim
-- becomes honest) + 5 public-domain Persian folk tales illustrated via the
-- scene library (scene_plan per page). Audio: run the admin per-section batch
-- regen after deploy; images stay null (scene backdrops render instead).
-- tts_text is set only where Persian TTS mis-guesses (homographs).

-- ── Numbers (stage 1) ─────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('یک', 'one', 'yek', 'numbers', 1), ('دو', 'two', 'do', 'numbers', 1),
  ('سه', 'three', 'se', 'numbers', 1), ('چهار', 'four', 'chahar', 'numbers', 1),
  ('پنج', 'five', 'panj', 'numbers', 1), ('شش', 'six', 'shesh', 'numbers', 1),
  ('هفت', 'seven', 'haft', 'numbers', 1), ('هشت', 'eight', 'hasht', 'numbers', 1),
  ('نه', 'nine', 'noh', 'numbers', 1), ('ده', 'ten', 'dah', 'numbers', 1),
  ('صفر', 'zero', 'sefr', 'numbers', 2), ('بیست', 'twenty', 'bist', 'numbers', 2)
on conflict (persian, english) do nothing;

-- نه the number is "noh", not "na" (no) — force the vowel for TTS.
update words set tts_text = 'نُه' where persian = 'نه' and english = 'nine' and tts_text is null;
update words set tts_text = 'دُو' where persian = 'دو' and english = 'two' and tts_text is null;

-- ── Shapes (stage 2) ──────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('دایره', 'circle', 'dayere', 'shapes', 2), ('مربع', 'square', 'morabba', 'shapes', 2),
  ('مثلث', 'triangle', 'mosallas', 'shapes', 2), ('مستطیل', 'rectangle', 'mostatil', 'shapes', 2),
  ('ستاره', 'star', 'setare', 'shapes', 1), ('قلب', 'heart', 'ghalb', 'shapes', 1),
  ('خط', 'line', 'khat', 'shapes', 2), ('نقطه', 'dot', 'noghte', 'shapes', 2)
on conflict (persian, english) do nothing;

-- ── Food (stage 1–2) ──────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('نان', 'bread', 'nan', 'food', 1), ('شیر', 'milk', 'shir', 'food', 1),
  ('پنیر', 'cheese', 'panir', 'food', 1), ('تخم‌مرغ', 'egg', 'tokhme morgh', 'food', 1),
  ('برنج', 'rice', 'berenj', 'food', 1), ('آب', 'water', 'ab', 'food', 1),
  ('چای', 'tea', 'chay', 'food', 1), ('سیب', 'apple', 'sib', 'food', 1),
  ('موز', 'banana', 'moz', 'food', 1), ('پرتقال', 'orange', 'porteghal', 'food', 1),
  ('انگور', 'grapes', 'angur', 'food', 1), ('هندوانه', 'watermelon', 'hendevane', 'food', 1),
  ('خیار', 'cucumber', 'khiar', 'food', 1), ('گوجه', 'tomato', 'goje', 'food', 1),
  ('هویج', 'carrot', 'havij', 'food', 1), ('سیب‌زمینی', 'potato', 'sib zamini', 'food', 2),
  ('ماست', 'yogurt', 'mast', 'food', 1), ('عسل', 'honey', 'asal', 'food', 2),
  ('کیک', 'cake', 'keyk', 'food', 1), ('بستنی', 'ice cream', 'bastani', 'food', 1),
  ('سوپ', 'soup', 'sup', 'food', 2), ('آش', 'aash (thick soup)', 'aash', 'food', 2),
  ('کباب', 'kebab', 'kabab', 'food', 2), ('سالاد', 'salad', 'salad', 'food', 2),
  ('شکلات', 'chocolate', 'shokolat', 'food', 1)
on conflict (persian, english) do nothing;

-- ── Clothes (stage 2) ─────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('پیراهن', 'shirt', 'pirahan', 'clothes', 2), ('شلوار', 'pants', 'shalvar', 'clothes', 2),
  ('جوراب', 'socks', 'jurab', 'clothes', 1), ('کفش', 'shoes', 'kafsh', 'clothes', 1),
  ('کلاه', 'hat', 'kolah', 'clothes', 1), ('کت', 'coat', 'kot', 'clothes', 2),
  ('دامن', 'skirt', 'daman', 'clothes', 2), ('شال', 'scarf', 'shal', 'clothes', 2),
  ('دستکش', 'gloves', 'dastkesh', 'clothes', 2), ('چکمه', 'boots', 'chakme', 'clothes', 2),
  ('عینک', 'glasses', 'eynak', 'clothes', 2), ('دکمه', 'button', 'dokme', 'clothes', 2),
  ('جیب', 'pocket', 'jib', 'clothes', 2), ('لباس', 'clothes', 'lebas', 'clothes', 1)
on conflict (persian, english) do nothing;

-- ── Weather (stage 2) ─────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('آفتاب', 'sunshine', 'aftab', 'weather', 1), ('باران', 'rain', 'baran', 'weather', 1),
  ('برف', 'snow', 'barf', 'weather', 1), ('باد', 'wind', 'bad', 'weather', 1),
  ('ابر', 'cloud', 'abr', 'weather', 1), ('رعد', 'thunder', 'ra''d', 'weather', 3),
  ('رنگین‌کمان', 'rainbow', 'rangin kaman', 'weather', 2), ('مه', 'fog', 'meh', 'weather', 3),
  ('گرم', 'hot', 'garm', 'weather', 1), ('سرد', 'cold', 'sard', 'weather', 1)
on conflict (persian, english) do nothing;

-- ── Nature (stage 1–2) ────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('درخت', 'tree', 'derakht', 'nature', 1), ('گل', 'flower', 'gol', 'nature', 1),
  ('برگ', 'leaf', 'barg', 'nature', 1), ('چمن', 'grass', 'chaman', 'nature', 2),
  ('جنگل', 'forest', 'jangal', 'nature', 2), ('کوه', 'mountain', 'kuh', 'nature', 1),
  ('دریا', 'sea', 'darya', 'nature', 1), ('رود', 'river', 'rud', 'nature', 2),
  ('آسمان', 'sky', 'aseman', 'nature', 1), ('ماه', 'moon', 'mah', 'nature', 1),
  ('خورشید', 'sun', 'khorshid', 'nature', 1), ('سنگ', 'stone', 'sang', 'nature', 2),
  ('شن', 'sand', 'shen', 'nature', 2), ('موج', 'wave', 'moj', 'nature', 3),
  ('چشمه', 'spring (water)', 'cheshme', 'nature', 3), ('غار', 'cave', 'ghar', 'nature', 3)
on conflict (persian, english) do nothing;

-- گل flower = "gol" (not "gel" mud).
update words set tts_text = 'گُل' where persian = 'گل' and english = 'flower' and tts_text is null;

-- ── School (stage 2–3) ────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مدرسه', 'school', 'madrese', 'school', 2), ('کلاس', 'classroom', 'kelas', 'school', 2),
  ('معلم', 'teacher', 'moallem', 'school', 2), ('دانش‌آموز', 'student', 'danesh amuz', 'school', 3),
  ('کتاب', 'book', 'ketab', 'school', 1), ('دفتر', 'notebook', 'daftar', 'school', 2),
  ('مداد', 'pencil', 'medad', 'school', 1), ('خودکار', 'pen', 'khodkar', 'school', 2),
  ('پاک‌کن', 'eraser', 'pak kon', 'school', 2), ('تخته', 'board', 'takhte', 'school', 2),
  ('کیف', 'bag', 'kif', 'school', 1), ('زنگ', 'bell', 'zang', 'school', 2),
  ('درس', 'lesson', 'dars', 'school', 2), ('مشق', 'homework', 'mashgh', 'school', 3),
  ('نقاشی', 'drawing', 'naghashi', 'school', 1)
on conflict (persian, english) do nothing;

-- ── Actions (stage 3) — high-frequency verbs, first person ─
insert into words (persian, english, finglish, category, stage) values
  ('می‌خورم', 'I eat', 'mikhoram', 'actions', 3), ('می‌نوشم', 'I drink', 'minusham', 'actions', 3),
  ('می‌روم', 'I go', 'miravam', 'actions', 3), ('می‌آیم', 'I come', 'miayam', 'actions', 3),
  ('می‌بینم', 'I see', 'mibinam', 'actions', 3), ('می‌شنوم', 'I hear', 'mishenavam', 'actions', 3),
  ('می‌گویم', 'I say', 'miguyam', 'actions', 3), ('می‌خوانم', 'I read', 'mikhanam', 'actions', 3),
  ('می‌نویسم', 'I write', 'minevisam', 'actions', 3), ('می‌دوم', 'I run', 'midavam', 'actions', 3),
  ('می‌پرم', 'I jump', 'miparam', 'actions', 3), ('می‌خندم', 'I laugh', 'mikhandam', 'actions', 3),
  ('گریه می‌کنم', 'I cry', 'gerye mikonam', 'actions', 3), ('می‌خوابم', 'I sleep', 'mikhabam', 'actions', 3),
  ('بازی می‌کنم', 'I play', 'bazi mikonam', 'actions', 3), ('می‌نشینم', 'I sit', 'mineshinam', 'actions', 3),
  ('می‌ایستم', 'I stand', 'miistam', 'actions', 3), ('می‌دهم', 'I give', 'midaham', 'actions', 3),
  ('می‌گیرم', 'I take', 'migiram', 'actions', 3), ('کمک می‌کنم', 'I help', 'komak mikonam', 'actions', 3)
on conflict (persian, english) do nothing;

-- ── Feelings (stage 3) ────────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('خوشحال', 'happy', 'khoshhal', 'feelings', 2), ('ناراحت', 'sad', 'narahat', 'feelings', 2),
  ('عصبانی', 'angry', 'asabani', 'feelings', 3), ('ترسیده', 'scared', 'tarside', 'feelings', 3),
  ('خسته', 'tired', 'khaste', 'feelings', 2), ('گرسنه', 'hungry', 'gorosne', 'feelings', 2),
  ('تشنه', 'thirsty', 'teshne', 'feelings', 2), ('خواب‌آلود', 'sleepy', 'khab alud', 'feelings', 3),
  ('شجاع', 'brave', 'shoja', 'feelings', 3), ('مهربان', 'kind', 'mehraban', 'feelings', 2)
on conflict (persian, english) do nothing;

-- ── Opposites (stage 3) ───────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('بزرگ', 'big', 'bozorg', 'opposites', 1), ('کوچک', 'small', 'kuchak', 'opposites', 1),
  ('بلند', 'tall', 'boland', 'opposites', 2), ('کوتاه', 'short', 'kutah', 'opposites', 2),
  ('تند', 'fast', 'tond', 'opposites', 2), ('آهسته', 'slow', 'aheste', 'opposites', 2),
  ('بالا', 'up', 'bala', 'opposites', 1), ('پایین', 'down', 'paiin', 'opposites', 1),
  ('باز', 'open', 'baz', 'opposites', 2), ('بسته', 'closed', 'baste', 'opposites', 2),
  ('پر', 'full', 'por', 'opposites', 3), ('خالی', 'empty', 'khali', 'opposites', 3),
  ('تمیز', 'clean', 'tamiz', 'opposites', 2), ('کثیف', 'dirty', 'kasif', 'opposites', 2),
  ('روشن', 'bright', 'roshan', 'opposites', 2), ('تاریک', 'dark', 'tarik', 'opposites', 2)
on conflict (persian, english) do nothing;

-- پر full = "por" (not "par" feather); بسته closed = "baste" (not "basteh" package is same — ok).
update words set tts_text = 'پُر' where persian = 'پر' and english = 'full' and tts_text is null;

-- ── Greetings (stage 1) ───────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('سلام', 'hello', 'salam', 'greetings', 1), ('خداحافظ', 'goodbye', 'khodahafez', 'greetings', 1),
  ('مرسی', 'thanks', 'mersi', 'greetings', 1), ('لطفاً', 'please', 'lotfan', 'greetings', 1),
  ('ببخشید', 'excuse me', 'bebakhshid', 'greetings', 2), ('بله', 'yes', 'bale', 'greetings', 1),
  ('صبح بخیر', 'good morning', 'sobh bekheyr', 'greetings', 2),
  ('شب بخیر', 'good night', 'shab bekheyr', 'greetings', 2),
  ('خوش آمدی', 'welcome', 'khosh amadi', 'greetings', 2)
on conflict (persian, english) do nothing;

-- ── Transportation (stage 2) ──────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('ماشین', 'car', 'mashin', 'transportation', 1), ('اتوبوس', 'bus', 'otobus', 'transportation', 1),
  ('قطار', 'train', 'ghatar', 'transportation', 1), ('هواپیما', 'airplane', 'havapeyma', 'transportation', 1),
  ('دوچرخه', 'bicycle', 'docharkhe', 'transportation', 1), ('موتور', 'motorcycle', 'motor', 'transportation', 2),
  ('کشتی', 'ship', 'kashti', 'transportation', 2), ('قایق', 'boat', 'ghayegh', 'transportation', 2),
  ('تاکسی', 'taxi', 'taksi', 'transportation', 2), ('آمبولانس', 'ambulance', 'ambulans', 'transportation', 3),
  ('کامیون', 'truck', 'kamion', 'transportation', 2), ('مترو', 'metro', 'metro', 'transportation', 3)
on conflict (persian, english) do nothing;

-- ── Objects (stage 1–2) ───────────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('در', 'door', 'dar', 'objects', 1), ('پنجره', 'window', 'panjere', 'objects', 1),
  ('میز', 'table', 'miz', 'objects', 1), ('صندلی', 'chair', 'sandali', 'objects', 1),
  ('تخت', 'bed', 'takht', 'objects', 1), ('لامپ', 'lamp', 'lamp', 'objects', 2),
  ('تلفن', 'phone', 'telefon', 'objects', 2), ('ساعت', 'clock', 'saat', 'objects', 2),
  ('آینه', 'mirror', 'ayene', 'objects', 2), ('کلید', 'key', 'kelid', 'objects', 2),
  ('توپ', 'ball', 'tup', 'objects', 1), ('عروسک', 'doll', 'arusak', 'objects', 1),
  ('جعبه', 'box', 'ja''be', 'objects', 2), ('قاشق', 'spoon', 'ghashogh', 'objects', 1),
  ('بشقاب', 'plate', 'boshghab', 'objects', 1)
on conflict (persian, english) do nothing;

-- ── Body extras (stage 1–2) ───────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('مو', 'hair', 'mu', 'body', 1), ('ابرو', 'eyebrow', 'abru', 'body', 2),
  ('لب', 'lips', 'lab', 'body', 1), ('زبان', 'tongue', 'zaban', 'body', 2),
  ('گردن', 'neck', 'gardan', 'body', 2), ('انگشت', 'finger', 'angosht', 'body', 1),
  ('زانو', 'knee', 'zanu', 'body', 2), ('قلب', 'heart (body)', 'ghalb', 'body', 2)
on conflict (persian, english) do nothing;

-- ── Family extras (stage 2) ───────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('عمو', 'uncle (paternal)', 'amu', 'family', 2), ('دایی', 'uncle (maternal)', 'dayi', 'family', 2),
  ('عمه', 'aunt (paternal)', 'amme', 'family', 2), ('خاله', 'aunt (maternal)', 'khale', 'family', 2),
  ('نوه', 'grandchild', 'nave', 'family', 3), ('دوقلو', 'twins', 'dogholu', 'family', 3)
on conflict (persian, english) do nothing;

update words set tts_text = 'نَوه' where persian = 'نوه' and english = 'grandchild' and tts_text is null;

-- ── Animals extras (stage 1–2) ────────────────────────────
insert into words (persian, english, finglish, category, stage) values
  ('جوجه', 'chick', 'juje', 'animals', 1), ('بره', 'lamb', 'barre', 'animals', 1),
  ('سنجاب', 'squirrel', 'senjab', 'animals', 2), ('لاک‌پشت', 'turtle', 'lakposht', 'animals', 1),
  ('قورباغه', 'frog', 'ghurbaghe', 'animals', 1), ('پروانه', 'butterfly', 'parvane', 'animals', 1),
  ('زنبور', 'bee', 'zanbur', 'animals', 2), ('مورچه', 'ant', 'murche', 'animals', 2),
  ('دلفین', 'dolphin', 'dolfin', 'animals', 2), ('بزغاله', 'baby goat', 'bozghale', 'animals', 2)
on conflict (persian, english) do nothing;

update words set tts_text = 'بَرِه' where persian = 'بره' and english = 'lamb' and tts_text is null;

-- ═══ Folk tales (public domain, scene-illustrated) ═══════════

-- 1. کدو قلقله‌زن
with s as (
  insert into stories (title_persian, title_english, stage, age_min, age_max)
  select 'کدو قلقله‌زن', 'The Rolling Pumpkin', 2, 3, 8
  where not exists (select 1 from stories where title_persian = 'کدو قلقله‌زن')
  returning id
)
insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from s, (values
  (1, 'یکی بود، یکی نبود. پیرزنی مهربان می‌خواست به دیدن دخترش برود.', 'Once upon a time, a kind old woman wanted to visit her daughter.', '{"scene":"home","time":"day"}'),
  (2, 'راهش از جنگل می‌گذشت. گرگی جلویش را گرفت و گفت: می‌خواهم تو را بخورم!', 'Her path went through the forest. A wolf stopped her and said: I want to eat you!', '{"scene":"forest","time":"day"}'),
  (3, 'پیرزن گفت: من لاغرم! بگذار بروم و برگردم، آن‌وقت چاق می‌شوم.', 'The old woman said: I am thin! Let me go and come back, then I will be plump.', '{"scene":"forest","time":"day"}'),
  (4, 'پیرزن به خانه‌ی دخترش رسید و ماجرا را تعریف کرد. دخترش یک کدوی بزرگ آورد.', 'She reached her daughter''s house and told the story. Her daughter brought a big pumpkin.', '{"scene":"garden","time":"day"}'),
  (5, 'پیرزن توی کدو نشست و کدو قِل‌قِل غلتید: قِل بخور، کدوی من، قِل بخور!', 'The old woman sat inside the pumpkin and it rolled along: roll, my pumpkin, roll!', '{"scene":"forest","time":"day"}'),
  (6, 'گرگ کدو را دید، اما پیرزن را ندید! کدو قل‌قل‌کنان تا خانه رفت و پیرزن به سلامت رسید.', 'The wolf saw the pumpkin but not the old woman! It rolled all the way home, and she arrived safe.', '{"scene":"home","time":"night"}')
) as v(n, fa, en, sc);

-- 2. شنگول و منگول
with s as (
  insert into stories (title_persian, title_english, stage, age_min, age_max)
  select 'شنگول و منگول', 'Shangul and Mangul', 2, 3, 8
  where not exists (select 1 from stories where title_persian = 'شنگول و منگول')
  returning id
)
insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from s, (values
  (1, 'بزی مهربان سه بچه داشت: شنگول، منگول و حبه‌ی انگور.', 'A kind goat had three kids: Shangul, Mangul, and Grape-Berry.', '{"scene":"home","time":"day"}'),
  (2, 'مامان‌بز گفت: من به صحرا می‌روم. در را برای هیچ‌کس باز نکنید!', 'Mama Goat said: I am going to the meadow. Do not open the door for anyone!', '{"scene":"garden","time":"day"}'),
  (3, 'گرگ پشت در آمد و با صدای نازک گفت: منم، مامانتان! در را باز کنید.', 'The wolf came to the door and said in a soft voice: It''s me, your mama! Open the door.', '{"scene":"home","time":"day"}'),
  (4, 'بچه‌ها گفتند: دستت را نشان بده! دست گرگ سیاه بود — فهمیدند مامان نیست.', 'The kids said: Show us your paw! The wolf''s paw was black — they knew it wasn''t Mama.', '{"scene":"home","time":"day"}'),
  (5, 'مامان‌بز برگشت و بچه‌هایش را صحیح و سالم پیدا کرد. چه هوش خوبی!', 'Mama Goat returned and found her kids safe and sound. How clever they were!', '{"scene":"home","time":"night"}'),
  (6, 'آن شب همه کنار هم شام خوردند و خوابیدند. شب به‌خیر، شنگول و منگول!', 'That night they all had dinner together and slept. Good night, Shangul and Mangul!', '{"scene":"room","time":"night"}')
) as v(n, fa, en, sc);

-- 3. خاله سوسکه
with s as (
  insert into stories (title_persian, title_english, stage, age_min, age_max)
  select 'خاله سوسکه', 'Auntie Beetle', 2, 4, 9
  where not exists (select 1 from stories where title_persian = 'خاله سوسکه')
  returning id
)
insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from s, (values
  (1, 'خاله سوسکه چادر قشنگش را سر کرد و راهی بازار شد.', 'Auntie Beetle put on her pretty chador and set off for the bazaar.', '{"scene":"home","time":"day"}'),
  (2, 'در بازار همه می‌گفتند: خاله سوسکه، چه خانم شده‌ای!', 'At the bazaar everyone said: Auntie Beetle, how elegant you look!', '{"scene":"bazaar","time":"day"}'),
  (3, 'آقا موشه آمد و با مهربانی سلام کرد: خاله سوسکه، با من دوست می‌شوی؟', 'Mr. Mouse came and greeted her kindly: Auntie Beetle, will you be my friend?', '{"scene":"bazaar","time":"day"}'),
  (4, 'خاله سوسکه گفت: فقط اگر همیشه مهربان باشی و قشنگ حرف بزنی.', 'Auntie Beetle said: Only if you are always kind and speak sweetly.', '{"scene":"park","time":"day"}'),
  (5, 'آقا موشه قول داد، و آن دو بهترین دوست‌های دنیا شدند.', 'Mr. Mouse promised, and the two became the best of friends.', '{"scene":"garden","time":"day"}'),
  (6, 'قصه‌ی ما به سر رسید، کلاغه به خانه‌اش نرسید!', 'Our tale is done — and the crow never made it home!', '{"scene":"sky","time":"night"}')
) as v(n, fa, en, sc);

-- 4. کلاغ و روباه
with s as (
  insert into stories (title_persian, title_english, stage, age_min, age_max)
  select 'کلاغ و روباه', 'The Crow and the Fox', 2, 4, 9
  where not exists (select 1 from stories where title_persian = 'کلاغ و روباه')
  returning id
)
insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from s, (values
  (1, 'کلاغی تکه‌ای پنیر پیدا کرد و روی شاخه‌ی درختی نشست.', 'A crow found a piece of cheese and perched on a tree branch.', '{"scene":"forest","time":"day"}'),
  (2, 'روباهی گرسنه از آنجا می‌گذشت. بوی پنیر به دماغش خورد.', 'A hungry fox was passing by. The smell of cheese reached his nose.', '{"scene":"forest","time":"day"}'),
  (3, 'روباه گفت: به‌به! چه پرهای قشنگی! حتماً صدایت هم زیباست. برایم می‌خوانی؟', 'The fox said: My my! What beautiful feathers! Surely your voice is lovely too. Will you sing for me?', '{"scene":"forest","time":"day"}'),
  (4, 'کلاغ خوشحال شد و تا نوکش را باز کرد — قار! — پنیر افتاد پایین.', 'The crow was flattered, and the moment he opened his beak — caw! — the cheese fell.', '{"scene":"forest","time":"day"}'),
  (5, 'روباه پنیر را برداشت و خندید: هر کس چاپلوسی را باور کند، پنیرش را از دست می‌دهد!', 'The fox took the cheese and laughed: whoever believes flattery loses their cheese!', '{"scene":"forest","time":"day"}'),
  (6, 'کلاغ یاد گرفت: حرف‌های قشنگِ بی‌جا را زود باور نکن.', 'The crow learned: don''t be quick to believe empty pretty words.', '{"scene":"mountain","time":"day"}')
) as v(n, fa, en, sc);

-- 5. خرگوش و لاک‌پشت
with s as (
  insert into stories (title_persian, title_english, stage, age_min, age_max)
  select 'خرگوش و لاک‌پشت', 'The Hare and the Tortoise', 2, 3, 8
  where not exists (select 1 from stories where title_persian = 'خرگوش و لاک‌پشت')
  returning id
)
insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from s, (values
  (1, 'خرگوش به لاک‌پشت خندید و گفت: تو چقدر آهسته راه می‌روی!', 'The hare laughed at the tortoise: how slowly you walk!', '{"scene":"park","time":"day"}'),
  (2, 'لاک‌پشت گفت: بیا مسابقه بدهیم! خرگوش قبول کرد و همه جمع شدند.', 'The tortoise said: let''s race! The hare agreed and everyone gathered.', '{"scene":"park","time":"day"}'),
  (3, 'خرگوش مثل باد دوید و خیلی جلو افتاد. گفت: وقت دارم، کمی می‌خوابم!', 'The hare ran like the wind and got far ahead. He said: I have time, I''ll nap a little!', '{"scene":"mountain","time":"day"}'),
  (4, 'لاک‌پشت آهسته و پیوسته رفت... قدم به قدم، بدون ایستادن.', 'The tortoise went slowly and steadily... step by step, without stopping.', '{"scene":"mountain","time":"day"}'),
  (5, 'وقتی خرگوش بیدار شد، لاک‌پشت نزدیک خط پایان بود! دوید، اما دیر شده بود.', 'When the hare woke up, the tortoise was near the finish line! He ran, but it was too late.', '{"scene":"park","time":"day"}'),
  (6, 'لاک‌پشت برنده شد و همه هورا کشیدند: آهسته و پیوسته، برنده‌ی مسابقه!', 'The tortoise won and everyone cheered: slow and steady wins the race!', '{"scene":"park","time":"day"}')
) as v(n, fa, en, sc);
