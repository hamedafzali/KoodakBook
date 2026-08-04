/**
 * Shared alert transport — Phase 0 of the reliability work.
 *
 * One place every downstream consumer calls, so the backup heartbeat, the
 * migration runner, and the AI kill switch don't each grow their own ad-hoc
 * integration later. Two shapes of signal:
 *
 *   heartbeat(check)  — "this scheduled job just succeeded". A dead-man's-switch:
 *                       healthchecks.io watches the *absence* of these and pages
 *                       when one is late. Only healthchecks.io can catch an
 *                       absence, because by definition our code didn't run.
 *   alert({ check })  — "this bad thing happened right now". Fans out immediately.
 *
 * Channels (email + Telegram) are attached to each check IN the healthchecks.io
 * dashboard, so a *missed heartbeat* pages both without our code running. For
 * active alerts we additionally flip the check to /fail (re-using those same
 * integrations) and, if a Telegram bot token is configured, send Telegram
 * directly for immediacy. No email is ever sent from here — no SMTP to own.
 *
 * Unconfigured (no HEALTHCHECKS_PING_KEY) it DRY-RUNS: every signal is logged,
 * nothing is sent, nothing throws — so the whole pipeline is exercisable before
 * credentials exist (same pattern as lib/digest.ts).
 *
 * Secrets live only in the environment (ACM project variables in prod); see
 * .env.example and docs/alerting.md. The base URLs are overridable purely so the
 * local verification harness can point the transport at capture servers.
 */

export type CheckSlug = 'backup' | 'migration' | 'incident'

/** Stable check slugs — not secret; they identify which subsystem in hc.io. */
const SLUG: Record<CheckSlug, string> = {
  backup: 'koodakbook-backup',
  migration: 'koodakbook-migration',
  incident: 'koodakbook-incident',
}

const HC_BASE = process.env.HEALTHCHECKS_BASE_URL ?? 'https://hc-ping.com'
const PING_KEY = process.env.HEALTHCHECKS_PING_KEY ?? ''
const TG_BASE = process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'
const TG_TOKEN = process.env.ALERT_TELEGRAM_BOT_TOKEN ?? ''
const TG_CHAT = process.env.ALERT_TELEGRAM_CHAT_ID ?? ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** POST with a short timeout and a couple of retries. Returns delivered?/true. */
async function postWithRetry(
  url: string,
  body: string,
  opts: { attempts?: number; timeoutMs?: number; contentType?: string } = {},
): Promise<boolean> {
  const { attempts = 3, timeoutMs = 5000, contentType } = opts
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        body,
        headers: contentType ? { 'Content-Type': contentType } : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (r.ok) return true
      console.error(`[alerts] ${redact(url)} → HTTP ${r.status} (attempt ${i}/${attempts})`)
    } catch (err) {
      console.error(`[alerts] ${redact(url)} unreachable (attempt ${i}/${attempts}): ${(err as Error).message}`)
    }
    if (i < attempts) await sleep(300 * i)
  }
  return false
}

/** Keep ping keys / bot tokens out of logs. */
function redact(url: string): string {
  let out = url
  if (PING_KEY) out = out.split(`/${PING_KEY}/`).join('/<ping-key>/')
  if (TG_TOKEN) out = out.split(`/bot${TG_TOKEN}/`).join('/bot<token>/')
  return out
}

function pingUrl(check: CheckSlug, event?: 'fail' | 'start'): string {
  const base = `${HC_BASE}/${PING_KEY}/${SLUG[check]}`
  return event ? `${base}/${event}` : base
}

/**
 * Report that a scheduled job succeeded. Best-effort by design: a transient
 * monitor blip is logged and swallowed — we never fail real work because
 * telemetry is down, and a *persistent* outage is itself caught by the
 * dead-man's-switch (the success ping never lands, so hc.io pages on the
 * absence). So the correct behaviour on unreachable is: log loudly, continue.
 */
export async function heartbeat(check: CheckSlug): Promise<void> {
  if (!PING_KEY) {
    console.log(`[alerts] DRY RUN heartbeat: ${check}`)
    return
  }
  const ok = await postWithRetry(pingUrl(check), '')
  if (!ok) {
    console.error(
      `[alerts] heartbeat for '${check}' did not reach the monitor; ` +
        `if this persists the dead-man's-switch will page on the missing ping.`,
    )
  }
}

/** Signal that a job has *started* (arms hc.io's run-duration + late detection). */
export async function heartbeatStart(check: CheckSlug): Promise<void> {
  if (!PING_KEY) {
    console.log(`[alerts] DRY RUN heartbeat/start: ${check}`)
    return
  }
  await postWithRetry(pingUrl(check, 'start'), '')
}

export interface AlertResult {
  healthchecks: 'ok' | 'fail' | 'dry-run'
  telegram: 'ok' | 'fail' | 'off' | 'dry-run'
}

/**
 * Raise an active alert. Fans out to healthchecks.io (which pages email + any
 * Telegram integration attached to the check) and, when a bot token is
 * configured, to Telegram directly for immediacy. Sinks are attempted
 * independently so one being down cannot mute the other. Loud on total failure:
 * an alert we could not deliver must never look like success.
 */
export async function alert(input: {
  check: CheckSlug
  title: string
  body?: string
  severity?: 'warn' | 'crit'
}): Promise<AlertResult> {
  const icon = input.severity === 'crit' ? '🔴' : '⚠️'
  const text = `${icon} KoodakBook: ${input.title}${input.body ? `\n${input.body}` : ''}`
  const res: AlertResult = { healthchecks: 'dry-run', telegram: 'off' }

  if (PING_KEY) {
    res.healthchecks = (await postWithRetry(pingUrl(input.check, 'fail'), text)) ? 'ok' : 'fail'
  } else {
    console.log(`[alerts] DRY RUN alert(${input.check}): ${text.replace(/\n/g, ' | ')}`)
  }

  if (TG_TOKEN && TG_CHAT) {
    res.telegram = (await sendTelegram(text)) ? 'ok' : 'fail'
  } else if (!PING_KEY) {
    res.telegram = 'dry-run'
  }

  if (res.healthchecks === 'fail' && res.telegram !== 'ok') {
    console.error(`[alerts] ALERT NOT DELIVERED on any channel: ${input.title}`)
  }
  return res
}

async function sendTelegram(text: string): Promise<boolean> {
  return postWithRetry(
    `${TG_BASE}/bot${TG_TOKEN}/sendMessage`,
    JSON.stringify({ chat_id: TG_CHAT, text }),
    { contentType: 'application/json' },
  )
}
