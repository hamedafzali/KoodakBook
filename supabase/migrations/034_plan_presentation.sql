-- KoodakBook — Migration 034: plan presentation controls
--
-- The pricing section (site + in-app upgrade page) renders straight from the
-- plans table, so how a plan is *shown* becomes admin-managed too:
--   is_public   — appears in the public catalogue at all (is_active stays the
--                 "can be assigned/used" switch; a plan can be active for
--                 existing subscribers but hidden from new ones)
--   show_price  — display the price, or «قیمت به‌زودی اعلام می‌شود»
--   purchasable — CTA is live; false shows «به‌زودی» (checkout not shipped)
--   badge       — optional ribbon text; its presence highlights the card
alter table plans add column if not exists is_public   boolean not null default true;
alter table plans add column if not exists show_price  boolean not null default true;
alter table plans add column if not exists purchasable boolean not null default false;
alter table plans add column if not exists badge       text;

-- Free plan is "purchasable" (signup works today); paid tiers stay به‌زودی.
update plans set purchasable = true where price_cents = 0;
update plans set badge = 'پیشنهاد خانواده‌ها' where key = 'premium' and badge is null;
update plans set badge = '۲ ماه رایگان' where key = 'premium_yearly' and badge is null;
