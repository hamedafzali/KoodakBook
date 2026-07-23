import { Router } from 'express'
import { query, queryOne } from '../lib/db'
import { requireAuth } from '../middleware/auth'
import { requireChildOwner } from '../middleware/childOwner'

const router = Router()

// Friend codes use an unambiguous alphabet (no 0/O/1/I/L/etc).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function randomCode(): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return `KB-${s}`
}

// ── GET /api/friends/code/:child_id ──────────────────────────────────────
// This child's shareable friend code (generated + stored on first request).
router.get('/code/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.params
  const row = await queryOne<{ friend_code: string | null }>(
    'select friend_code from children where id = $1', [child_id])
  if (row?.friend_code) { res.json({ data: { code: row.friend_code }, error: null }); return }

  // Generate a unique code (retry on the rare collision).
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode()
    try {
      const [updated] = await query<{ friend_code: string }>(
        'update children set friend_code = $1 where id = $2 returning friend_code', [code, child_id])
      res.json({ data: { code: updated.friend_code }, error: null })
      return
    } catch { /* unique clash — try another */ }
  }
  res.status(500).json({ data: null, error: 'Could not generate a code' })
})

// ── POST /api/friends/request ────────────────────────────────────────────
// Send a friend request from my child to whoever owns `code`. If they already
// requested us, this accepts it (mutual). Parent-authenticated + child-owned.
router.post('/request', requireAuth, requireChildOwner, async (req, res) => {
  const myChildId = String(req.body?.child_id)
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  if (!/^KB-[A-Z0-9]{5}$/.test(code)) {
    res.status(400).json({ data: null, error: 'کد دوستی درست نیست' }); return
  }

  const friend = await queryOne<{ id: string; name: string }>(
    'select id, name from children where upper(friend_code) = $1', [code])
  if (!friend) { res.status(404).json({ data: null, error: 'کودکی با این کد پیدا نشد' }); return }
  if (friend.id === myChildId) { res.status(400).json({ data: null, error: 'نمی‌توانی خودت را اضافه کنی' }); return }

  // Any existing link in either direction?
  const existing = await queryOne<{ id: string; status: string; requester_child_id: string }>(
    `select id, status, requester_child_id from friendships
      where (requester_child_id = $1 and addressee_child_id = $2)
         or (requester_child_id = $2 and addressee_child_id = $1)
      limit 1`,
    [myChildId, friend.id])

  if (existing) {
    if (existing.status === 'accepted') { res.status(409).json({ data: null, error: `${friend.name} از قبل دوست است` }); return }
    if (existing.status === 'pending') {
      if (existing.requester_child_id === friend.id) {
        // They already asked us → accept it (mutual).
        await query('update friendships set status = $1, updated_at = now() where id = $2', ['accepted', existing.id])
        res.json({ data: { friend_name: friend.name, accepted: true }, error: null }); return
      }
      res.status(409).json({ data: null, error: 'درخواست قبلاً فرستاده شده' }); return
    }
  }

  await query(
    `insert into friendships (requester_child_id, addressee_child_id, status)
     values ($1, $2, 'pending')
     on conflict (requester_child_id, addressee_child_id)
       do update set status = 'pending', updated_at = now()`,
    [myChildId, friend.id])
  res.status(201).json({ data: { friend_name: friend.name, accepted: false }, error: null })
})

// ── GET /api/friends/requests ────────────────────────────────────────────
// Incoming pending requests addressed to any of this parent's children.
router.get('/requests', requireAuth, async (_req, res) => {
  const rows = await query(
    `select f.id, f.created_at,
            rc.name as requester_name,
            ac.id as addressee_child_id, ac.name as addressee_name
       from friendships f
       join children ac on ac.id = f.addressee_child_id
       join children rc on rc.id = f.requester_child_id
      where ac.parent_id = $1 and f.status = 'pending'
      order by f.created_at desc`,
    [res.locals.userId])
  res.json({ data: rows, error: null })
})

// ── POST /api/friends/requests/:id/(accept|decline) ──────────────────────
// Only the addressee's parent may respond.
async function respond(res: import('express').Response, id: string, userId: string, status: 'accepted' | 'declined') {
  const req = await queryOne<{ id: string }>(
    `select f.id from friendships f
       join children ac on ac.id = f.addressee_child_id
      where f.id = $1 and ac.parent_id = $2 and f.status = 'pending'`,
    [id, userId])
  if (!req) { res.status(404).json({ data: null, error: 'درخواست پیدا نشد' }); return }
  await query('update friendships set status = $1, updated_at = now() where id = $2', [status, id])
  res.json({ data: { ok: true }, error: null })
}

router.post('/requests/:id/accept', requireAuth, (req, res) => { void respond(res, String(req.params.id), String(res.locals.userId), 'accepted') })
router.post('/requests/:id/decline', requireAuth, (req, res) => { void respond(res, String(req.params.id), String(res.locals.userId), 'declined') })

// ── GET /api/friends/of/:child_id ────────────────────────────────────────
// Accepted friends of this child.
router.get('/of/:child_id', requireAuth, requireChildOwner, async (req, res) => {
  const { child_id } = req.params
  const rows = await query(
    `select c.id, c.name, c.avatar_url
       from friendships f
       join children c on c.id = case when f.requester_child_id = $1 then f.addressee_child_id else f.requester_child_id end
      where (f.requester_child_id = $1 or f.addressee_child_id = $1) and f.status = 'accepted'
      order by c.name`,
    [child_id])
  res.json({ data: rows, error: null })
})

export default router
