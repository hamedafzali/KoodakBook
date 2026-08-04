# Alerting (Phase 0)

The shared alert transport that every later reliability piece calls: the backup
heartbeat (Phase 1B), the migration runner (Phase 3), and the AI kill switch
(Phase 4). Built once, on purpose, so those don't each grow a separate
integration. Code: [`apps/backend/src/lib/alerts/index.ts`](../apps/backend/src/lib/alerts/index.ts).

## What it is (and isn't)

Two signals:

- **`heartbeat(check)`** — "this scheduled job just succeeded." A dead-man's-switch.
  healthchecks.io watches for the *absence* of these and pages when one is late.
- **`alert({ check, title, body })`** — "this bad thing happened right now."
  Fans out immediately.

It is transport plumbing, not an observability platform: two channels (email +
Telegram), no dashboards, no metrics store. Keep it that way.

## ⚠️ The exit gate is NOT closed until you have rehearsed it

Phase 0 is complete in code and proven against a local stand-in, but the gate is
**open** until the hosted rehearsal below has been run and **both channels have
been observed firing on a real missed heartbeat**. Until then, treat alerting as
unverified: nothing downstream may proceed on the assumption it works. In
particular, **Phase 1B** (the backup heartbeat) and **Item 2 §A** (the migration
fail-fast reorder, which turns a bad migration into a crash-loop) both rely on a
page actually arriving — a crash-loop or a silent backup failure with no alert is
worse than the problem it replaces. Do the rehearsal first.

## The one fact that shapes the design

**A missed heartbeat can only be detected by healthchecks.io**, because when a
job fails to run, our code isn't running to tell anyone. So "a missed heartbeat
pages both channels" is necessarily healthchecks.io fanning out to **its own**
email + Telegram integrations. Our code cannot do it.

Consequence: **the email and Telegram channels are configured in the
healthchecks.io dashboard**, per check. That is the deployed default
("Design A"). The `ALERT_TELEGRAM_*` env vars are an *optional* opt-in fallback
("Design B") — see the last section.

## Checks

Three checks, one per subsystem (slugs are in code, not secret):

| Check slug            | Fired by                    | Kind             |
| --------------------- | --------------------------- | ---------------- |
| `koodakbook-backup`   | backup job (Phase 1B)       | heartbeat        |
| `koodakbook-migration`| migration runner (Phase 3)  | active alert     |
| `koodakbook-incident` | AI kill switch etc. (Phase 4) + smoke test | active alert |

## Setup (once, by a human — needs accounts this repo can't create)

1. **healthchecks.io**: create a project. Add the three checks above (or let the
   first ping auto-create them via the project ping key). For **each** check,
   attach two integrations: **Email** and **Telegram**. Set the backup check's
   period + grace to your backup cadence (twice-daily ⇒ period 12h, grace to taste).
2. **Telegram**: talk to `@BotFather` → new bot → bot token. Add the bot to your
   alert chat/channel; get the chat ID. Configure it as the healthchecks.io
   Telegram integration. (Only ALSO put the token in the env vars below if you
   want the optional direct path.)
3. **Store secrets in ACM project variables** (never in the repo):
   - `HEALTHCHECKS_PING_KEY` — the project ping key.
   - `ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID` — only for the optional
     direct path.

`.env.example` carries these as blank placeholders. With none set, the transport
**dry-runs** (logs, sends nothing) — safe in any environment.

## Verify it fires — the exit gate

### Active path (one command)

```
npx tsx apps/backend/src/scripts/alertsSmoke.ts "hello from phase 0"
```

With real creds you receive it on every configured channel within ~a minute;
the printed `result:` shows which sinks delivered. Without creds it dry-runs.

### Dead-man's-switch (the missed-heartbeat gate)

Only healthchecks.io can demonstrate this, so it is a hosted rehearsal. **This
is the test that closes the Phase 0 exit gate** — until both channels have been
seen firing here, alerting is unverified (see the warning at the top).

1. Note the check's real settings first, then **temporarily** set the
   `koodakbook-backup` check to **period 1 min, grace 1 min**.
2. Send one heartbeat so it goes green:
   `curl -fsS "https://hc-ping.com/$HEALTHCHECKS_PING_KEY/koodakbook-backup"`
3. **Stop.** Send nothing for ~2 minutes.
4. Observe: the check goes **down** and **both** email and Telegram page. That
   is the gate closed — record that you saw both.
5. **Restore the real period + grace** (twice-daily backups ⇒ period 12h + grace).

> ⚠️ **Do not skip step 5.** If you leave the check at 1m/1m after the rehearsal,
> the real backup (which pings every 12h) is permanently "late", so the check
> pages on **every** cycle. A channel that pages constantly gets muted or
> filtered — which is the exact failure Phase 0 exists to prevent. Restoring the
> real period/grace is part of the rehearsal, not an afterthought.

### Successful-ping quietness (don't be noisy)

While healthy, keep pinging on time (step 2 on a loop) → the check stays green
and **no** notification is sent. An alerting layer that pages on success gets
muted, which is the same as no alerting.

### Monitor unreachable (network blip) — defined behavior

- **Heartbeat path**: retries briefly, then **logs an error and continues**. We
  never fail real work because telemetry is down. A *persistent* outage is not
  silent: the success ping never lands, so healthchecks.io pages on the absence.
- **Active-alert path**: retries, attempts each sink independently, and if the
  alert reached **no** channel it logs `ALERT NOT DELIVERED` at error level and
  the smoke script exits non-zero. An undelivered alert never looks like success.

## Channel wiring: Design A (default) vs Design B (opt-in fallback)

**Design A is the deployed default.** healthchecks.io owns both channels; the
only secret in ACM is `HEALTHCHECKS_PING_KEY`; the Telegram bot token lives in
the healthchecks.io dashboard integration, **not** in ACM. Fewer secrets in our
control plane, and it covers both the dead-man's-switch and active alerts. Leave
`ALERT_TELEGRAM_BOT_TOKEN` / `ALERT_TELEGRAM_CHAT_ID` **unset**.

**Design B is a wired-but-off fallback.** Setting the two `ALERT_TELEGRAM_*` vars
turns on a second, direct-to-Telegram path for *active* alerts (`alert()`) — our
code posts straight to the Telegram Bot API, independent of healthchecks.io. It
does nothing for the dead-man's-switch (a missed heartbeat still needs hc.io).

**When to turn Design B on:** only as redundancy if healthchecks.io proves an
unreliable backstop for active alerts — e.g. you observe hc.io notification
delays or an outage that swallowed a migration-failure or kill-switch page. Then
create a bot via @BotFather, put the token + chat ID in ACM, and active alerts
gain a delivery path that survives hc.io being down. Until there's a reason,
keep it off — it's the smaller, fewer-secrets posture.
