'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Field, Input, Select, Badge, Spinner, Button, Toggle } from '@/components/ui'

type Provider = 'anthropic' | 'openai_compatible'

interface Settings {
  provider: Provider
  model: string
  base_url: string | null
  system_prompt: string
  user_prompt_template: string
  max_tokens: number
  ai_enabled: boolean
  updated_at?: string
  updated_by?: string | null
}

// Preset endpoints. Anything OpenAI-compatible (OpenAI + the Chinese providers +
// aggregators) works through one adapter — they differ only by base_url + model.
// Models carry a friendly label so the operator picks from a list and never has
// to know/type a model ID; only "custom" falls back to a free-text field.
type Model = { id: string; label: string }
const PRESETS: { id: string; label: string; provider: Provider; base_url: string; models: Model[] }[] = [
  { id: 'anthropic', label: 'Anthropic (Claude)', provider: 'anthropic', base_url: '', models: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — متعادل (پیشنهادی)' },
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — قوی‌ترین (گران)' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — سریع و ارزان' },
  ] },
  { id: 'openai', label: 'OpenAI', provider: 'openai_compatible', base_url: 'https://api.openai.com/v1', models: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini — ارزان' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ] },
  { id: 'deepseek', label: 'DeepSeek (چین)', provider: 'openai_compatible', base_url: 'https://api.deepseek.com', models: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
  ] },
  { id: 'moonshot', label: 'Moonshot / Kimi (چین)', provider: 'openai_compatible', base_url: 'https://api.moonshot.cn/v1', models: [
    { id: 'kimi-k2-0711-preview', label: 'Kimi K2' },
    { id: 'moonshot-v1-32k', label: 'Moonshot v1 (32k)' },
    { id: 'moonshot-v1-8k', label: 'Moonshot v1 (8k)' },
  ] },
  { id: 'qwen', label: 'Qwen / DashScope (چین)', provider: 'openai_compatible', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: [
    { id: 'qwen-plus', label: 'Qwen Plus' },
    { id: 'qwen-max', label: 'Qwen Max — قوی‌تر' },
    { id: 'qwen-turbo', label: 'Qwen Turbo — ارزان' },
  ] },
  { id: 'zhipu', label: 'Zhipu / GLM (چین)', provider: 'openai_compatible', base_url: 'https://open.bigmodel.cn/api/paas/v4', models: [
    { id: 'glm-4-plus', label: 'GLM-4 Plus' },
    { id: 'glm-4', label: 'GLM-4' },
  ] },
  { id: 'openrouter', label: 'OpenRouter', provider: 'openai_compatible', base_url: 'https://openrouter.ai/api/v1', models: [
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  ] },
  { id: 'groq', label: 'Groq', provider: 'openai_compatible', base_url: 'https://api.groq.com/openai/v1', models: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  ] },
  { id: 'mistral', label: 'Mistral', provider: 'openai_compatible', base_url: 'https://api.mistral.ai/v1', models: [
    { id: 'mistral-large-latest', label: 'Mistral Large' },
  ] },
  { id: 'custom', label: 'سفارشی (OpenAI-compatible)', provider: 'openai_compatible', base_url: '', models: [] },
]

function presetFor(s: Settings): string {
  if (s.provider === 'anthropic') return 'anthropic'
  const hit = PRESETS.find(p => p.base_url && p.base_url === s.base_url)
  return hit?.id ?? 'custom'
}

export default function AiSettingsPage() {
  const [s, setS] = useState<Settings | null>(null)
  const [keySet, setKeySet] = useState(false)
  const [preset, setPreset] = useState('anthropic')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.get<{ settings: Settings; key_set: boolean }>('/api/admin/ai-settings')
    if (r.data?.settings) { setS(r.data.settings); setKeySet(r.data.key_set); setPreset(presetFor(r.data.settings)) }
  }, [])
  useEffect(() => { load() }, [load])

  if (!s) return <Spinner />

  const activePreset = PRESETS.find(p => p.id === preset)!

  function choosePreset(id: string) {
    const p = PRESETS.find(x => x.id === id)!
    setPreset(id)
    setS(prev => prev && ({
      ...prev,
      provider: p.provider,
      base_url: p.provider === 'anthropic' ? null : (p.base_url || prev.base_url || ''),
      model: p.models[0]?.id ?? prev.model,
    }))
  }

  async function save() {
    if (!s) return
    setSaving(true); setMsg(null); setErr(null)
    const r = await api.patch<{ ok: boolean }>('/api/admin/ai-settings', {
      provider: s.provider,
      model: s.model.trim(),
      base_url: s.provider === 'openai_compatible' ? (s.base_url || '').trim() : null,
      max_tokens: s.max_tokens,
    })
    setSaving(false)
    if (r.error) { setErr(r.error); return }
    setMsg('ذخیره شد ✅'); load()
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-800">هوش مصنوعی</h2>
        <p className="text-sm text-slate-500 mt-0.5">ارائه‌دهنده و مدلِ ساختِ داستان‌های شخصی‌سازی‌شده</p>
      </div>

      <KillSwitchCard />

      {/* Key status */}
      <div className={`rounded-xl border px-4 py-3 text-sm ${keySet ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {keySet
          ? '✓ کلید AI_API_KEY تنظیم شده است.'
          : '⚠ کلید AI_API_KEY تنظیم نشده — تا زمانی که در ACM مقدارش را اضافه نکنید، ساخت داستان کار نمی‌کند.'}
        <span className="block text-xs opacity-80 mt-1">یک کلید واحد برای ارائه‌دهنده‌ی انتخابی؛ هنگام تغییر ارائه‌دهنده، مقدار AI_API_KEY را در ACM به کلید همان شرکت تغییر دهید.</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Field label="ارائه‌دهنده">
          <Select value={preset} onChange={e => choosePreset(e.target.value)}>
            {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>

        <Field label="مدل" hint={activePreset.models.length ? 'یکی از مدل‌های این ارائه‌دهنده را انتخاب کنید' : 'نام دقیق مدل را وارد کنید'}>
          {activePreset.models.length > 0 ? (
            <Select value={s.model} onChange={e => setS({ ...s, model: e.target.value })} dir="ltr">
              {/* keep the saved model visible even if it isn't in our list */}
              {!activePreset.models.some(m => m.id === s.model) && (
                <option value={s.model}>{s.model} (فعلی)</option>
              )}
              {activePreset.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
          ) : (
            <Input
              value={s.model}
              onChange={e => setS({ ...s, model: e.target.value })}
              placeholder="model-id"
              dir="ltr"
            />
          )}
        </Field>

        {s.provider === 'openai_compatible' && (
          <Field label="Base URL" hint="نقطه‌ی پایانی سازگار با OpenAI">
            <Input
              value={s.base_url ?? ''}
              onChange={e => setS({ ...s, base_url: e.target.value })}
              placeholder="https://api.deepseek.com"
              dir="ltr"
            />
          </Field>
        )}

        <Field label="حداکثر توکن خروجی">
          <Input
            type="number" min={256} max={32000} dir="ltr"
            value={s.max_tokens}
            onChange={e => setS({ ...s, max_tokens: parseInt(e.target.value) || 0 })}
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={saving}>
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
          {msg && <span className="text-sm text-green-600">{msg}</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {/* Prompts — read-only for now */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">پرامپت‌ها</h3>
          <Badge tone="gray">فعلاً فقط نمایش</Badge>
        </div>
        <Field label="System prompt">
          <textarea
            readOnly value={s.system_prompt} dir="ltr" rows={5}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono"
          />
        </Field>
        <Field label="User prompt template" hint="جای‌گیرها: {{name}} {{birth}} {{level}} {{theme}} {{pageGuide}} {{vocab}}">
          <textarea
            readOnly value={s.user_prompt_template} dir="ltr" rows={6}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono"
          />
        </Field>
        <p className="text-xs text-slate-400">ویرایش پرامپت‌ها به‌زودی اضافه می‌شود.</p>
      </div>

      <TtsCard />
    </div>
  )
}

// ── Kill switch ───────────────────────────────────────────
// Self-contained on purpose: loads + flips ONLY ai_enabled via the dedicated
// endpoint, so it works reliably in an incident and never rides along unsaved
// edits from the settings form above.
function KillSwitchCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.get<{ settings: { ai_enabled: boolean } | null }>('/api/admin/ai-settings')
    if (r.data?.settings) setEnabled(r.data.settings.ai_enabled)
  }, [])
  useEffect(() => { load() }, [load])

  if (enabled === null) return null

  async function toggle() {
    const confirmMsg = enabled
      ? 'هوش مصنوعی برای همه‌ی بچه‌ها خاموش شود؟ گفت‌وگوی شخصیت‌ها به جمله‌های آماده برمی‌گردد و ساخت/ترجمه‌ی داستان با هوش مصنوعی موقتاً متوقف می‌شود.'
      : 'هوش مصنوعی دوباره روشن شود؟'
    if (!window.confirm(confirmMsg)) return
    setBusy(true); setErr(null)
    const r = await api.patch<{ ok: boolean; ai_enabled: boolean }>('/api/admin/ai-settings/enabled', { ai_enabled: !enabled })
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    setEnabled(r.data?.ai_enabled ?? !enabled)
  }

  return (
    <div className={`rounded-2xl border p-5 ${enabled ? 'bg-white border-slate-200' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">کلید اضطراری هوش مصنوعی</h3>
            <Badge tone={enabled ? 'green' : 'red'}>{enabled ? 'روشن' : 'خاموش'}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {enabled
              ? 'همه‌ی بخش‌های هوش مصنوعی فعال‌اند. اگر پاسخ نامناسبی دیدید، همین‌جا فوراً خاموش کنید — بدون نیاز به استقرار.'
              : 'هوش مصنوعی خاموش است: گفت‌وگوها با جمله‌های آماده پاسخ داده می‌شوند و ساخت/ترجمه‌ی داستان با هوش مصنوعی متوقف است.'}
          </p>
          {err && <p className="text-sm text-red-600 mt-1">{err}</p>}
        </div>
        <Button variant={enabled ? 'danger' : 'primary'} onClick={toggle} disabled={busy}>
          {busy ? '...' : enabled ? 'خاموش کن' : 'روشن کن'}
        </Button>
      </div>
    </div>
  )
}

// ── Story audio (TTS) ─────────────────────────────────────
interface Tts {
  enabled: boolean
  provider: 'openai' | 'google' | 'azure' | 'elevenlabs'
  base_url: string | null
  model: string
  voice: string
  language: string
  region: string | null
  format: string
}

const TTS_PROVIDERS: { id: Tts['provider']; label: string; voices: string[]; models: string[]; needs: ('voice' | 'model' | 'base_url' | 'region')[] }[] = [
  { id: 'openai',     label: 'OpenAI TTS',                 voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], models: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'], needs: ['voice', 'model', 'base_url'] },
  { id: 'google',     label: 'Google Cloud TTS (fa-IR بومی)', voices: ['fa-IR-Standard-A', 'fa-IR-Standard-B', 'fa-IR-Standard-C', 'fa-IR-Standard-D', 'fa-IR-Wavenet-A'], models: [], needs: ['voice'] },
  { id: 'azure',      label: 'Azure Speech (fa-IR بومی)',  voices: ['fa-IR-DilaraNeural', 'fa-IR-FaridNeural'], models: [], needs: ['voice', 'region'] },
  // Persian works only on the eleven_v3 model family.
  { id: 'elevenlabs', label: 'ElevenLabs',                 voices: [], models: ['eleven_v3'], needs: ['model'] },
]

function TtsCard() {
  const [t, setT] = useState<Tts | null>(null)
  const [keySet, setKeySet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await api.get<{ tts: Tts; tts_key_set: boolean }>('/api/admin/ai-settings')
    if (r.data?.tts) { setT(r.data.tts); setKeySet(r.data.tts_key_set) }
  }, [])
  useEffect(() => { load() }, [load])

  if (!t) return null
  const p = TTS_PROVIDERS.find(x => x.id === t.provider)!

  function choose(id: Tts['provider']) {
    const np = TTS_PROVIDERS.find(x => x.id === id)!
    setT(prev => prev && ({ ...prev, provider: id, voice: np.voices[0] ?? '', model: np.models[0] ?? prev.model }))
  }

  async function save() {
    if (!t) return
    setSaving(true); setMsg(null); setErr(null)
    const r = await api.patch<{ ok: boolean }>('/api/admin/tts-settings', {
      enabled: t.enabled, provider: t.provider, base_url: t.base_url || null,
      model: t.model, voice: t.voice, language: t.language, region: t.region || null,
      format: t.format,
    })
    setSaving(false)
    if (r.error) { setErr(r.error); return }
    setMsg('ذخیره شد ✅'); load()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800">صدای داستان‌ها (TTS)</h3>
        <Badge tone={t.enabled ? 'green' : 'gray'}>{t.enabled ? 'صدای ابری فعال' : 'صدای ابری خاموش'}</Badge>
      </div>
      <p className="text-sm text-slate-500">
        انتخاب موتور و صدای هر بخش (داستان، حروف، کلمات، صداکشی) به بخش{' '}
        <a href="/dashboard/audio" className="text-amber-600 font-semibold hover:underline">«صداها»</a>{' '}
        منتقل شده است. اینجا فقط تنظیمات ارائه‌دهنده‌ی ابری (کلید، ریجن، مدل) و فعال‌سازی کلیِ آن است. صدا برای همه‌ی حساب‌ها یکسان است.</p>

      <div className={`rounded-xl border px-4 py-2.5 text-sm ${keySet ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
        {keySet ? '✓ کلید TTS_API_KEY تنظیم شده است.' : '⚠ کلید TTS_API_KEY در ACM تنظیم نشده — تا آن زمان صدای تولیدی ساخته نمی‌شود و اپ با صدای مرورگر می‌خواند.'}
      </div>

      <Toggle checked={t.enabled} onChange={v => setT({ ...t, enabled: v })} label="فعال‌سازی صدای ابری" />

      <Field label="ارائه‌دهنده‌ی صدای ابری">
        <Select value={t.provider} onChange={e => choose(e.target.value as Tts['provider'])}>
          {TTS_PROVIDERS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </Select>
      </Field>

      {p.needs.includes('model') && (
        <Field label="مدل">
          <Input list="tts-models" value={t.model} onChange={e => setT({ ...t, model: e.target.value })} dir="ltr" />
          <datalist id="tts-models">{p.models.map(m => <option key={m} value={m} />)}</datalist>
        </Field>
      )}
      {p.needs.includes('region') && (
        <Field label="Region (Azure)">
          <Input value={t.region ?? ''} onChange={e => setT({ ...t, region: e.target.value })} placeholder="westeurope" dir="ltr" />
        </Field>
      )}
      {p.needs.includes('base_url') && (
        <Field label="Base URL" hint="اختیاری — برای نقطه‌ی پایانی سازگار با OpenAI">
          <Input value={t.base_url ?? ''} onChange={e => setT({ ...t, base_url: e.target.value })} placeholder="https://api.openai.com/v1" dir="ltr" />
        </Field>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</Button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}
