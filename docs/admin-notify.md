# Private admin Telegram DMs

Sends the operator a direct Telegram message about events worth knowing about
immediately: new signups, lead/contact form submissions. Code:
[`apps/backend/src/lib/adminNotify.ts`](../apps/backend/src/lib/adminNotify.ts).

## What it is (and isn't)

A direct heads-up to one private chat — no channel, no approval step, no
queue, nothing to review. Two triggers so far:

- **New signup** — fired from `POST /auth/signup` (`apps/backend/src/routes/auth.ts`)
  right after the account is created.
- **New lead/contact submission** — fired from `POST /leads`
  (`apps/backend/src/routes/leads.ts`) right after the row is inserted.

Fire-and-forget: a Telegram hiccup logs an error but never fails the signup
or submission (same reasoning as the digest, alert, and content-channel
transports).

This is a **third, separate bot and token** from both `TELEGRAM_BOT_TOKEN`
(`docs/telegram-channel.md` — public content channel) and
`ALERT_TELEGRAM_BOT_TOKEN` (`docs/alerting.md` — ops reliability paging).
Kept apart for the same reason those two are: a token only ever grants the
one capability its bot was made for.

## Setup (once, by a human — needs a Telegram account this repo can't create)

1. **@BotFather**: message it → `/newbot` → pick a name and a `@..._bot`
   username → BotFather returns a bot token (`123456789:AA...`).
2. **Find your chat ID**: message your new bot anything (e.g. "hi") first —
   Telegram only lets a bot message chats that have messaged it. Then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser (substitute
   your real token) and read `result[0].message.chat.id` — that number is
   your `ADMIN_TELEGRAM_CHAT_ID`. (Alternatively, message
   [@userinfobot](https://t.me/userinfobot) to get your own numeric ID
   directly — it's the same ID regardless of which bot you use to find it.)
3. **Store both values in ACM project variables** (never in the repo, never
   pasted into chat):
   - `ADMIN_TELEGRAM_BOT_TOKEN` — the token from step 1.
   - `ADMIN_TELEGRAM_CHAT_ID` — the numeric ID from step 2.

With no token set, it **dry-runs** (logs the message instead of sending) —
safe in any environment, including local dev.

## Verify it fires

Sign up a test account, or submit the contact/waitlist form, and check the
backend logs:

- No `ADMIN_TELEGRAM_BOT_TOKEN` set → `[admin-notify] DRY RUN → admin ...`
- Token set → either the DM arrives, or a `[admin-notify] sendMessage error
  ...` line names what Telegram's API rejected (most commonly: you never
  messaged the bot first, so it can't message you back).

## Adding a third trigger later

Follow the same shape as `notifyNewSignup`/`notifyNewLead`: a small
`notify*` function in `lib/adminNotify.ts` that builds the message and calls
the shared `sendMessage`, invoked (fire-and-forget, `.catch`-guarded) from
wherever that event actually happens.
