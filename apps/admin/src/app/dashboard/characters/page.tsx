'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Field, Input, Select, Badge, Spinner, Button } from '@/components/ui'
import CharacterAvatar, { type CharacterMood } from '@/components/CharacterAvatar'
import EmotionEditor from '@/components/EmotionEditor'
import { useActing } from '@/lib/useActing'
import { SCENE_SLUGS, SCENE_LABELS, type AppCharacter, type SceneSlug } from '@koodakbook/shared'
import type { EmotionOverrides } from 'pixel-wizards-charachters'

/* شخصیت‌ها — the character registry (docs/character-system-plan.md).
 * The whole point: adding/changing a character is DATA — a row, a voice, and
 * scripted lines. The «ساخت صداها» button voices missing lines with the
 * character's own voice through the existing synthesis pipeline. */

interface LineDraft { trigger: string; text_persian: string; emotion: string; audio_url?: string | null }

const TRIGGERS = ['greeting', 'praise', 'retry', 'encourage', 'game_open', 'story_open', 'bye']
const EMOTIONS = ['happy', 'excited', 'encouraging', 'idle']
// Every acting state the app can put a character in — the `emotion` column of
// a line (and the LLM's emotion in chat) maps straight onto these.
const MOODS: { id: CharacterMood; label: string }[] = [
  { id: 'idle', label: 'آرام' },
  { id: 'happy', label: 'خوشحال' },
  { id: 'excited', label: 'هیجان‌زده' },
  { id: 'encouraging', label: 'تشویق‌گر' },
  { id: 'thinking', label: 'در فکر 💭' },
]
const TYPES = [
  { id: 'fantasy', label: 'افسانه‌ای' },
  { id: 'animal', label: 'حیوان' },
  { id: 'child', label: 'کودک' },
]
const ROLES = [
  { id: 'vocabulary', label: 'معلم واژگان' },
  { id: 'stories', label: 'قصه‌گو' },
  { id: 'phonics', label: 'معلم صداکشی' },
  { id: 'conversation', label: 'هم‌صحبت' },
]

export default function CharactersPage() {
  const [chars, setChars] = useState<AppCharacter[] | null>(null)

  function load() {
    api.get<AppCharacter[]>('/api/characters/admin/list').then(r => { if (r.data) setChars(r.data) })
  }
  useEffect(load, [])

  if (!chars) return <Spinner />

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="شخصیت‌ها" subtitle="دوست‌های اپ — شخصیت جدید یعنی یک ردیف داده + یک صدا + چند جمله؛ بدون کدنویسی." />
      {chars.map(c => <CharacterCard key={c.id} c={c} onSaved={load} />)}
      <p className="text-xs text-slate-400">
        افزودن شخصیت سوم: فعلاً با یک ردیف در دیتابیس (الگوی سیمرغ/روزی) + تصویر SVG در اپ. فرم «شخصیت جدید» در نسخه‌ی بعد.
      </p>
    </div>
  )
}

function CharacterCard({ c, onSaved }: { c: AppCharacter & { system_prompt?: string }; onSaved: () => void }) {
  const [f, setF] = useState({
    name_persian: c.name_persian, type: c.type, personality: c.personality,
    age_band: c.age_band, level: c.level, voice_engine: c.voice_engine, voice_id: c.voice_id,
    topics: (c.topics ?? []).join(', '), teaching_role: c.teaching_role,
    home_scene: c.home_scene, system_prompt: c.system_prompt ?? '', is_active: c.is_active,
  })
  const [lines, setLines] = useState<LineDraft[]>(
    (c.lines ?? []).map(l => ({ trigger: l.trigger, text_persian: l.text_persian, emotion: l.emotion, audio_url: l.audio_url })))
  // Per-emotion tuning (animation.emotions) — sparse override map, live-previewed.
  const [emo, setEmo] = useState<EmotionOverrides>((c.animation?.emotions as EmotionOverrides) ?? {})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // Acting preview: a static mood picker + a live performer. The performer turns
  // a sentence into lip-sync (mouth follows the words) + the emotion's body mood,
  // synced to the line's audio when it has one. Remount replays one-shot moods.
  const [pMood, setPMood] = useState<CharacterMood>('idle')
  const [pKey, setPKey] = useState(0)
  const [sayText, setSayText] = useState((c.lines ?? [])[0]?.text_persian ?? '')
  const { mouth: actMouth, mood: actMood, playing, play } = useActing()

  const voiced = lines.filter(l => l.audio_url).length

  async function save() {
    setBusy('save'); setMsg(null); setErr(null)
    const body = {
      ...f,
      age_band: Number(f.age_band), level: Number(f.level),
      topics: f.topics.split(',').map(t => t.trim()).filter(Boolean),
      // Preserve any other animation keys; overwrite only the emotion tuning.
      animation: { ...(c.animation ?? {}), emotions: emo },
    }
    const r1 = await api.patch(`/api/characters/admin/${c.id}`, body)
    const r2 = await api.put(`/api/characters/admin/${c.id}/lines`, {
      lines: lines.filter(l => l.text_persian.trim()).map(({ trigger, text_persian, emotion }) => ({ trigger, text_persian, emotion })),
    })
    setBusy(null)
    if (r1.error || r2.error) { setErr(r1.error ?? r2.error ?? 'خطا'); return }
    setMsg('ذخیره شد ✅')
    onSaved()
  }

  async function makeAudio() {
    setBusy('audio'); setMsg(null); setErr(null)
    const r = await api.post<{ done: number; errors: number }>(`/api/characters/admin/${c.id}/audio`, {})
    setBusy(null)
    if (r.error || !r.data) { setErr(r.error ?? 'خطا'); return }
    setMsg(`صداها: ${r.data.done} ساخته شد${r.data.errors ? `، ${r.data.errors} خطا (سهمیه/کلید؟)` : ' ✅'}`)
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{c.name_persian} <span className="text-xs text-slate-400 ltr">({c.slug})</span></h3>
        <div className="flex gap-2">
          <Badge tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'فعال' : 'خاموش'}</Badge>
          <Badge tone={voiced === lines.length && lines.length > 0 ? 'green' : 'amber'}>🔊 {voiced}/{lines.length}</Badge>
        </div>
      </div>

      {/* Acting preview — real performance: the avatar lip-syncs the sentence */}
      <div className="flex items-start gap-4 bg-slate-50 rounded-xl p-3">
        <div className="shrink-0 w-[104px] h-[104px] flex items-center justify-center">
          <CharacterAvatar key={pKey} slug={c.slug} size={96}
            mood={playing ? actMood : pMood}
            talking={playing}
            mouth={playing ? actMouth : undefined}
            emotions={emo} />
        </div>
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">
            پیش‌نمایش حرکت‌ها — یک جمله بنویس تا شخصیت با همان کلمه‌ها لب بزند و حسِ جمله را بازی کند
          </p>
          {/* say a sentence → it performs; mouth tracks the actual Persian sounds */}
          <div className="flex gap-2">
            <input value={sayText} onChange={e => setSayText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') play(sayText) }}
              placeholder="یک جمله بنویس…"
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
            <button onClick={() => play(sayText)} disabled={!sayText.trim()}
              className="text-xs rounded-lg px-3 py-1.5 bg-amber-500 text-white font-semibold shrink-0 disabled:opacity-50">
              {playing ? '● در حال اجرا' : '▶ اجرا'}
            </button>
          </div>
          {/* static mood preview (the emotion column of a line maps onto these) */}
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map(m => (
              <button key={m.id} onClick={() => { setPMood(m.id); setPKey(k => k + 1) }}
                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                  !playing && pMood === m.id ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Emotion parameters — tune each emotion; saved with «ذخیره» below */}
      <EmotionEditor slug={c.slug} value={emo} onChange={setEmo} />

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="نام"><Input value={f.name_persian} onChange={e => setF({ ...f, name_persian: e.target.value })} /></Field>
        <Field label="نوع">
          <Select value={f.type} onChange={e => setF({ ...f, type: e.target.value as typeof f.type })}>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="نقش آموزشی">
          <Select value={f.teaching_role} onChange={e => setF({ ...f, teaching_role: e.target.value })}>
            {ROLES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="خانه (صحنه)">
          <Select value={f.home_scene} onChange={e => setF({ ...f, home_scene: e.target.value })}>
            {SCENE_SLUGS.map(sc => <option key={sc} value={sc}>{SCENE_LABELS[sc as SceneSlug]}</option>)}
          </Select>
        </Field>
        <Field label="صدا — voice id" hint="صدای اختصاصی این شخصیت (ElevenLabs)">
          <Input value={f.voice_id} onChange={e => setF({ ...f, voice_id: e.target.value })} dir="ltr" />
        </Field>
        <Field label="موضوع‌ها" hint="دسته‌های واژگان، با ویرگول">
          <Input value={f.topics} onChange={e => setF({ ...f, topics: e.target.value })} dir="ltr" placeholder="animals, colors, food" />
        </Field>
      </div>
      <Field label="شخصیت (برای بچه‌ها نمایش داده می‌شود و در گفت‌وگوی نسخه‌ی بعد استفاده می‌شود)">
        <Input value={f.personality} onChange={e => setF({ ...f, personality: e.target.value })} />
      </Field>

      {/* Scripted lines */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">جمله‌ها</p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={l.trigger} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, trigger: e.target.value } : x))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white shrink-0" dir="ltr">
                {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={l.text_persian}
                onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, text_persian: e.target.value, audio_url: null } : x))}
                className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
              <select value={l.emotion} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, emotion: e.target.value } : x))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white shrink-0" dir="ltr">
                {EMOTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="button" onClick={() => play(l.text_persian, l.emotion, l.audio_url)}
                disabled={!l.text_persian.trim()} title="اجرا با همین حس و صدا"
                className="shrink-0 text-amber-600 hover:text-amber-700 disabled:opacity-30 px-1">▶</button>
              <span title={l.audio_url ? 'صدا دارد' : 'بدون صدا'} className="shrink-0 text-sm">{l.audio_url ? '🔊' : '—'}</span>
              <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-red-400 px-1 shrink-0" aria-label="حذف">✕</button>
            </div>
          ))}
          <button onClick={() => setLines(ls => [...ls, { trigger: 'praise', text_persian: '', emotion: 'happy' }])}
            className="text-xs text-amber-700 hover:underline">+ جمله‌ی جدید</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button onClick={save} disabled={busy !== null}>{busy === 'save' ? 'در حال ذخیره…' : 'ذخیره'}</Button>
        <Button variant="secondary" onClick={makeAudio} disabled={busy !== null}>
          {busy === 'audio' ? 'در حال ساخت…' : '🔊 ساخت صداهای بدون صدا'}
        </Button>
        <label className="flex items-center gap-1.5 text-sm mr-auto">
          <input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} /> فعال
        </label>
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
