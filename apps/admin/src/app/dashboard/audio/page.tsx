'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader, Field, Input, Select, Badge, Spinner, Button } from '@/components/ui'
import type { AudioSection, AudioEngine, AudioSectionConfig } from '@koodakbook/shared'

// ── Engine catalog (what the admin can pick per section) ──
// Cloud engines only — the free Piper/Edge sidecar was removed (single-tier
// collapse, migration 048). Every account hears the one configured voice.
// Ranked for Persian: research + community reports, not marketing pages.
//   ElevenLabs (eleven_v3) — best Persian; voice_id from their panel.
//   Azure — fa-IR neural voices (Farid/Dilara) with a keyed SLA.
//   OpenAI — speaks Persian but tends toward an Afghan accent (community reports).
//   Google — classic voices have no fa-IR; only usable via custom setups.
type EngineMeta = {
  label: string
  hint: string
  voices: { id: string; label: string }[]   // empty → free-text voice id
}
const ENGINES: Record<AudioEngine, EngineMeta> = {
  elevenlabs: {
    label: 'ElevenLabs — بهترین کیفیت',
    hint: 'بهترین فارسی (فقط مدل eleven_v3). voice_id را از پنل ElevenLabs کپی کنید.',
    voices: [],
  },
  azure: {
    label: 'Azure Speech — نورال (کلید)',
    hint: 'صداهای نورال fa-IR مایکروسافت با کلید رسمی و پایداری بیشتر (سهمیه‌ی رایگان ماهانه دارد).',
    voices: [
      { id: 'fa-IR-FaridNeural', label: 'FaridNeural — مرد' },
      { id: 'fa-IR-DilaraNeural', label: 'DilaraNeural — زن' },
    ],
  },
  openai: {
    label: 'OpenAI TTS (کلید)',
    hint: 'فارسی را می‌خواند اما لهجه گاهی افغانی می‌شود — قبل از انتخاب حتماً تست کنید.',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage'].map(v => ({ id: v, label: v })),
  },
  google: {
    label: 'Google Cloud TTS (کلید)',
    hint: 'صدای کلاسیک fa-IR ندارد — فقط اگر می‌دانید چه می‌کنید.',
    voices: [],
  },
}
const ENGINE_ORDER: AudioEngine[] = ['elevenlabs', 'azure', 'openai', 'google']

const SECTIONS: Record<AudioSection, { title: string; desc: string; sample: string; regenScope: string }> = {
  story: {
    title: 'داستان‌ها',
    desc: 'متن صفحه‌های داستان (متن بلند و روان). همان صدا برای همه‌ی حساب‌ها.',
    sample: 'یکی بود، یکی نبود. در جنگلی سرسبز، خرگوش کوچکی زندگی می‌کرد.',
    regenScope: 'stories',
  },
  letter: {
    title: 'حروف الفبا',
    desc: 'نام حروف («بِه»، «رِه»…) — سخت‌ترین حالت برای TTS. تلفظ اِعراب‌گذاری‌شده از صفحه‌ی حروف خوانده می‌شود.',
    sample: 'رِه',
    regenScope: 'letters',
  },
  word: {
    title: 'کلمات',
    desc: 'واژه‌های تکی (کارت‌های واژگان). برای هم‌نگاشت‌ها (کرم…) تلفظ را در صفحه‌ی کلمات اِعراب‌گذاری کنید.',
    sample: 'خرس قهوه‌ای',
    regenScope: 'words',
  },
  phonics: {
    title: 'صداکِشی (هجاها)',
    desc: 'هجاهای حرف + مصوت («بَ بِ بُ»). کوتاه‌ترین و سخت‌ترین کلیپ‌ها — حتماً قبل از بازتولید تست کنید.',
    sample: 'بَ',
    regenScope: 'phonics',
  },
  math: {
    title: 'اعداد (دنیای اعداد)',
    desc: 'عددهای ۰ تا ۱۰۰ و جمله‌های بازی («چند تا بود؟»، «آفرین!»). کلیپ‌های کوتاه — عدد «دو» و «نه» را حتماً تست کنید.',
    sample: 'بیست و سه',
    regenScope: 'math',
  },
}
const SECTION_ORDER: AudioSection[] = ['story', 'letter', 'word', 'phonics', 'math']

interface SectionsResponse {
  sections: AudioSectionConfig[]
  engines: Record<AudioEngine, boolean>
}

// ElevenLabs voice catalogue, fetched from the account's own voice list so the
// operator picks by NAME — never hunts voice ids in a third-party panel.
type VoiceOpt = { id: string; label: string }
let elevenCache: VoiceOpt[] | null = null
function useElevenVoices(active: boolean): { voices: VoiceOpt[] | null; error: string | null } {
  const [voices, setVoices] = useState<VoiceOpt[] | null>(elevenCache)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!active) return
    if (elevenCache) { setVoices(elevenCache); return }   // late activators hydrate from cache
    api.get<VoiceOpt[]>('/api/admin/audio/voices?engine=elevenlabs')
      .then(r => {
        if (r.data) { elevenCache = r.data; setVoices(r.data) }
        else setError(r.error ?? 'دریافت فهرست صداها ممکن نشد')
      })
  }, [active])
  return { voices, error }
}

/** Options for a voice picker: live ElevenLabs list when that engine is
 *  chosen, else the static per-engine list (empty → free-text input). */
function voiceOptionsFor(engine: AudioEngine | '', eleven: VoiceOpt[] | null): VoiceOpt[] {
  if (!engine) return []
  if (engine === 'elevenlabs') return eleven ?? []
  return ENGINES[engine].voices
}

interface RegenStatus { running: boolean; scope: string | null; mode?: 'all' | 'missing'; voice: string; done: number; total: number; errors: number; finishedAt: number }

export default function AudioPage() {
  const [data, setData] = useState<SectionsResponse | null>(null)
  const [regen, setRegen] = useState<RegenStatus | null>(null)

  useEffect(() => {
    api.get<SectionsResponse>('/api/admin/audio/sections').then(r => { if (r.data) setData(r.data) })
  }, [])

  // One global status poller: a run started ANYWHERE (a section card or the
  // bottom card) shows its progress in the right card within a tick.
  useEffect(() => {
    let on = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function tick() {
      const r = await api.get<RegenStatus>('/api/admin/tts/regenerate/status')
      if (!on) return
      if (r.data) setRegen(r.data)
      timer = setTimeout(tick, r.data?.running ? 1500 : 3000)
    }
    tick()
    return () => { on = false; if (timer) clearTimeout(timer) }
  }, [])

  if (!data) return <Spinner />

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="صداها"
        subtitle="برای هر بخش از اپ، موتور و صدای جداگانه انتخاب کنید، تست کنید و بعد بازتولید کنید."
      />

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 space-y-1.5">
        <p className="font-bold">راهنمای کیفیت فارسی</p>
        <p>۱. <b>ElevenLabs (eleven_v3)</b> — طبیعی‌ترین فارسی؛ برای حروف و هجاها ارزشش را دارد.</p>
        <p>۲. <b>Azure</b> — صدای نورال مایکروسافت (Farid/Dilara) با کلید رسمی.</p>
        <p>۳. <b>OpenAI</b> — روان اما با ته‌لهجه؛ قبل از انتخاب تست کنید.</p>
        <p className="pt-1 text-amber-800">
          🎙 بهتر از همه‌ی موتورها برای حروف و هجاها: <b>ضبط صدای انسانی</b>. از دکمه‌ی ضبط در
          {' '}<Link href="/dashboard/letters" className="underline font-semibold">صفحه‌ی حروف</Link> و
          {' '}<Link href="/dashboard/words" className="underline font-semibold">صفحه‌ی کلمات</Link> استفاده کنید؛
          صدای ضبط‌شده همیشه بر صدای تولیدی مقدم است.
        </p>
      </div>

      {SECTION_ORDER.map(sec => {
        const cfg = data.sections.find(s => s.section === sec)
        if (!cfg) return null
        return <SectionCard key={sec} cfg={cfg} engines={data.engines} regen={regen} />
      })}

      <RegenCard st={regen} />
    </div>
  )
}

// ── One content section: engine + voice + test + save ─────
function SectionCard({ cfg, engines, regen: regenSt }: { cfg: AudioSectionConfig; engines: Record<AudioEngine, boolean>; regen: RegenStatus | null }) {
  const meta = SECTIONS[cfg.section]
  const [engine, setEngine] = useState<AudioEngine>(cfg.engine)
  const [voice, setVoice] = useState(cfg.voice)
  const [sample, setSample] = useState(meta.sample)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const em = ENGINES[engine]
  const { voices: elevenVoices, error: elevenErr } = useElevenVoices(engines.elevenlabs && engine === 'elevenlabs')
  const dirty = engine !== cfg.engine || voice !== cfg.voice

  const [onlyMissing, setOnlyMissing] = useState(true)

  /** Kick off this section's regeneration (single cloud tier). */
  async function regen() {
    if (dirty) { setErr('اول تغییرات را ذخیره کنید، بعد بازتولید'); return }
    setMsg(null); setErr(null)
    const r = await api.post<{ started: boolean }>('/api/admin/tts/regenerate',
      { scope: meta.regenScope, mode: onlyMissing ? 'missing' : 'all' })
    if (r.error) { setErr(r.error); return }
    setMsg('بازتولید شروع شد')
  }

  function pick(e: AudioEngine) {
    setEngine(e)
    setMsg(null); setErr(null)
    const first = ENGINES[e].voices[0]
    // keep the voice if it exists on the new engine
    if (!ENGINES[e].voices.some(v => v.id === voice)) setVoice(first ? first.id : '')
  }

  async function preview(e: AudioEngine, v: string) {
    setBusy('preview'); setMsg(null); setErr(null)
    const r = await api.post<{ audio: string }>('/api/admin/audio/preview', { engine: e, voice: v, text: sample })
    setBusy(null)
    if (r.error || !r.data) { setErr(r.error ?? 'خطا در تولید صدا'); return }
    audioRef.current?.pause()
    audioRef.current = new Audio(r.data.audio)
    audioRef.current.play().catch(() => setErr('پخش صدا در مرورگر ممکن نشد'))
  }

  async function save() {
    setBusy('save'); setMsg(null); setErr(null)
    const r = await api.patch<{ ok: boolean }>(`/api/admin/audio/sections/${cfg.section}`, { engine, voice })
    setBusy(null)
    if (r.error) { setErr(r.error); return }
    cfg.engine = engine; cfg.voice = voice
    setMsg('ذخیره شد ✅ — برای اعمال روی فایل‌های موجود، پایین صفحه بازتولید کنید.')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{meta.title}</h3>
        <Badge tone={engines[engine] ? 'blue' : 'red'}>
          {engines[engine] ? 'کلید تنظیم شده' : 'کلید ندارد'}
        </Badge>
      </div>
      <p className="text-sm text-slate-500">{meta.desc}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="موتور">
          <Select value={engine} onChange={e => pick(e.target.value as AudioEngine)}>
            {ENGINE_ORDER.map(e => (
              <option key={e} value={e} disabled={!engines[e]}>
                {ENGINES[e].label}{!engines[e] ? ' — کلید ندارد' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="صدا (Voice)" hint={em.hint}>
          {(() => {
            const opts = voiceOptionsFor(engine, elevenVoices)
            return opts.length > 0 ? (
              <Select value={voice} onChange={e => setVoice(e.target.value)} dir="ltr">
                {!opts.some(v => v.id === voice) && voice && <option value={voice}>{voice}</option>}
                {opts.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </Select>
            ) : (
              <Input value={voice} onChange={e => setVoice(e.target.value)}
                placeholder={engine === 'elevenlabs' ? (elevenErr ? 'voice id — فهرست دریافت نشد' : 'در حال دریافت صداها…') : 'voice id'} dir="ltr" />
            )
          })()}
        </Field>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="متن آزمایشی">
            <Input value={sample} onChange={e => setSample(e.target.value)} />
          </Field>
        </div>
        <Button variant="secondary" onClick={() => preview(engine, voice)} disabled={busy !== null || !voice || !engines[engine]}>
          {busy === 'preview' ? 'در حال ساخت…' : '▶ تست'}
        </Button>
        <Button onClick={save} disabled={busy !== null || !voice || !dirty}>
          {busy === 'save' ? 'در حال ذخیره…' : 'ذخیره'}
        </Button>
      </div>

      {/* Generation lives here, per section */}
      <label className="flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3 cursor-pointer">
        <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
        فقط موارد بدون صدا (جدیدها) — چیزی که صدا دارد دوباره ساخته نمی‌شود
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={regen} disabled={busy !== null || regenSt?.running}>
          🔄 بازتولید این بخش
        </Button>
      </div>

      {/* Live progress for the run touching THIS section */}
      {regenSt?.running && (regenSt.scope === meta.regenScope || regenSt.scope === 'all') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              در حال ساخت
              {regenSt.mode === 'missing' ? ' — فقط جدیدها' : ''}
              {regenSt.scope === 'all' ? ' (همه‌ی بخش‌ها)' : ''} — {regenSt.voice}
            </span>
            <span className="font-bold text-slate-800">{regenSt.done} / {regenSt.total}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all"
              style={{ width: `${regenSt.total ? Math.round((regenSt.done / regenSt.total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {elevenErr && engine === 'elevenlabs' && (
        <p className="text-sm text-red-600">{elevenErr}</p>
      )}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-600 ltr text-left">{err}</p>}
    </div>
  )
}

// ── Regenerate stored audio with the saved per-section voices ─────
function RegenCard({ st }: { st: RegenStatus | null }) {
  const [err, setErr] = useState<string | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(true)

  async function start() {
    setErr(null)
    const r = await api.post<{ started: boolean }>('/api/admin/tts/regenerate',
      { scope: 'all', mode: onlyMissing ? 'missing' : 'all' })
    if (r.error) setErr(r.error)
  }

  const [demoMsg, setDemoMsg] = useState<string | null>(null)
  async function makeDemo() {
    setErr(null); setDemoMsg('در حال ساخت نمونه…')
    const r = await api.post<{ url: string }>('/api/admin/audio/demo', {})
    if (r.error) { setDemoMsg(null); setErr(r.error); return }
    setDemoMsg('نمونه ساخته شد ✅ — در بخش قیمتِ سایت پخش می‌شود')
  }

  const running = st?.running
  const pct = st && st.total > 0 ? Math.round((st.done / st.total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800">بازتولید همه‌ی بخش‌ها + پیشرفت</h3>
      <p className="text-sm text-slate-500">
        بازتولید هر بخش، داخل کارت همان بخش است. اینجا می‌توانید همه را یک‌جا بسازید. صداهای ضبط‌شده‌ی انسانی همیشه دست‌نخورده می‌مانند.
      </p>

      {running ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">در حال ساخت ({st?.scope}) — {st?.voice}</span>
            <span className="font-bold text-slate-800">{st?.done} / {st?.total}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            فقط موارد بدون صدا (جدیدها)
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={start}>🔄 بازتولید همه</Button>
            <Button variant="secondary" onClick={makeDemo}>🎧 ساخت نمونه‌ی صدا برای سایت</Button>
          </div>
        </div>
      )}

      {st && !running && st.finishedAt > 0 && (
        <p className="text-sm text-green-600">تمام شد ✅ — {st.done} مورد{st.errors > 0 ? `، ${st.errors} خطا` : ''}</p>
      )}
      {demoMsg && <p className="text-sm text-slate-600">{demoMsg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
