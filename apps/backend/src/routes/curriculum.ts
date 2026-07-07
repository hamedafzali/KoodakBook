import { Router } from 'express'
import type { Request } from 'express'
import { query, queryOne } from '../lib/db'
import { verifyToken } from '../lib/jwt'
import { isPremiumActive } from '@koodakbook/shared'

const router = Router()

/* ── Premium audio resolution ───────────────────────────────
 * Content routes are public, but the api client always attaches the token
 * when logged in. Decode it opportunistically: paid accounts get the premium
 * audio variant (audio_url_premium, e.g. ElevenLabs) transparently promoted
 * into audio_url — the apps never need to know two variants exist. */
async function isPremiumRequest(req: Request): Promise<boolean> {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return false
  try {
    const { sub } = verifyToken(h.slice(7))
    const u = await queryOne<{ plan: string; plan_expires_at: string | null }>(
      'select plan, plan_expires_at from users where id = $1', [sub])
    return isPremiumActive(u?.plan, u?.plan_expires_at)
  } catch { return false }
}

/** Promote the premium variant in place (recurses into nested content objects). */
function promoteAudio<T>(obj: T, premium: boolean): T {
  if (!premium || !obj || typeof obj !== 'object') return obj
  const o = obj as Record<string, unknown>
  if (typeof o.audio_url_premium === 'string' && o.audio_url_premium) o.audio_url = o.audio_url_premium
  for (const k of ['word', 'letter', 'example_word']) if (o[k]) promoteAudio(o[k], premium)
  if (Array.isArray(o.words)) for (const w of o.words) promoteAudio((w as Record<string, unknown>)?.word, premium)
  return obj
}

// Resolve a row to JSON with its audio_url overridden by the primary
// audio_asset (a native take supersedes the TTS bootstrap — mig-017/018).
// Returns a jsonb expression; callers select it `as obj` and unwrap, or embed
// it. No-op until a native audio_asset row exists for the entity.
const withAudio = (alias: string, entity: 'word' | 'letter' | 'story' | 'story_page') =>
  `to_jsonb(${alias}) || jsonb_build_object('audio_url', coalesce(primary_audio('${entity}', ${alias}.id), ${alias}.audio_url))`

type Obj = { obj: Record<string, unknown> }

router.get('/lessons', async (req, res) => {
  const { stage } = req.query
  const rows = stage
    ? await query('select * from lessons where stage = $1 order by order_index', [stage])
    : await query('select * from lessons order by stage, order_index')
  res.json({ data: rows, error: null })
})

router.get('/lessons/:id', async (req, res) => {
  const lesson = await queryOne('select * from lessons where id = $1', [req.params.id])
  if (!lesson) { res.status(404).json({ data: null, error: 'Lesson not found' }); return }

  const items = await query(
    `select li.*,
       case when w.id is not null then ${withAudio('w', 'word')}   else null end as word,
       case when l.id is not null then ${withAudio('l', 'letter')} else null end as letter
     from lesson_items li
     left join words   w on w.id = li.word_id
     left join letters l on l.id = li.letter_id
     where li.lesson_id = $1
     order by li.order_index`,
    [req.params.id]
  )
  const premium = await isPremiumRequest(req)
  res.json({ data: { ...lesson, items: (items as Record<string, unknown>[]).map(i => promoteAudio(i, premium)) }, error: null })
})

router.get('/stories', async (req, res) => {
  const { stage } = req.query
  // The shared catalogue excludes AI-personalized stories — those surface only
  // for the child they were generated for (see /api/ai/stories/:child_id).
  const rows = stage
    ? await query<Obj>(`select ${withAudio('s', 'story')} as obj from stories s where s.stage = $1 and not s.ai_generated order by s.created_at`, [stage])
    : await query<Obj>(`select ${withAudio('s', 'story')} as obj from stories s where not s.ai_generated order by s.stage, s.created_at`)
  res.json({ data: rows.map(r => r.obj), error: null })
})

router.get('/stories/:id', async (req, res) => {
  const story = await queryOne<Obj>(`select ${withAudio('s', 'story')} as obj from stories s where s.id = $1`, [req.params.id])
  if (!story) { res.status(404).json({ data: null, error: 'Story not found' }); return }

  const pages = await query<Obj>(
    `select to_jsonb(sp) || jsonb_build_object(
         'audio_url', coalesce(primary_audio('story_page', sp.id), sp.audio_url),
         'words', coalesce(
           json_agg(json_build_object('id', spw.id, 'position', spw.position, 'word', ${withAudio('w', 'word')}))
             filter (where spw.id is not null), '[]'
         )
       ) as obj
     from story_pages sp
     left join story_page_words spw on spw.page_id = sp.id
     left join words w on w.id = spw.word_id
     where sp.story_id = $1
     group by sp.id
     order by sp.page_number`,
    [req.params.id]
  )
  const premium = await isPremiumRequest(req)
  res.json({ data: { ...promoteAudio(story.obj, premium), pages: pages.map(r => promoteAudio(r.obj, premium)) }, error: null })
})

router.get('/words', async (req, res) => {
  const { category, stage } = req.query
  let sql = `select ${withAudio('w', 'word')} as obj from words w`
  const params: unknown[] = []
  const conditions: string[] = []
  if (category) { conditions.push(`w.category = $${params.push(category)}`); }
  if (stage)    { conditions.push(`w.stage = $${params.push(stage)}`); }
  if (conditions.length) sql += ' where ' + conditions.join(' and ')
  sql += ' order by w.category, w.persian'
  const rows = await query<Obj>(sql, params)
  const premium = await isPremiumRequest(req)
  res.json({ data: rows.map(r => promoteAudio(r.obj, premium)), error: null })
})

router.get('/words/:id', async (req, res) => {
  const word = await queryOne<Obj>(`select ${withAudio('w', 'word')} as obj from words w where w.id = $1`, [req.params.id])
  if (!word) { res.status(404).json({ data: null, error: 'Word not found' }); return }
  res.json({ data: promoteAudio(word.obj, await isPremiumRequest(req)), error: null })
})

router.get('/letters', async (req, res) => {
  const rows = await query<Obj>(
    `select to_jsonb(l) || jsonb_build_object(
         'audio_url', coalesce(primary_audio('letter', l.id), l.audio_url),
         'example_word', case when w.id is not null then ${withAudio('w', 'word')} else null end
       ) as obj
     from letters l
     left join words w on w.id = l.example_word_id
     order by l.group, l.order_in_group`
  )
  const premium = await isPremiumRequest(req)
  res.json({ data: rows.map(r => promoteAudio(r.obj, premium)), error: null })
})

export default router
