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
  const [sample, setSample] = useState(meta.sample)
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const em = ENGINES[engine]
  const dirty = engine !== cfg.engine || voice !== cfg.voice

  function pick(e: AudioEngine) {
    setEngine(e)
    setMsg(null); setErr(null)
    const first = ENGINES[e].voices[0]
    // keep the voice if it exists on the new engine (edge ↔ azure share ids)
    if (!ENGINES[e].voices.some(v => v.id === voice)) setVoice(first ? first.id : '')
  }

  async function preview() {
    setBusy('preview'); setMsg(null); setErr(null)
    const r = await api.post<{ audio: string }>('/api/admin/audio/preview', { engine, voice, text: sample })
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
          {em.voices.length > 0 ? (
            <Select value={voice} onChange={e => setVoice(e.target.value)} dir="ltr">
              {!em.voices.some(v => v.id === voice) && voice && <option value={voice}>{voice}</option>}
              {em.voices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </Select>
          ) : (
            <Input value={voice} onChange={e => setVoice(e.target.value)} placeholder="voice id" dir="ltr" />
          )}
        </Field>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="متن آزمایشی">
            <Input value={sample} onChange={e => setSample(e.target.value)} />
          </Field>
        </div>
        <Button variant="secondary" onClick={preview} disabled={busy !== null || !voice || !engines[engine]}>
          {busy === 'preview' ? 'در حال ساخت…' : '▶ تست'}
        </Button>
        <Button onClick={save} disabled={busy !== null || !voice || !dirty}>
          {busy === 'save' ? 'در حال ذخیره…' : 'ذخیره'}
        </Button>
      </div>

      {msg && <p className="text-sm text-green-600">{msg}</p>}
      {err && <p className="text-sm text-red-600 ltr text-left">{err}</p>}
    </div>
  )
}

// ── Regenerate stored audio with the saved per-section voices ─────
interface RegenStatus { running: boolean; scope: string | null; voice: string; done: number; total: number; errors: number; finishedAt: number }
const REGEN_SCOPES: { id: string; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'stories', label: 'داستان‌ها' },
  { id: 'letters', label: 'حروف' },
  { id: 'words', label: 'کلمات' },
  { id: 'phonics', label: 'صداکِشی' },
  { id: 'math', label: 'اعداد (دنیای اعداد)' },
]

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

  async function start(scope: string) {
    setErr(null)
    const r = await api.post<{ started: boolean }>('/api/admin/tts/regenerate', { scope })
    if (r.error) { setErr(r.error); return }
    setPollKey(k => k + 1)
  }

  const running = st?.running
  const pct = st && st.total > 0 ? Math.round((st.done / st.total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800">بازتولید صداهای ذخیره‌شده</h3>
      <p className="text-sm text-slate-500">
        فایل‌های صوتی موجود را با موتور و صدای ذخیره‌شده‌ی هر بخش دوباره می‌سازد. صداهای ضبط‌شده‌ی انسانی دست‌نخورده می‌مانند؛ اول تنظیمات بالا را ذخیره کنید.
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
        <div className="flex flex-wrap gap-2">
          {REGEN_SCOPES.map(s => (
            <Button key={s.id} variant="secondary" onClick={() => start(s.id)}>{s.label}</Button>
          ))}
        </div>
      )}

      {st && !running && st.finishedAt > 0 && (
        <p className="text-sm text-green-600">تمام شد ✅ — {st.done} مورد{st.errors > 0 ? `، ${st.errors} خطا` : ''}</p>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
