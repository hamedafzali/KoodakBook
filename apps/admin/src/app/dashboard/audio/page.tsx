'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { PageHeader, Field, Input, Select, Badge, Spinner, Button } from '@/components/ui'
import type { AudioSection, AudioEngine, AudioSectionConfig } from '@koodakbook/shared'

// ── Engine catalog (what the admin can pick per section) ──
// Ranked for Persian: research + community reports, not marketing pages.
//   ElevenLabs (eleven_v3) — best Persian, needs paid key; voice_id from their panel.
//   Azure / Edge — same fa-IR neural voices; Azure is the keyed/SLA variant,
//     Edge runs free through our sidecar.
//   OpenAI — speaks Persian but tends toward an Afghan accent (community reports).
//   Google — classic voices have no fa-IR; only usable via custom setups.
//   Piper — offline, robotic; the last-resort baseline.
type EngineMeta = {
  label: string
  hint: string
  voices: { id: string; label: string }[]   // empty → free-text voice id
  free: boolean                             // runs without an API key
}
const ENGINES: Record<AudioEngine, EngineMeta> = {
  edge: {
    label: 'Edge (مایکروسافت) — رایگان',
    hint: 'صدای نورال مایکروسافت، رایگان از طریق سرور خودمان. بهترین گزینه‌ی بدون هزینه.',
    voices: [
      { id: 'fa-IR-FaridNeural', label: 'FaridNeural — مرد' },
      { id: 'fa-IR-DilaraNeural', label: 'DilaraNeural — زن' },
    ],
    free: true,
  },
  elevenlabs: {
    label: 'ElevenLabs — بهترین کیفیت (پولی)',
    hint: 'بهترین فارسی (فقط مدل eleven_v3). voice_id را از پنل ElevenLabs کپی کنید.',
    voices: [],
    free: false,
  },
  azure: {
    label: 'Azure Speech — کیفیت بالا (کلید)',
    hint: 'همان صداهای Edge با کلید رسمی و پایداری بیشتر (سهمیه‌ی رایگان ماهانه دارد).',
    voices: [
      { id: 'fa-IR-FaridNeural', label: 'FaridNeural — مرد' },
      { id: 'fa-IR-DilaraNeural', label: 'DilaraNeural — زن' },
    ],
    free: false,
  },
  openai: {
    label: 'OpenAI TTS (کلید)',
    hint: 'فارسی را می‌خواند اما لهجه گاهی افغانی می‌شود — قبل از انتخاب حتماً تست کنید.',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage'].map(v => ({ id: v, label: v })),
    free: false,
  },
  google: {
    label: 'Google Cloud TTS (کلید)',
    hint: 'صدای کلاسیک fa-IR ندارد — فقط اگر می‌دانید چه می‌کنید.',
    voices: [],
    free: false,
  },
  piper: {
    label: 'Piper — آفلاین',
    hint: 'کاملاً آفلاین و رایگان، ولی کیفیت ماشینی. فقط برای شرایط بدون اینترنت.',
    voices: ['fa_IR-amir-medium', 'fa_IR-ganji-medium', 'fa_IR-ganji_adabi-medium', 'fa_IR-gyro-medium', 'fa_IR-reza_ibrahim-medium']
      .map(v => ({ id: v, label: v })),
    free: true,
  },
}
const ENGINE_ORDER: AudioEngine[] = ['edge', 'elevenlabs', 'azure', 'openai', 'google', 'piper']
const PREMIUM_ENGINES: AudioEngine[] = ['elevenlabs', 'azure', 'openai', 'google']

const SECTIONS: Record<AudioSection, { title: string; desc: string; sample: string; regenScope: string }> = {
  story: {
    title: 'داستان‌ها',
    desc: 'متن صفحه‌های داستان (متن بلند و روان). موتورهای ابری فقط برای حساب‌های پرمیوم اجرا می‌شوند.',
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
function useElevenVoices(active: boolean): VoiceOpt[] | null {
  const [voices, setVoices] = useState<VoiceOpt[] | null>(elevenCache)
  useEffect(() => {
    if (!active || elevenCache) return
    api.get<VoiceOpt[]>('/api/admin/audio/voices?engine=elevenlabs')
      .then(r => { if (r.data) { elevenCache = r.data; setVoices(r.data) } })
  }, [active])
  return voices
}

/** Options for a voice picker: live ElevenLabs list when that engine is
 *  chosen, else the static per-engine list (empty → free-text input). */
function voiceOptionsFor(engine: AudioEngine | '', eleven: VoiceOpt[] | null): VoiceOpt[] {
  if (!engine) return []
  if (engine === 'elevenlabs') return eleven ?? []
  return ENGINES[engine].voices
}

export default function AudioPage() {
  const [data, setData] = useState<SectionsResponse | null>(null)

  useEffect(() => {
    api.get<SectionsResponse>('/api/admin/audio/sections').then(r => { if (r.data) setData(r.data) })
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
        <p>۱. <b>ElevenLabs (eleven_v3)</b> — طبیعی‌ترین فارسی؛ پولی، برای حروف و هجاها ارزشش را دارد.</p>
        <p>۲. <b>Edge / Azure</b> — صدای نورال مایکروسافت (Farid/Dilara)؛ Edge رایگان است و برای داستان‌ها معمولاً کافی است.</p>
        <p>۳. <b>OpenAI</b> — روان اما با ته‌لهجه؛ قبل از انتخاب تست کنید.</p>
        <p>۴. <b>Piper</b> — آفلاین و ماشینی؛ فقط وقتی اینترنت سرور قطع است.</p>
        <p className="pt-1 text-amber-800">
          🎙 گزینه‌ی پنجم: <b>ضبط صدای انسانی</b> — برای حروف و هجاها از همه‌ی موتورها بهتر است. از دکمه‌ی ضبط در
          {' '}<Link href="/dashboard/letters" className="underline font-semibold">صفحه‌ی حروف</Link> و
          {' '}<Link href="/dashboard/words" className="underline font-semibold">صفحه‌ی کلمات</Link> استفاده کنید؛
          صدای ضبط‌شده همیشه بر صدای تولیدی مقدم است.
        </p>
      </div>

      {SECTION_ORDER.map(sec => {
        const cfg = data.sections.find(s => s.section === sec)
        if (!cfg) return null
        return <SectionCard key={sec} cfg={cfg} engines={data.engines} />
      })}

      <RegenCard />
    </div>
  )
}

// ── One content section: engine + voice + test + save ─────
function SectionCard({ cfg, engines }: { cfg: AudioSectionConfig; engines: Record<AudioEngine, boolean> }) {
  const meta = SECTIONS[cfg.section]
  const [engine, setEngine] = useState<AudioEngine>(cfg.engine)
  const [voice, setVoice] = useState(cfg.voice)
  const [pEngine, setPEngine] = useState<AudioEngine | ''>(cfg.premium_engine ?? '')
  const [pVoice, setPVoice] = useState(cfg.premium_voice ?? '')
  const [sample, setSample] = useState(meta.sample)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const em = ENGINES[engine]
  const elevenVoices = useElevenVoices(engines.elevenlabs && (engine === 'elevenlabs' || pEngine === 'elevenlabs'))
  const dirty = engine !== cfg.engine || voice !== cfg.voice ||
    pEngine !== (cfg.premium_engine ?? '') || pVoice !== (cfg.premium_voice ?? '')

  /** Kick off this section's regeneration for one tier (free ≠ premium runs). */
  async function regen(tier: 'free' | 'premium') {
    if (dirty) { setErr('اول تغییرات را ذخیره کنید، بعد بازتولید'); return }
    setMsg(null); setErr(null)
    const r = await api.post<{ started: boolean }>('/api/admin/tts/regenerate', { scope: meta.regenScope, tier })
    if (r.error) { setErr(r.error); return }
    setMsg(tier === 'premium' ? 'بازتولید پرمیوم شروع شد ⭐ — پیشرفت در پایین صفحه' : 'بازتولید رایگان شروع شد — پیشرفت در پایین صفحه')
  }

  function pick(e: AudioEngine) {
    setEngine(e)
    setMsg(null); setErr(null)
    const first = ENGINES[e].voices[0]
    // keep the voice if it exists on the new engine (edge ↔ azure share ids)
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
    const r = await api.patch<{ ok: boolean }>(`/api/admin/audio/sections/${cfg.section}`,
      { engine, voice, premium_engine: pEngine || null, premium_voice: pVoice.trim() || null })
    setBusy(null)
    if (r.error) { setErr(r.error); return }
    cfg.engine = engine; cfg.voice = voice
    cfg.premium_engine = (pEngine || null) as typeof cfg.premium_engine
    cfg.premium_voice = pVoice.trim() || null
    setMsg('ذخیره شد ✅ — برای اعمال روی فایل‌های موجود، پایین صفحه بازتولید کنید.')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{meta.title}</h3>
        <Badge tone={em.free ? 'green' : engines[engine] ? 'blue' : 'red'}>
          {em.free ? 'رایگان' : engines[engine] ? 'کلید تنظیم شده' : 'کلید ندارد'}
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
                placeholder={engine === 'elevenlabs' ? 'در حال دریافت صداها…' : 'voice id'} dir="ltr" />
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

      {/* Premium tier: paid accounts hear this instead; files are generated
          side by side under /uploads/premium during regeneration. */}
      <div className="border-t border-dashed border-slate-200 pt-3 space-y-3">
        <p className="text-sm font-semibold text-slate-700">صدای پرمیوم (اختیاری) ⭐
          <span className="text-xs font-normal text-slate-400 mr-2">فقط حساب‌های پولی این نسخه را می‌شنوند؛ خالی = همان صدای رایگان</span>
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="موتور پرمیوم">
            <Select value={pEngine} onChange={e => setPEngine(e.target.value as AudioEngine | '')}>
              <option value="">— بدون صدای پرمیوم</option>
              {PREMIUM_ENGINES.map(e => (
                <option key={e} value={e} disabled={!engines[e]}>
                  {ENGINES[e].label}{!engines[e] ? ' — کلید ندارد' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="صدای پرمیوم" hint={pEngine ? ENGINES[pEngine].hint : ''}>
            <div className="flex gap-2">
              {(() => {
                const opts = voiceOptionsFor(pEngine, elevenVoices)
                return opts.length > 0 ? (
                  <Select value={pVoice} onChange={e => setPVoice(e.target.value)} dir="ltr">
                    {!pVoice && <option value="">— انتخاب صدا</option>}
                    {!opts.some(v => v.id === pVoice) && pVoice && <option value={pVoice}>{pVoice}</option>}
                    {opts.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </Select>
                ) : (
                  <Input value={pVoice} onChange={e => setPVoice(e.target.value)}
                    placeholder={pEngine === 'elevenlabs' ? 'در حال دریافت صداها…' : 'voice id'} dir="ltr" disabled={!pEngine} />
                )
              })()}
              <Button variant="secondary" onClick={() => pEngine && preview(pEngine, pVoice)}
                disabled={busy !== null || !pEngine || !pVoice || !engines[pEngine as AudioEngine]}>▶</Button>
            </div>
          </Field>
        </div>
      </div>

      {/* Generation lives here, per tier: each run builds ONLY its own files */}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button variant="secondary" onClick={() => regen('free')} disabled={busy !== null}>
          🔄 بازتولید رایگان این بخش
        </Button>
        <Button variant="secondary" onClick={() => regen('premium')}
          disabled={busy !== null || !cfg.premium_engine || !cfg.premium_voice}>
          ⭐ بازتولید پرمیوم این بخش
        </Button>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-600 ltr text-left">{err}</p>}
    </div>
  )
}

// ── Regenerate stored audio with the saved per-section voices ─────
interface RegenStatus { running: boolean; scope: string | null; tier?: 'free' | 'premium'; voice: string; done: number; total: number; errors: number; finishedAt: number }
function RegenCard() {
  const [st, setSt] = useState<RegenStatus | null>(null)
  const [pollKey, setPollKey] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    async function tick() {
      const r = await api.get<RegenStatus>('/api/admin/tts/regenerate/status')
      if (!active) return
      if (r.data) setSt(r.data)
      if (r.data?.running) timer = setTimeout(tick, 1500)
    }
    tick()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [pollKey])

  async function start(tier: 'free' | 'premium') {
    setErr(null)
    const r = await api.post<{ started: boolean }>('/api/admin/tts/regenerate', { scope: 'all', tier })
    if (r.error) { setErr(r.error); return }
    setPollKey(k => k + 1)
  }

  const running = st?.running
  const pct = st && st.total > 0 ? Math.round((st.done / st.total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800">بازتولید همه‌ی بخش‌ها + پیشرفت</h3>
      <p className="text-sm text-slate-500">
        بازتولید هر بخش، داخل کارت همان بخش است. اینجا می‌توانید همه را یک‌جا بسازید — رایگان و پرمیوم جدا از هم اجرا می‌شوند و فایل‌های هم را دست نمی‌زنند. صداهای ضبط‌شده‌ی انسانی همیشه دست‌نخورده می‌مانند.
      </p>

      {running ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">در حال ساخت {st?.tier === 'premium' ? 'پرمیوم ⭐' : 'رایگان'} ({st?.scope}) — {st?.voice}</span>
            <span className="font-bold text-slate-800">{st?.done} / {st?.total}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => start('free')}>🔄 بازتولید همه — رایگان</Button>
          <Button variant="secondary" onClick={() => start('premium')}>⭐ بازتولید همه — پرمیوم</Button>
        </div>
      )}

      {st && !running && st.finishedAt > 0 && (
        <p className="text-sm text-green-600">تمام شد ✅ — {st.done} مورد{st.errors > 0 ? `، ${st.errors} خطا` : ''}</p>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
