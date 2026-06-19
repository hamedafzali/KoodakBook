import { Router } from 'express'
import { query, queryOne } from '../lib/db'

const router = Router()

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
       row_to_json(w.*) as word,
       row_to_json(l.*) as letter
     from lesson_items li
     left join words   w on w.id = li.word_id
     left join letters l on l.id = li.letter_id
     where li.lesson_id = $1
     order by li.order_index`,
    [req.params.id]
  )
  res.json({ data: { ...lesson, items }, error: null })
})

router.get('/stories', async (req, res) => {
  const { stage } = req.query
  // The shared catalogue excludes AI-personalized stories — those surface only
  // for the child they were generated for (see /api/ai/stories/:child_id).
  const rows = stage
    ? await query('select * from stories where stage = $1 and not ai_generated order by created_at', [stage])
    : await query('select * from stories where not ai_generated order by stage, created_at')
  res.json({ data: rows, error: null })
})

router.get('/stories/:id', async (req, res) => {
  const story = await queryOne('select * from stories where id = $1', [req.params.id])
  if (!story) { res.status(404).json({ data: null, error: 'Story not found' }); return }

  const pages = await query(
    `select sp.*,
       coalesce(
         json_agg(json_build_object('id', spw.id, 'position', spw.position, 'word', row_to_json(w.*)))
         filter (where spw.id is not null), '[]'
       ) as words
     from story_pages sp
     left join story_page_words spw on spw.page_id = sp.id
     left join words w on w.id = spw.word_id
     where sp.story_id = $1
     group by sp.id
     order by sp.page_number`,
    [req.params.id]
  )
  res.json({ data: { ...story, pages }, error: null })
})

router.get('/words', async (req, res) => {
  const { category, stage } = req.query
  let sql = 'select * from words'
  const params: unknown[] = []
  const conditions: string[] = []
  if (category) { conditions.push(`category = $${params.push(category)}`); }
  if (stage)    { conditions.push(`stage = $${params.push(stage)}`); }
  if (conditions.length) sql += ' where ' + conditions.join(' and ')
  sql += ' order by category, persian'
  const rows = await query(sql, params)
  res.json({ data: rows, error: null })
})

router.get('/words/:id', async (req, res) => {
  const word = await queryOne('select * from words where id = $1', [req.params.id])
  if (!word) { res.status(404).json({ data: null, error: 'Word not found' }); return }
  res.json({ data: word, error: null })
})

router.get('/letters', async (req, res) => {
  const rows = await query(
    `select l.*, row_to_json(w.*) as example_word
     from letters l
     left join words w on w.id = l.example_word_id
     order by l.group, l.order_in_group`
  )
  res.json({ data: rows, error: null })
})

export default router
