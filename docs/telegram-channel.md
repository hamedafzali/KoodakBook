# Public Telegram channel posting

Sends to the public `@koodakbook_app` channel via Telegram's Bot API
`sendMessage`. Code:
[`apps/backend/src/lib/telegramChannel.ts`](../apps/backend/src/lib/telegramChannel.ts).

## What it is (and isn't)

**This module only sends — it never decides what gets posted.** That
decision belongs to the approval queue
(`docs/telegram-approval-queue.md`): every candidate post (new story
published, AI-scheduled weekly content) is queued as a `post_drafts` row and
requires a human to approve it before `postToChannel()` is ever called.
Previously `POST /admin/stories` called this module directly on save,
auto-posting with no review — that direct path is gone; see the approval
queue doc for how it works now.

This is a **separate bot and token from `ALERT_TELEGRAM_BOT_TOKEN`**
(`docs/alerting.md`) and from `ADMIN_TELEGRAM_BOT_TOKEN`
(`docs/admin-notify.md`). Those two DM private chats (ops alerts, admin
event notifications); this one is the only one of the three with posting
rights on the public channel. Kept apart so a bug or leak in one can't grant
posting/message access on another.

## Setup (once, by a human — needs a Telegram account this repo can't create)

1. **@BotFather**: message it → `/newbot` → pick a name and a `@..._bot`
   username → BotFather returns a bot token
   (`123456789:AA...`, looks like the alerts one but is a distinct bot).
2. **Add the bot to the channel**: open `@koodakbook_app` → Administrators →
   Add Admin → add the new bot → grant it **Post Messages** permission (that's
   the only permission it needs).
3. **Store the token in ACM project variables** (never in the repo, never
   pasted into chat):
   - `TELEGRAM_BOT_TOKEN` — the token from step 1.
   - `TELEGRAM_CHANNEL` — optional, defaults to `@koodakbook_app` in code; only
     set it if the channel's @username ever changes.

`.env.example` carries `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHANNEL` as blank/commented
placeholders. With no token set, it **dry-runs** (logs the message instead of
sending) — safe in any environment, including local dev.

## Verify it fires

Create a story via the admin UI (or `POST /admin/stories`), then approve the
resulting draft at `/dashboard/post-drafts` and check the backend logs:

- No `TELEGRAM_BOT_TOKEN` set → `[telegram] DRY RUN → @koodakbook_app ...`
- Token set → either the channel gets the message, or a
  `[telegram] sendMessage error ...` line names what Telegram's API rejected
  (most commonly: bot not an admin on the channel, or missing post permission).

## Adding a new source of content

Don't call `postToChannel` directly. Add a pure `render*Message` function
here (same shape as `renderNewStoryMessage`) and have the event call
`createDraft()` (`routes/adminPostDrafts.ts`) with the rendered text — see
`docs/telegram-approval-queue.md`.
