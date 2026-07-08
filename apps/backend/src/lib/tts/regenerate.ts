import fs from 'fs'
import path from 'path'
import { query } from '../db'
import { phonicsSyllables, mathAudioItems } from '@koodakbook/shared'
import { synthesizeSection, synthesizeWith, getSectionConfigs, type AudioSection } from '../audio'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads'

export type RegenScope = 'words' | 'letters' | 'stories' | 'phonics' | 'math' | 'all'
export type RegenTier = 'free' | 'premium'

// In-memory progress for the singleton admin regeneration job.
interface RegenState {
  running: boolean
  scope: RegenScope | null
  tier: RegenTier
  voice: string          // human-readable "engine:voice" summary for the admin UI
  done: number
  total: number
  errors: number
  startedAt: number
  finishedAt: number
}
let state: RegenState = { running: false, scope: null, tier: 'free', voice: '', done: 0, total: 0, errors: 0, startedAt: 0, finishedAt: 0 }

export function getRegenStatus(): RegenState {
  return state
}

interface Item {
  section: AudioSection   // which audio_sections row picks the engine + voice
  dir: string
  id: string              // file stem (entity id, or phonics slug)
  text: string
  // DB-backed entities repoint audio_url; phonics is resolved by a fixed path.
  entity?: 'word' | 'letter' | 'story_page'
  table?: 'words' | 'letters' | 'story_pages'
  versioned: boolean      // versioned filename busts caches on re-run (phonics path is fixed → false)
  premiumEligible: boolean // AI story pages are excluded: their voice is chosen at generation time
}

async function collect(scope: RegenScope): Promise<Item[]> {
  const items: Item[] = []
  // tts_text (diacritized pronunciation override) wins over the display text —
  // Persian script omits short vowels, so homographs/letter names need it.
  if (scope === 'words' || scope === 'all') {
    for (const w of await query<{ id: string; persian: string }>('select id, coalesce(tts_text, persian) as persian from words'))
      items.push({ section: 'word', entity: 'word', table: 'words', dir: 'words', id: w.id, text: w.persian, versioned: true, premiumEligible: true })
  }
  if (scope === 'letters' || scope === 'all') {
    for (const l of await query<{ id: string; name_persian: string }>('select id, coalesce(tts_text, name_persian) as name_persian from letters'))
      items.push({ section: 'letter', entity: 'letter', table: 'letters', dir: 'letters', id: l.id, text: l.name_persian, versioned: true, premiumEligible: true })
  }
  if (scope === 'stories' || scope === 'all') {
    // Premium variants only for the curated catalog — regenerating every AI
    // story with a paid engine would burn credits on one-family content.
    for (const p of await query<{ id: string; text_persian: string; ai_generated: boolean }>(
      'select p.id, p.text_persian, s.ai_generated from story_pages p join stories s on s.id = p.story_id'))
      items.push({ section: 'story', entity: 'story_page', table: 'story_pages', dir: 'stories', id: p.id, text: p.text_persian, versioned: true, premiumEligible: !p.ai_generated })
  }
  if (scope === 'phonics' || scope === 'all') {
    // Syllables (consonant + short vowel) — fixed path /uploads/phonics/<slug>.wav.
    for (const s of phonicsSyllables())
      items.push({ section: 'phonics', dir: 'phonics', id: s.slug, text: s.text, versioned: false, premiumEligible: true })
  }
  if (scope === 'math' || scope === 'all') {
    // دنیای اعداد pack: numbers 0–100 + prompt phrases, fixed paths
    // /uploads/math/<slug>.wav (client-built, like phonics). Own section voice.
    for (const m of mathAudioItems())
      items.push({ section: 'math', dir: 'math', id: m.slug, text: m.text, versioned: false, premiumEligible: true })
  }
  return items
}

/** Start a regeneration for ONE tier: 'free' rebuilds the standard files
 *  (premium files untouched), 'premium' rebuilds only the premium variants
 *  (never re-synthesizes free — no wasted sidecar work, no wasted credits).
 *  Returns false if a run is already in progress. Poll getRegenStatus(). */
export function startRegen(scope: RegenScope, tier: RegenTier = 'free'): boolean {
  if (state.running) return false
  state = { running: true, scope, tier, voice: '', done: 0, total: 0, errors: 0, startedAt: Date.now(), finishedAt: 0 }

  void (async () => {
    try {
      const configs = await getSectionConfigs()
      let items = await collect(scope)
      if (tier === 'premium') {
        // Only sections with a premium voice configured, and never AI stories.
        items = items.filter(it => {
          const c = configs.find(x => x.section === it.section)
          return it.premiumEligible && c?.premium_engine && c.premium_voice
        })
      }
      const used = [...new Set(items.map(i => i.section))]
      state.voice = configs.filter(c => used.includes(c.section))
        .map(c => tier === 'premium' ? `${c.premium_engine}:${c.premium_voice}` : `${c.engine}:${c.voice}`)
        .join('، ')
      const ver = state.startedAt   // shared version stamp for this run
      state.total = items.length
      for (const it of items) {
        try {
          if (tier === 'free') {
            // Phonics/math must be real WAV bytes: their client paths are fixed
            // .wav and express-static types the response by extension.
            const clip = await synthesizeSection(it.section, it.text, { wav: !it.versioned })
            const dir = path.resolve(UPLOADS_DIR, it.dir)
            fs.mkdirSync(dir, { recursive: true })
            // Versioned name so re-running with a new voice yields a fresh URL
            // (no stale caches); fixed names for client-built paths.
            const file = it.versioned ? `${it.id}-${ver}.${clip.ext}` : `${it.id}.wav`
            fs.writeFileSync(path.join(dir, file), clip.buf)
            if (it.entity && it.table) {
              const url = `/uploads/${it.dir}/${file}`
              await query(`update ${it.table} set audio_url = $1 where id = $2`, [url, it.id])
              await query('delete from audio_assets where entity_type = $1 and entity_id = $2', [it.entity, it.id])
            }
          } else {
            const cfg = configs.find(c => c.section === it.section)!
            const pClip = await synthesizeWith(cfg.premium_engine!, cfg.premium_voice!, it.text, { wav: !it.versioned })
            const pDir = path.resolve(UPLOADS_DIR, 'premium', it.dir)
            fs.mkdirSync(pDir, { recursive: true })
            const pFile = it.versioned ? `${it.id}-${ver}.${pClip.ext}` : `${it.id}.wav`
            fs.writeFileSync(path.join(pDir, pFile), pClip.buf)
            if (it.entity && it.table) {
              await query(`update ${it.table} set audio_url_premium = $1 where id = $2`,
                [`/uploads/premium/${it.dir}/${pFile}`, it.id])
            }
          }
        } catch (err) {
          state.errors++
          console.error(`${tier} regen item failed`, it.dir, it.id, (err as Error).message)
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
