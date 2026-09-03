/**
 * One-off: queue the family-invite Telegram post for human approval.
 *
 * This is not a recurring generator (see generatePostDrafts.ts for those) —
 * it's a single manual draft, queued via the same createDraft() every other
 * producer uses. It only INSERTS a pending row; it never calls
 * postToChannel() itself. A human still approves it at
 * /dashboard/post-drafts before anything reaches @koodakbook_app.
 *
 * Usage (from repo root):
 *   npx tsx apps/backend/src/scripts/queueFamilyInvitePost.ts
 *
 * In Docker, run inside the backend container so it shares DATABASE_URL:
 *   docker compose exec backend npx tsx apps/backend/src/scripts/queueFamilyInvitePost.ts
 *
 * Safe to re-run only if you also change source_ref — otherwise you'll queue
 * duplicate drafts (there's no uniqueness guard, same as the other producers).
 */
import 'dotenv/config'
import { createDraft } from '../routes/adminPostDrafts'
import { validDraftText } from '../lib/postGuard'
import { db } from '../lib/db'

const WEB_URL = process.env.WEB_URL ?? 'https://koodakbook.app'
const LINK_HOST = (() => { try { return new URL(WEB_URL).host } catch { return undefined } })()

const TEXT = `سلام به همه خانواده‌های مهربون 🌱

کودک‌بوک یه اپلیکیشنه برای یاد دادن خوندن فارسی به بچه‌های ۳ تا ۸ سال، مخصوصاً بچه‌هایی که خارج از ایران بزرگ می‌شن و فارسی رو کمتر می‌شنون. با بازی، صدا، و کاراکترهای دوست‌داشتنی، قدم‌به‌قدم حروف و کلمه‌ها رو یاد می‌ده — بدون فشار، بدون امتحان.

اپ کاملاً رایگانه و هیچ تبلیغی توش نیست.

هنوز اول راهیم و اپ داره کامل می‌شه. اگه دوست دارید امتحانش کنید و با بچه‌تون چند دقیقه باهاش بازی کنید، خیلی خوشحال می‌شم. هر چیزی که به نظرتون عجیب، سخت، یا جاافتاده اومد — چه از تجربه بچه، چه از تجربه شما به‌عنوان والدین — برام بنویسید. همین بازخوردهای صادقانه‌ست که کمک می‌کنه بهترش کنیم.

🔗 امتحانش کنید: ${WEB_URL}

ممنون که وقت می‌ذارید 💛`

// Same content gate the AI-scheduled generator runs its drafts through
// (postGuard.ts) — belt-and-suspenders here since a human wrote this one,
// but it's still one more check before it reaches the approval queue.
if (!validDraftText(TEXT, { allowedLinkHost: LINK_HOST })) {
  console.error('Draft text failed validDraftText() — not queueing. Check length/link/blocklist rules.')
  process.exit(1)
}

createDraft({
  source: 'manual',
  source_ref: 'family-invite-2026-09-v2', // v1 baked in the LAN-IP WEB_URL, rejected as superseded
  text: TEXT,
  image_path: '/uploads/images/family-invite-2026-09.png', // real child-home screenshot, see chat
})
  .then(async (row) => {
    console.log('Queued draft:', row.id, '— status:', row.status)
    await db.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Queueing family-invite draft failed:', err)
    await db.end()
    process.exit(1)
  })
