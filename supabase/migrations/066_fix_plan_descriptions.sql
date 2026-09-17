-- KoodakBook — Migration 066: correct false "full library" claim in plan descriptions
--
-- Found 2026-09-17 while auditing public-page/AI-discoverability content
-- (llms.txt, Pricing.tsx) for accuracy: migration 033 set every paid plan's
-- `description` column to lead with "کتابخانه کامل" (full story library) as
-- the headline premium benefit. That claim was already found false and
-- removed from Pricing.tsx's feature bullets and PLAN_FEATURES earlier this
-- session (GET /api/curriculum/stories returns every non-AI story to any
-- caller, free or paid — there was never a gate) — but `plans.description`
-- is a separate free-text column rendered directly on the pricing card
-- (Pricing.tsx, parent/plan/page.tsx), not filtered through PLAN_FEATURES,
-- so it kept the same false claim live even after that fix.
--
-- Conditioned on the OLD text (not just `where key = ...`) so this is a
-- no-op if an admin has already hand-edited a description since 033 ran —
-- this migration corrects the original mistake, it doesn't overwrite a
-- deliberate later edit.
update plans set description = 'برای خانواده‌های تک‌فرزند — روزی ۲ داستان شخصی با هوش مصنوعی'
 where key = 'premium_solo'
   and description = 'برای خانواده‌های تک‌فرزند — کتابخانه کامل و ۲ داستان شخصی در روز';

update plans set description = 'دو پروفایل کودک — روزی ۴ داستان شخصی با هوش مصنوعی'
 where key = 'premium_duo'
   and description = 'دو پروفایل کودک — کتابخانه کامل و ۴ داستان شخصی در روز';

update plans set description = 'تا ۵ کودک — داستان‌های شخصی نامحدود با هوش مصنوعی'
 where key = 'premium'
   and description = 'تا ۵ کودک — کتابخانه کامل و داستان‌های شخصی نامحدود';

-- The free plan's own description had the opposite problem: it implies a
-- limitation ("چند داستان اول" — only the first few stories) that doesn't
-- exist. GET /api/curriculum/stories returns the complete library to every
-- caller regardless of plan (same finding as above) — free was never
-- actually capped to "a few first stories." Corrected to state what's
-- really true, matching llms.txt's own "free permanently" framing.
update plans set description = 'کتابخانه کامل داستان و درس‌های پایه — همیشه رایگان'
 where key = 'free'
   and description = 'دسترسی پایه — چند داستان اول';
