import { Router } from 'express'
import type { Request } from 'express'
import { query, queryOne } from '../lib/db'
import { verifyToken } from '../lib/jwt'
import { userIsPremium, promoteAudio } from '../lib/premiumAudio'

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
    return userIsPremium(sub)
  } catch { return false }
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
  // ?lang attaches the chosen family-language translation per page (from the
  // translations map, or text_english for 'en'); the app shows page.translation.
  const lang = typeof req.query.lang === 'string' ? req.query.lang : null
  const withTx = (o: Record<string, unknown>) => {
    if (lang && lang !== 'none') {
      const tx = (o.translations as Record<string, string> | undefined)?.[lang]
      o.translation = tx ?? (lang === 'en' ? (o.text_english as string | null) : null)
    }
    return o
  }
  res.json({ data: { ...promoteAudio(story.obj, premium), pages: pages.map(r => withTx(promoteAudio(r.obj, premium))) }, error: null })
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
