-- KoodakBook — Migration 041: free-plan AI-story cap
--
-- Strategy (docs/product-review-2026-07.md): identical educational quality
-- for every plan — monetize QUANTITY. Free accounts previously had no
-- ai_stories_per_day feature at all, i.e. unlimited AI stories (with, from
-- now on, premium narration). Cap free at 1/day; paid tiers ladder 2/4/∞.
insert into plan_features (plan_id, feature_key, value)
select p.id, 'ai_stories_per_day', '1' from plans p where p.key = 'free'
on conflict (plan_id, feature_key) do update set value = excluded.value;
