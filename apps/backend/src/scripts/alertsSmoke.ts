/**
 * Fire ONE real active alert through every configured channel, then exit.
 *
 *   npx tsx apps/backend/src/scripts/alertsSmoke.ts ["your message"]
 *
 * With HEALTHCHECKS_PING_KEY set (and, optionally, ALERT_TELEGRAM_* for the
 * direct path) you should receive this alert on every configured channel within
 * ~a minute. Without credentials it DRY-RUNS to stdout, so it is safe to run in
 * any environment. Exit code is non-zero only if the alert reached no channel.
 *
 * This proves the *active* path. Rehearsing the dead-man's-switch itself (a
 * missed heartbeat paging both channels) is a property of healthchecks.io, not
 * this script — the exact recipe is in docs/alerting.md.
 */
import 'dotenv/config'
import { alert } from '../lib/alerts'

const msg = process.argv[2] ?? 'Phase 0 smoke test — if you received this, active alerting works.'

alert({ check: 'incident', title: 'Smoke test', body: msg, severity: 'warn' })
  .then((r) => {
    console.log('[alertsSmoke] result:', r)
    const deliveredNowhere = r.healthchecks === 'fail' && (r.telegram === 'fail' || r.telegram === 'off')
    process.exit(deliveredNowhere ? 1 : 0)
  })
  .catch((err) => {
    console.error('[alertsSmoke] failed:', err)
    process.exit(1)
  })
