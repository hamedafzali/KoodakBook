import fs from 'fs'
import path from 'path'
import { query } from '../db'
import { phonicsSyllables } from '@koodakbook/shared'
import { ttsPiper } from './piper'
import { normalizeForTts } from './normalize'
import { getTtsSettings } from './index'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export type RegenScope = 'words' | 'letters' | 'stories' | 'phonics' | 'all'

// In-memory progress for the singleton admin regeneration job.
interface RegenState {
  running: boolean
  scope: RegenScope | null
  voice: string
  done: number
  total: number
  errors: number
  startedAt: number
  finishedAt: number
}
let state: RegenState = { running: false, scope: null, voice: '', done: 0, total: 0, errors: 0, startedAt: 0, finishedAt: 0 }

export function getRegenStatus(): RegenState {
  return state
}

interface Item {
  dir: string
  id: string          // file stem (entity id, or phonics slug)
  text: string
  // DB-backed entities repoint audio_url; phonics is resolved by a fixed path.
  entity?: 'word' | 'letter' | 'story_page'
  table?: 'words' | 'letters' | 'story_pages'
  versioned: boolean  // versioned filename busts caches on re-run (phonics path is fixed → false)
}

async function collect(scope: RegenScope): Promise<Item[]> {
  const items: Item[] = []
  // tts_text (diacritized pronunciation override) wins over the display text —
  // Persian script omits short vowels, so homographs/letter names need it.
  if (scope === 'words' || scope === 'all') {
    for (const w of await query<{ id: string; persian: string }>('select id, coalesce(tts_text, persian) as persian from words'))
      items.push({ entity: 'word', table: 'words', dir: 'words', id: w.id, text: w.persian, versioned: true })
  }
  if (scope === 'letters' || scope === 'all') {
    for (const l of await query<{ id: string; name_persian: string }>('select id, coalesce(tts_text, name_persian) as name_persian from letters'))
      items.push({ entity: 'letter', table: 'letters', dir: 'letters', id: l.id, text: l.name_persian, versioned: true })
  }
  if (scope === 'stories' || scope === 'all') {
    for (const p of await query<{ id: string; text_persian: string }>('select id, text_persian from story_pages'))
      items.push({ entity: 'story_page', table: 'story_pages', dir: 'stories', id: p.id, text: p.text_persian, versioned: true })
  }
  if (scope === 'phonics' || scope === 'all') {
    // Syllables (consonant + short vowel) — fixed path /uploads/phonics/<slug>.wav.
    for (const s of phonicsSyllables())
      items.push({ dir: 'phonics', id: s.slug, text: s.text, versioned: false })
  }
  return items
}

/** Start a regeneration (Piper, current admin voice). Returns false if one is
 *  already running. Runs in the background; poll getRegenStatus(). */
export function startRegen(scope: RegenScope): boolean {
  if (state.running) return false
  state = { running: true, scope, voice: '', done: 0, total: 0, errors: 0, startedAt: Date.now(), finishedAt: 0 }

  void (async () => {
    try {
      const settings = await getTtsSettings()
      const voice = settings?.piper_voice || 'fa_IR-amir-medium'
      state.voice = voice
      const ver = state.startedAt   // shared version stamp for this run
      const items = await collect(scope)
      state.total = items.length
      for (const it of items) {
        try {
          const buf = await ttsPiper(voice, normalizeForTts(it.text))
          const dir = path.resolve(UPLOADS_DIR, it.dir)
          fs.mkdirSync(dir, { recursive: true })
          // Versioned name so re-running with a new voice yields a fresh URL (no
          // stale browser/proxy cache); phonics keeps a fixed name (path is built
          // client-side and can't carry a version).
          const file = it.versioned ? `${it.id}-${ver}.wav` : `${it.id}.wav`
          fs.writeFileSync(path.join(dir, file), buf)
          if (it.entity && it.table) {
            const url = `/uploads/${it.dir}/${file}`
            await query(`update ${it.table} set audio_url = $1 where id = $2`, [url, it.id])
            await query('delete from audio_assets where entity_type = $1 and entity_id = $2', [it.entity, it.id])
          }
        } catch (err) {
          state.errors++
          console.error('regen item failed', it.dir, it.id, (err as Error).message)
        }
        state.done++
        await new Promise(r => setTimeout(r, 40))   // pace it — ease memory pressure on a small host
      }
    } catch (err) {
      console.error('regen job failed:', err)
    } finally {
      state.running = false
      state.finishedAt = Date.now()
    }
  })()

  return true
}
