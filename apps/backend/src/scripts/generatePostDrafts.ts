/**
 * Run the AI-scheduled Telegram content generators once and exit.
 *
 * Local / cron usage (from repo root):
 *   npx tsx apps/backend/src/scripts/generatePostDrafts.ts
 *
 * In Docker, run inside the backend container so it shares DATABASE_URL etc:
 *   docker compose exec backend npx tsx apps/backend/src/scripts/generatePostDrafts.ts
 *
 * Example daily crontab (08:00) — the holiday generator self-skips outside its
 * date window, and the weekly ones are seeded by ISO week, so a daily run
 * only ever produces one live draft per generator per week:
 *   0 8 * * *  cd /path/to/KoodakBook && docker compose exec -T backend \
 *              npx tsx apps/backend/src/scripts/generatePostDrafts.ts >> /var/log/koodak-post-drafts.log 2>&1
 *
 * Queues drafts for human approval only — never posts. Requires AI_API_KEY
 * and the kill switch (ai_settings.ai_enabled) on; otherwise each generator
 * reports 'ai-not-configured' and exits cleanly.
 */
import 'dotenv/config'
import { runScheduledPostDrafts } from '../lib/postDraftGenerator'
import { db } from '../lib/db'

runScheduledPostDrafts()
  .then(async (results) => {
    console.log('Post-draft generation complete:', results)
    await db.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Post-draft generation failed:', err)
    await db.end()
    process.exit(1)
  })
