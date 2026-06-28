import fs from 'fs'
import path from 'path'
import { query } from '../db'
import { ttsPiper } from './piper'
import { getTtsSettings } from './index'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export type RegenScope = 'words' | 'letters' | 'stories' | 'all'

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

interface Item { entity: 'word' | 'letter' | 'story_page'; table: 'words' | 'letters' | 'story_pages'; dir: string; id: string; text: string }

async function collect(scope: RegenScope): Promise<Item[]> {
  const items: Item[] = []
  if (scope === 'words' || scope === 'all') {
    for (const w of await query<{ id: string; persian: string }>('select id, persian from words'))
      items.push({ entity: 'word', table: 'words', dir: 'words', id: w.id, text: w.persian })
  }
  if (scope === 'letters' || scope === 'all') {
    for (const l of await query<{ id: string; name_persian: string }>('select id, name_persian from letters'))
      items.push({ entity: 'letter', table: 'letters', dir: 'letters', id: l.id, text: l.name_persian })
  }
  if (scope === 'stories' || scope === 'all') {
    for (const p of await query<{ id: string; text_persian: string }>('select id, text_persian from story_pages'))
      items.push({ entity: 'story_page', table: 'story_pages', dir: 'stories', id: p.id, text: p.text_persian })
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
      const items = await collect(scope)
      state.total = items.length
      for (const it of items) {
        try {
          const buf = await ttsPiper(voice, it.text)
          const dir = path.resolve(UPLOADS_DIR, it.dir)
          fs.mkdirSync(dir, { recursive: true })
          const file = `${it.id}.wav`
          fs.writeFileSync(path.join(dir, file), buf)
          const url = `/uploads/${it.dir}/${file}`
          await query(`update ${it.table} set audio_url = $1 where id = $2`, [url, it.id])
          await query('delete from audio_assets where entity_type = $1 and entity_id = $2', [it.entity, it.id])
        } catch (err) {
          state.errors++
          console.error('regen item failed', it.entity, it.id, (err as Error).message)
        }
        state.done++
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
