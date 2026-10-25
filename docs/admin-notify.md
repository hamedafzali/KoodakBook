# Private admin Telegram DMs

Sends the operator a direct Telegram message about events worth knowing about
immediately: new signups, lead/contact form submissions. Code:
[`apps/backend/src/lib/adminNotify.ts`](../apps/backend/src/lib/adminNotify.ts).

## What it is (and isn't)

A direct heads-up to one private chat — no channel, no approval step, no
queue, nothing to review.

**Instant messages** (one per event):

| Event | Where it fires |
|---|---|
| 👤 New signup | `POST /auth/signup` (`routes/auth.ts`) |
| 📬 Lead / contact / waitlist submission | `POST /leads` (`routes/leads.ts`) |
| 📝 New draft waiting in the Telegram approval queue | `createDraft()` (`routes/adminPostDrafts.ts`) |
| ⚠️ AI-generated channel draft rejected by the content gate | `lib/postDraftGenerator.ts` |
| 💳 New subscription (checkout completed) | Stripe webhook (`routes/billingWebhook.ts`) |
| ↩️ Cancellation requested (ends at period end) | Stripe webhook, `customer.subscription.updated` |
| 🔚 Subscription ended, account back on free | Stripe webhook, `customer.subscription.deleted` |
| ⚠️ Payment failed | Stripe webhook, `invoice.payment_failed` |
| 🚨 Server error (HTTP 500) | `middleware/errorHandler.ts` — at most one per route+message per 15 min |
| 💥 Backend crashed / migration failed | `index.ts` process handlers — at most one per message per 15 min |
| 🚀 Backend started (deploy or restart) | `index.ts` — at most one per 10 min, "+N" counts restarts in between |
| 🤖 AI story generation failing | `routes/ai.ts` — at most one per 30 min |
| 📱 Android app release published | `routes/appReleases.ts` |

Throttling lives in the database (`admin_notify_log`, migration 067), so a
crash-looping backend sends one message, not one per restart. A held-back
message is counted, and the next one that goes out says "+N similar".

**Daily summary** (`lib/adminSummary.ts`) — one message a day at
`ADMIN_SUMMARY_HOUR` (default 21) in `ADMIN_SUMMARY_TZ` (default
Europe/Berlin): signups, new children, active children (today and 7 days),
sessions and minutes, lessons/stories completed, AI stories and AI usage,
new subscriptions, paying and premium families, temporary premium grants,
new and open leads, and the review queues (Telegram drafts, word images,
story covers). It is claimed per local date in `admin_notify_log`, so it goes
out exactly once a day even across restarts, and a backend that was down at
21:00 sends it when it comes back the same evening.

The admin panel's Reports → System tab has **Send test message** and **Send
summary now** buttons.

Fire-and-forget: a Telegram hiccup logs an error but never fails the request
that triggered it (same reasoning as the digest, alert, and content-channel
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
   - Optional: `ADMIN_SUMMARY_TZ`, `ADMIN_SUMMARY_HOUR`, `APP_VERSION`.
4. **Stripe events**: subscribe the webhook endpoint to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `invoice.payment_failed`.

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
