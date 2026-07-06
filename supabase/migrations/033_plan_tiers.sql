-- KoodakBook — Migration 033: plan tiers for the public pricing page
--
-- Adds family-size tiers (the old single 'premium' becomes the family plan)
-- and a yearly option. The landing page renders whatever is active here, so
-- pricing is managed from the admin plans panel — not hardcoded in the site.
--
-- ai_stories_per_day: daily cap on AI story generation ('' / absent = no cap).

-- users.plan was hard-checked to ('free','premium') back in mig 008 — plans
-- are DB rows now (mig 024), so the enum-style constraint must go or new
-- tiers can never be assigned.
alter table users drop constraint if exists users_plan_check;

insert into plans (key, name, description, price_cents, interval, is_default, sort) values
  ('premium_solo', 'پرمیوم تک‌فرزند', 'برای خانواده‌های تک‌فرزند — کتابخانه کامل و ۲ داستان شخصی در روز', 499, 'month', false, 1),
  ('premium_duo',  'پرمیوم دو فرزند', 'دو پروفایل کودک — کتابخانه کامل و ۴ داستان شخصی در روز',           699, 'month', false, 2),
  ('premium_yearly', 'پرمیوم خانواده — سالانه', 'پلن خانواده با پرداخت سالانه — دو ماه رایگان',          9990, 'year', false, 4)
on conflict (key) do nothing;

-- The old 'premium' is now the monthly family tier.
update plans set name = 'پرمیوم خانواده',
                 description = 'تا ۵ کودک — کتابخانه کامل و داستان‌های شخصی نامحدود',
                 sort = 3
 where key = 'premium';

insert into plan_features (plan_id, feature_key, value)
  select p.id, t.k, t.v from plans p
  cross join (values
    ('max_children','1'),('full_story_library','true'),('ai_stories','true'),
    ('ai_stories_per_day','2'),('co_read','true'),('record_voice','true')
  ) as t(k, v) where p.key = 'premium_solo'
on conflict do nothing;

insert into plan_features (plan_id, feature_key, value)
  select p.id, t.k, t.v from plans p
  cross join (values
    ('max_children','2'),('full_story_library','true'),('ai_stories','true'),
    ('ai_stories_per_day','4'),('co_read','true'),('record_voice','true')
  ) as t(k, v) where p.key = 'premium_duo'
on conflict do nothing;

insert into plan_features (plan_id, feature_key, value)
  select p.id, t.k, t.v from plans p
  cross join (values
    ('max_children','5'),('full_story_library','true'),('ai_stories','true'),
    ('co_read','true'),('record_voice','true')
  ) as t(k, v) where p.key = 'premium_yearly'
on conflict do nothing;
