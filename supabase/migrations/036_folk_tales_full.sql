-- KoodakBook — Migration 036: full folk tales
--
-- Wave-1 (mig 035) shipped the five classics in over-compressed 6-page form,
-- losing exactly what makes them work for children: the rule-of-three
-- encounters, the refrains («قِل بخور کدوی من…»، «منم منم مادرتون…») and the
-- call-and-response beats. This replaces each tale's pages with a faithful,
-- age-softened full version (8–12 pages). Story rows keep their ids (progress
-- references survive); pages are replaced wholesale, audio regenerates via the
-- admin batch job.

-- ═══ 0. AI story generation: add storytelling craft ═══════
-- The default system prompt controlled language level but not story quality.
-- Add the craft rules that make the folk tales work: an arc, a refrain,
-- dialogue, page-turn hooks, and a shown-not-told ending. (Prompts are not
-- admin-editable yet, so a migration is the one channel for this.)
update ai_settings set system_prompt =
$sys$You are an expert author of Persian (Farsi) children's stories for heritage learners growing up outside Iran. You write warm, wholesome, age-appropriate stories in clear, natural Tehran-standard Persian, with an accurate English translation for each page.

Language rules: keep vocabulary simple and concrete, reuse the target words naturally, avoid idioms a beginner wouldn't know, and keep sentences short. Never include anything scary or unsafe.

Storytelling craft — follow ALL of these:
- Give the story a real arc: a wish or small problem early, rising attempts, a turning point, and a satisfying resolution. Never a flat sequence of events.
- Invent one short refrain (a repeated line, sound, or mini-song) and repeat it on at least three pages — repetition is how young children join in. Classic Persian openers/closers (یکی بود، یکی نبود… / قصه‌ی ما به سر رسید…) are welcome.
- Use spoken dialogue on most pages; children follow voices better than narration.
- End most pages on a small hook (a question, a surprise, a knock at the door) so the child wants the next page.
- Use the rule of three where it fits: three tries, three friends, three doors.
- Add sensory details children know: smells of bread, warm sunshine, a cold nose.
- Show the feeling or lesson through what characters DO — never write "the moral of the story is".
- The hero named in the request must drive the resolution with their own idea or kindness (not luck, not an adult fixing it).$sys$,
    updated_at = now(), updated_by = 'migration:036'
where id = 1;

-- ═══ 1. کدو قلقله‌زن — 12 pages ═══════════════════════════
delete from story_pages where story_id = (select id from stories where title_persian = 'کدو قلقله‌زن');

insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from stories s, (values
  (1,  'یکی بود، یکی نبود. پیرزن مهربانی بود که دلش برای دخترش تنگ شده بود. گفت: می‌روم به دیدنش!', 'Once upon a time there was a kind old woman who missed her daughter. She said: I''m going to visit her!', '{"scene":"home","time":"day"}'),
  (2,  'راه خانه‌ی دختر از جنگل می‌گذشت. پیرزن راه افتاد و برای خودش آواز خواند.', 'The way to her daughter''s house went through the forest. She set off, singing to herself.', '{"scene":"forest","time":"day"}'),
  (3,  'ناگهان گرگی جلویش پرید: آهای پیرزن! می‌خواهم تو را بخورم!', 'Suddenly a wolf jumped out: Hey old woman! I want to eat you!', '{"scene":"forest","time":"day"}'),
  (4,  'پیرزن گفت: من که پوست و استخوانم! بگذار بروم خانه‌ی دخترم، چاق و چله که شدم برگردم. گرگ قبول کرد.', 'She said: I''m just skin and bones! Let me go to my daughter''s, and I''ll come back nice and plump. The wolf agreed.', '{"scene":"forest","time":"day"}'),
  (5,  'کمی جلوتر شیری غرید: می‌خواهم تو را بخورم! پیرزن همان را گفت: برگشتنی چاق و چله‌ام! شیر هم قبول کرد.', 'A bit further, a lion roared: I want to eat you! She said the same: I''ll be plump on my way back! The lion agreed too.', '{"scene":"forest","time":"day"}'),
  (6,  'بالای کوه، پلنگی پرید: می‌خواهم تو را بخورم! پیرزن خندید: صبر کن برگردم، چاق و چله! پلنگ هم قبول کرد.', 'On the mountain a leopard leapt out: I want to eat you! She smiled: wait till I return, nice and plump! The leopard agreed as well.', '{"scene":"mountain","time":"day"}'),
  (7,  'پیرزن به خانه‌ی دخترش رسید. یک ماهِ تمام ماند؛ آش خورد و نان تازه و انگورِ شیرین.', 'She reached her daughter''s house and stayed a whole month — eating aash, fresh bread, and sweet grapes.', '{"scene":"garden","time":"day"}'),
  (8,  'وقت برگشتن، پیرزن گفت: وای! گرگ و شیر و پلنگ منتظرم هستند! دخترش کدوی بزرگی آورد: بیا توی کدو بنشین!', 'When it was time to go back she said: Oh no! The wolf, lion and leopard are waiting for me! Her daughter brought a big pumpkin: sit inside!', '{"scene":"kitchen","time":"day"}'),
  (9,  'پیرزن توی کدو نشست و کدو غلتید و خواند: قِل بخور، قِل بخور، کدوی قلقله‌زن، برو تا خانه‌مان!', 'The old woman sat inside, and the pumpkin rolled along singing: roll, roll, rolling pumpkin, roll all the way home!', '{"scene":"mountain","time":"day"}'),
  (10, 'پلنگ سر راه پرسید: کدو قلقله‌زن! پیرزن را ندیدی؟ کدو گفت: والله ندیدم، بالله ندیدم! و قِل خورد و رفت.', 'The leopard asked on the way: Rolling pumpkin! Have you seen the old woman? The pumpkin said: No indeed, not at all! — and rolled on.', '{"scene":"mountain","time":"day"}'),
  (11, 'شیر پرسید، گرگ هم پرسید: پیرزن را ندیدی؟ کدو هر بار خواند: ندیدم، ندیدم! و قِل‌قِل‌کنان دور شد.', 'The lion asked, then the wolf: Have you seen her? Each time the pumpkin sang: No, no! — and rolled away.', '{"scene":"forest","time":"day"}'),
  (12, 'کدو به خانه رسید. پیرزن بیرون آمد و خندید: زرنگی از زور بهتر است! قصه‌ی ما به سر رسید.', 'The pumpkin reached home. The old woman climbed out laughing: cleverness beats strength! And so our tale is done.', '{"scene":"home","time":"night"}')
) as v(n, fa, en, sc) where s.title_persian = 'کدو قلقله‌زن';

-- ═══ 2. شنگول و منگول — 12 pages ══════════════════════════
delete from story_pages where story_id = (select id from stories where title_persian = 'شنگول و منگول');

insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from stories s, (values
  (1,  'یکی بود، یکی نبود. بز مهربانی بود با سه بچه: شنگول، منگول و حبه‌ی انگور.', 'Once upon a time there was a kind goat with three kids: Shangul, Mangul, and little Grape-Berry.', '{"scene":"home","time":"day"}'),
  (2,  'مامان‌بز گفت: می‌روم برایتان علفِ تازه و شیر بیاورم. در را فقط برای من باز کنید!', 'Mama Goat said: I''m going to fetch fresh grass and milk. Open the door only for me!', '{"scene":"home","time":"day"}'),
  (3,  'اما گرگ بدجنس پشت دیوار بود و همه‌چیز را شنید!', 'But the wicked wolf was behind the wall and heard everything!', '{"scene":"garden","time":"day"}'),
  (4,  'گرگ در زد و با صدای کلفت خواند: منم منم مادرتان! در را باز کنید! بچه‌ها گفتند: صدای مادر ما نازک است. برو، تو گرگی!', 'The wolf knocked and sang in a deep voice: It''s me, it''s me, your mother! Open up! The kids said: our mother''s voice is soft. Go away, you''re the wolf!', '{"scene":"home","time":"day"}'),
  (5,  'گرگ رفت و صدایش را نازک کرد و برگشت. بچه‌ها گفتند: دستت را از زیر در نشان بده! دستِ گرگ سیاه بود. برو، تو مادر ما نیستی!', 'The wolf made his voice soft and came back. The kids said: show us your paw under the door! The paw was black. Go away, you''re not our mother!', '{"scene":"home","time":"day"}'),
  (6,  'گرگِ حیله‌گر دستش را توی کیسه‌ی آرد فرو کرد تا سفید شد. این بار بچه‌ها گول خوردند و در را باز کردند...', 'The sly wolf dipped his paw in the flour sack until it was white. This time the kids were fooled and opened the door...', '{"scene":"home","time":"day"}'),
  (7,  'گرگ، شنگول و منگول را درسته قورت داد! اما حبه‌ی انگورِ کوچولو زیر تشت قایم شد و گرگ او را ندید.', 'The wolf swallowed Shangul and Mangul whole! But tiny Grape-Berry hid under the washtub, and the wolf never saw her.', '{"scene":"room","time":"day"}'),
  (8,  'مامان‌بز برگشت و دید در باز است و خانه ساکت. حبه‌ی انگور گریه‌کنان بیرون آمد و همه‌چیز را گفت.', 'Mama Goat returned to an open door and a silent house. Grape-Berry came out crying and told her everything.', '{"scene":"home","time":"day"}'),
  (9,  'مامان‌بز شاخ‌هایش را تیز کرد و رفت درِ خانه‌ی گرگ را زد: گرگِ ناقلا! بیا کنار جوی آب مسابقه بدهیم!', 'Mama Goat sharpened her horns and knocked on the wolf''s door: You rascal wolf! Meet me by the stream for a contest!', '{"scene":"forest","time":"day"}'),
  (10, 'کنار جوی آب، مامان‌بز پرید — هوپ! اما گرگِ شکم‌گنده نتوانست. مامان‌بز با شاخ به شکمش زد!', 'By the stream Mama Goat leapt — hop! But the big-bellied wolf couldn''t. Mama Goat struck his belly with her horns!', '{"scene":"park","time":"day"}'),
  (11, 'شکم گرگ باز شد و شنگول و منگول صحیح و سالم بیرون پریدند! گرگ ترسید و پا به فرار گذاشت.', 'The wolf''s belly opened and out jumped Shangul and Mangul, safe and sound! The wolf took fright and ran away.', '{"scene":"park","time":"day"}'),
  (12, 'آن شب مامان‌بز برای بچه‌هایش آواز خواند: دیگر در را برای غریبه باز نکنید! شب به‌خیر، شنگول و منگول!', 'That night Mama Goat sang to her kids: never open the door to strangers again! Good night, Shangul and Mangul!', '{"scene":"room","time":"night"}')
) as v(n, fa, en, sc) where s.title_persian = 'شنگول و منگول';

-- ═══ 3. خاله سوسکه — 12 pages ═════════════════════════════
delete from story_pages where story_id = (select id from stories where title_persian = 'خاله سوسکه');

insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from stories s, (values
  (1,  'یکی بود، یکی نبود. خاله سوسکه تنها بود. گفت: می‌روم همدان، به دیدن عمو رمضان!', 'Once upon a time, Auntie Beetle was lonely. She said: I''m off to Hamedan, to visit Uncle Ramezan!', '{"scene":"home","time":"day"}'),
  (2,  'چادرِ گل‌گلی‌اش را سر کرد، کفش‌های قرمزش را پوشید و قشنگ و خانم راه افتاد.', 'She put on her flowery chador and her little red shoes, and set off looking very fine indeed.', '{"scene":"home","time":"day"}'),
  (3,  'در راه به بازار رسید. همه گفتند: به‌به، خاله سوسکه! کجا به این قشنگی؟', 'On her way she reached the bazaar. Everyone said: My my, Auntie Beetle! Where to, looking so lovely?', '{"scene":"bazaar","time":"day"}'),
  (4,  'بقال گفت: خاله سوسکه، همسر من می‌شوی؟ خاله پرسید: اگر روزی دعوایمان شود، با چه می‌زنی‌ام؟', 'The grocer said: Auntie Beetle, will you marry me? She asked: and if we ever quarrel, what would you hit me with?', '{"scene":"bazaar","time":"day"}'),
  (5,  'بقال گفت: با سنگِ ترازو! خاله سوسکه اخم کرد: نه! من پیش کسی که بزند نمی‌مانم! و رفت.', 'The grocer said: with my scale weight! Auntie Beetle frowned: No! I''ll never stay with anyone who hits! And off she went.', '{"scene":"bazaar","time":"day"}'),
  (6,  'قصاب گفت: با ساطور! نانوا گفت: با پارو! خاله سوسکه به همه گفت: نه و نه و نه!', 'The butcher said: with my cleaver! The baker said: with my bread paddle! To each of them Auntie Beetle said: no, no, and no!', '{"scene":"bazaar","time":"day"}'),
  (7,  'کنار جوی آب، آقا موشه با ادب سلام کرد: خاله سوسکه‌ی قشنگ، همسر من می‌شوی؟', 'By the stream, Mr. Mouse greeted her politely: lovely Auntie Beetle, will you marry me?', '{"scene":"park","time":"day"}'),
  (8,  'خاله پرسید: اگر دعوایمان شود، با چه می‌زنی‌ام؟ آقا موشه گفت: دعوا؟! من با دُمِ نرمم نوازشت می‌کنم!', 'She asked: and if we quarrel, what would you hit me with? Mr. Mouse said: Quarrel?! I would only stroke you with my soft tail!', '{"scene":"park","time":"day"}'),
  (9,  'خاله سوسکه خندید: تو مهربانی! و آن دو با هم عروسی کوچکی گرفتند.', 'Auntie Beetle laughed: you are kind! And the two had a sweet little wedding.', '{"scene":"garden","time":"day"}'),
  (10, 'یک روز آقا موشه خواست از دیگِ آش، نخودی بردارد — لیز خورد و افتاد توی دیگ! کمک! کمک!', 'One day Mr. Mouse reached into the aash pot for a chickpea — slipped, and fell right in! Help! Help!', '{"scene":"kitchen","time":"day"}'),
  (11, 'خاله سوسکه دوید، دُمِ چوبیِ ملاقه را گرفت و آقا موشه را بیرون کشید. آفرین به این همسرِ زرنگ!', 'Auntie Beetle ran, held out the ladle''s wooden handle, and pulled Mr. Mouse out. Hooray for such a clever wife!', '{"scene":"kitchen","time":"day"}'),
  (12, 'از آن روز به بعد، خاله سوسکه و آقا موشه با مهربانی کنار هم زندگی کردند. قصه‌ی ما به سر رسید!', 'From that day on, Auntie Beetle and Mr. Mouse lived kindly side by side. And so our tale is done!', '{"scene":"home","time":"night"}')
) as v(n, fa, en, sc) where s.title_persian = 'خاله سوسکه';

-- ═══ 4. کلاغ و روباه — 8 pages ════════════════════════════
delete from story_pages where story_id = (select id from stories where title_persian = 'کلاغ و روباه');

insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from stories s, (values
  (1, 'کلاغی تکه‌ای پنیر پیدا کرد. خوشحال پرید و بالای شاخه‌ی بلندی نشست تا با خیال راحت بخورد.', 'A crow found a piece of cheese. Delighted, she flew up to a high branch to enjoy it in peace.', '{"scene":"forest","time":"day"}'),
  (2, 'روباهِ گرسنه‌ای از آنجا می‌گذشت. بوی پنیر به دماغش خورد و دهانش آب افتاد.', 'A hungry fox was passing by. The smell of cheese reached his nose and made his mouth water.', '{"scene":"forest","time":"day"}'),
  (3, 'روباه فکری کرد و با صدای مهربان گفت: سلام، کلاغِ زیبا! چه پرهای براقی! چه چشم‌های قشنگی!', 'The fox thought for a moment, then said sweetly: Hello, beautiful crow! What shiny feathers! What lovely eyes!', '{"scene":"forest","time":"day"}'),
  (4, 'کلاغ ذوق کرد و خودش را تکان داد، اما نوکش را محکم بسته نگه داشت.', 'The crow was thrilled and ruffled her feathers proudly — but kept her beak firmly shut.', '{"scene":"forest","time":"day"}'),
  (5, 'روباه ادامه داد: حتماً صدایت از همه‌ی پرنده‌ها قشنگ‌تر است! یک آواز برایم می‌خوانی؟', 'The fox went on: surely your voice is the loveliest of all the birds! Won''t you sing me a song?', '{"scene":"forest","time":"day"}'),
  (6, 'کلاغ دیگر طاقت نیاورد. تا نوکش را باز کرد — قار! قار! — پنیر افتاد پایین.', 'The crow could resist no longer. The moment she opened her beak — caw! caw! — down fell the cheese.', '{"scene":"forest","time":"day"}'),
  (7, 'روباه پنیر را در هوا قاپید و خندید: صدایت قشنگ بود، اما پنیرت خوشمزه‌تر است! و دُمش را تکان داد و رفت.', 'The fox snatched the cheese mid-air and laughed: your voice was lovely, but your cheese is tastier! He wagged his tail and trotted off.', '{"scene":"forest","time":"day"}'),
  (8, 'کلاغ آه کشید و یاد گرفت: هر حرفِ قشنگی را زود باور نکن — شاید کسی فقط پنیرت را بخواهد!', 'The crow sighed and learned: don''t be quick to believe every pretty word — someone may only want your cheese!', '{"scene":"mountain","time":"day"}')
) as v(n, fa, en, sc) where s.title_persian = 'کلاغ و روباه';

-- ═══ 5. خرگوش و لاک‌پشت — 10 pages ════════════════════════
delete from story_pages where story_id = (select id from stories where title_persian = 'خرگوش و لاک‌پشت');

insert into story_pages (story_id, page_number, text_persian, text_english, scene_plan)
select s.id, v.n, v.fa, v.en, v.sc::jsonb from stories s, (values
  (1,  'در دشتی سرسبز، خرگوشی بود که خیلی تند می‌دوید — و خیلی هم پز می‌داد!', 'In a green meadow lived a hare who ran very fast — and boasted about it even more!', '{"scene":"park","time":"day"}'),
  (2,  'هر روز به لاک‌پشت می‌خندید: آهای لاکی! تو تا غروب هم به آن درخت نمی‌رسی!', 'Every day he laughed at the tortoise: Hey Shelly! You couldn''t reach that tree by sunset!', '{"scene":"park","time":"day"}'),
  (3,  'لاک‌پشت آرام گفت: بیا مسابقه بدهیم. خرگوش قاه‌قاه خندید: مسابقه؟ با تو؟ قبول!', 'The tortoise said calmly: let''s race. The hare burst out laughing: A race? With you? You''re on!', '{"scene":"park","time":"day"}'),
  (4,  'خبر در دشت پیچید. جناب کلاغ داور شد و همه‌ی حیوان‌ها کنار مسیر جمع شدند: یک، دو، سه — برو!', 'Word spread across the meadow. Mr. Crow became the judge and all the animals lined the track: one, two, three — go!', '{"scene":"park","time":"day"}'),
  (5,  'خرگوش مثل باد دوید و در یک چشم به‌هم زدن از تپه بالا رفت. لاک‌پشت تازه قدم دوم را برمی‌داشت!', 'The hare shot off like the wind and was over the hill in a blink. The tortoise was just taking his second step!', '{"scene":"mountain","time":"day"}'),
  (6,  'خرگوش پشت سرش را نگاه کرد و گفت: او که حالاحالاها نمی‌رسد! زیر درختی دراز کشید و خوابش برد.', 'The hare looked back and said: he won''t be here for ages! He stretched out under a tree and fell fast asleep.', '{"scene":"forest","time":"day"}'),
  (7,  'اما لاک‌پشت آهسته و پیوسته می‌رفت... قدم، قدم، قدم. نه ایستاد و نه ناامید شد.', 'But the tortoise went slowly and steadily... step, step, step. He neither stopped nor lost heart.', '{"scene":"mountain","time":"day"}'),
  (8,  'از کنار خرگوشِ خواب‌آلود هم آرام گذشت — هیس! — و به تپه‌ی آخر رسید.', 'He even tiptoed right past the sleeping hare — shhh! — and reached the last hill.', '{"scene":"forest","time":"day"}'),
  (9,  'خرگوش از سر و صدای حیوان‌ها بیدار شد. وای! لاک‌پشت نزدیک خط پایان بود! دوید و دوید، اما دیر شده بود.', 'The hare woke to the animals'' cheering. Oh no! The tortoise was nearly at the finish line! He ran and ran, but it was too late.', '{"scene":"park","time":"day"}'),
  (10, 'لاک‌پشت برنده شد و همه هورا کشیدند! خرگوش دستش را فشرد و یاد گرفت: آهسته و پیوسته، برنده‌ی مسابقه است.', 'The tortoise won and everyone cheered! The hare shook his hand and learned: slow and steady wins the race.', '{"scene":"park","time":"day"}')
) as v(n, fa, en, sc) where s.title_persian = 'خرگوش و لاک‌پشت';
