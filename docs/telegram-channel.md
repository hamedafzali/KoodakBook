# Public Telegram channel announcements

Posts real-content milestones to the public `@koodakbook_app` channel via
Telegram's Bot API `sendMessage`. Code:
[`apps/backend/src/lib/telegramChannel.ts`](../apps/backend/src/lib/telegramChannel.ts).

## What it is (and isn't)

One trigger so far: **new story published** — fired from `POST /admin/stories`
(`apps/backend/src/routes/admin.ts`) right after a story row is inserted. Real,
admin-authored content only (not the per-child AI-generated stories in
`routes/ai.ts`), since that's what has a natural public cadence.

Fire-and-forget: a Telegram hiccup logs an error but never fails the admin's
save (same reasoning as the digest and alert transports — the primary action
must survive a downstream notification being unavailable).

This is a **separate bot and token from `ALERT_TELEGRAM_BOT_TOKEN`**
(`docs/alerting.md`). That one DMs a private ops chat about job failures; this
one posts publicly to a channel about new content. Kept apart so a bug or leak
in one can't grant posting/message access on the other.

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

Create a story via the admin UI (or `POST /admin/stories`) and check the
backend logs:

- No `TELEGRAM_BOT_TOKEN` set → `[telegram] DRY RUN → @koodakbook_app ...`
- Token set → either the channel gets the message, or a
  `[telegram] sendMessage error ...` line names what Telegram's API rejected
  (most commonly: bot not an admin on the channel, or missing post permission).

## Adding a second trigger later

Follow the same shape as `announceNewStory`: a small pure `render*Message`
function plus a call to the shared `sendMessage` in
`lib/telegramChannel.ts`, invoked (fire-and-forget, `.catch`-guarded) from
wherever that event actually happens — not from a poller.
