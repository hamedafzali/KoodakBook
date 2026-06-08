/**
 * Run the weekly parent digest once and exit.
 *
 * Local / cron usage (from repo root):
 *   npx tsx apps/backend/src/scripts/sendDigests.ts
 *
 * In Docker, run inside the backend container so it shares DATABASE_URL etc:
 *   docker compose exec backend npx tsx apps/backend/src/scripts/sendDigests.ts
 *
 * Example weekly crontab (Mondays 08:00):
 *   0 8 * * 1  cd /path/to/KoodakBook && docker compose exec -T backend \
 *              npx tsx apps/backend/src/scripts/sendDigests.ts >> /var/log/koodak-digest.log 2>&1
 *
 * Sends real email only when RESEND_API_KEY is set; otherwise it dry-runs to stdout.
 */
import 'dotenv/config'
import { runWeeklyDigest } from '../lib/digest'
import { db } from '../lib/db'

runWeeklyDigest()
  .then(async (r) => {
    console.log('Digest complete:', r)
    await db.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Digest failed:', err)
    await db.end()
    process.exit(1)
  })
