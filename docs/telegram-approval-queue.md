# Telegram post approval queue

Nothing reaches the public `@koodakbook_app` channel without a human
approving it first. Code:
[`apps/backend/src/routes/adminPostDrafts.ts`](../apps/backend/src/routes/adminPostDrafts.ts)
(queue + review) and
[`apps/backend/src/lib/postDraftGenerator.ts`](../apps/backend/src/lib/postDraftGenerator.ts)
(AI-scheduled content). Admin panel:
[`apps/admin/src/app/dashboard/post-drafts/page.tsx`](../apps/admin/src/app/dashboard/post-drafts/page.tsx).

## Shape

`post_drafts` (migration 055) is the one table every producer writes to and
the one table the review endpoint reads from:

```
source        story_published | ai_scheduled
source_ref    story id, or the ai_scheduled kind — traceability only
text          the exact message body, ready to post as-is
status        pending | approved | rejected
reviewed_at / reviewed_by / review_note
posted_at / post_result   set once a send is actually attempted
```

- `createDraft()` (exported from `adminPostDrafts.ts`) is the only insert
  path. It never calls Telegram — it writes the row and pings the admin
  (`lib/adminNotify.notifyNewDraft`, the private bot from
  `docs/admin-notify.md`) so a draft doesn't sit unnoticed.
- `postToChannel()` (`lib/telegramChannel.ts`) is the only send path. It is
  called from exactly one place: the review endpoint, and only on
  `decision: 'approved'`.

## Where you review

**Admin panel** (`/dashboard/post-drafts`) — the primary surface. Lists
pending drafts with the full rendered text, تأیید و ارسال (approve-and-send,
one action) or رد (reject, requires a reason). Approved/rejected tabs keep
history for reference.

**Telegram** (the admin bot from item #1) — sends a notification the moment
a draft is created, so you know to go look, but carries no inline
approve/reject button in this version. Handling a Telegram `callback_query`
needs its own auth/webhook plumbing; skipped for now since the panel is the
real review surface. Worth adding later only if the panel proves to be a
bottleneck in practice.

## What happens to each decision

- **Approved** → sent immediately (`postToChannel`), `posted_at`/`post_result`
  recorded. If the send itself fails (Telegram down, bad token), the draft
  stays `approved` with `post_result = 'error'` and the panel shows a تلاش
  دوباره (retry) button — re-posting to the same review endpoint retries the
  send without re-litigating the approval.
- **Rejected** → kept, not deleted, with the reason. Visible under the
  "رد شده" tab for audit ("I keep rejecting the AI's Yalda drafts, tone is
  off"). Not re-editable into a new post — if the content is still wanted,
  generate or write a fresh draft.

## The old direct-post path is gone

`admin.ts`'s `POST /stories` used to call `telegramChannel.announceNewStory`
directly on save — stories auto-announced to the channel with no review.
That call is now `createDraft({ source: 'story_published', ... })`: every
new story queues a draft instead, going through the same approval as
everything else. `renderNewStoryMessage` still lives in `telegramChannel.ts`
as the pure text-builder; nothing calls `postToChannel` from `admin.ts`
anymore.

## AI-scheduled content (item #3)

`lib/postDraftGenerator.ts` — three fixed content types on fixed schedules,
not open-ended AI posting:

- **Weekly tip** — a parenting/reading tip, rotating through a fixed topic
  list keyed by ISO week (deterministic: re-running mid-week reproduces the
  same topic, not a new one each run).
- **Word roundup** — introduces a themed set of words from the app. `words`
  has no `created_at` in the schema, so this is a rotating showcase seeded
  by ISO week, not literally "rows inserted this week" — the model is given
  the exact word list and told not to add to it, so it can't invent
  vocabulary the app doesn't have.
- **Holiday** — Nowruz (~Mar 19–21) and Yalda (~Dec 20–21) windows only;
  silently skips itself (`outcome: 'skipped-not-due'`) the rest of the year.

Each generator's output goes through **`lib/postGuard.validDraftText`**
before it's ever queued — a pure, dependency-free, unit-tested rule check
(`postGuard.test.ts`), the same role `chatGuard.ts`'s `validReply` plays for
the character chat. It rejects: too short/long, any link that isn't to our
own domain, anything that reads like a request for personal info, or an
injected/off-topic run of Latin text. One retry on a gate failure (same
shape as the chat retry in `routes/characters.ts`); if the retry also fails
the gate, the candidate is discarded — never queued — and
`adminNotify.notifyDraftGenerationFailed` pings you so a silently-dropped
generation isn't invisible.

This gate is a **second, independent check ahead of your approval, not a
substitute for it** — every draft that clears it still needs a human
decision before anything posts. It exists because a tired reviewer clicking
approve is a plausible failure mode, and a bad AI generation shouldn't rely
solely on that click being caught.

### Running it

- **Manual / testing**: تولید محتوای هفتگی button on the panel, or
  `POST /admin/post-drafts/generate` (same shape as `/admin/digest/run`).
- **Scheduled**: `apps/backend/src/scripts/generatePostDrafts.ts`, meant to
  be hit by an external daily cron (see the script's own header for the
  exact crontab line) — same split as the weekly digest
  (`lib/digest.ts` / `scripts/sendDigests.ts`).

Requires `AI_API_KEY` and the AI kill switch (`ai_settings.ai_enabled`) on;
otherwise each generator reports `ai-not-configured` and exits cleanly (no
error, nothing queued).

## Adding a fourth generator or trigger later

- A new **event-driven** trigger (something else gets published): call
  `createDraft({ source: 'story_published', ... })`-style, i.e. add
  `'your_source'` to the `source` check constraint and call `createDraft`
  from wherever the event happens.
- A new **scheduled** content type: follow the shape of
  `generateWeeklyTip`/`generateWordRoundup`/`generateHoliday` in
  `postDraftGenerator.ts` — gather real facts, call `generatePostText`, gate
  with `validDraftText`, queue with `createDraft`.
