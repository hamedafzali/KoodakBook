'use client'
// Per-emotion parameter editor. For a character, tune any emotion's pose
// channels (squint / eye-widen / resting mouth / brow / gaze) with live
// preview, and hand the sparse override map back up to be saved into the
// character's `animation.emotions` JSON. The web app renders characters with
// these values, so tuning here changes how the real app emotes.
import { useMemo, useState } from 'react'
import { CharacterActor } from 'pixel-wizards-charachters/react'
import { CHARACTERS, EMOTIONS, EMOTION_LABELS } from 'pixel-wizards-charachters'
import type { EmotionName, EmotionOverrides, EmotionSpec } from 'pixel-wizards-charachters'

const EMOTION_ORDER: EmotionName[] = [
  'neutral', 'happy', 'excited', 'thinking', 'encouraging', 'sad', 'surprised', 'sleepy', 'love',
  'confused', 'proud', 'shy',
]

const MOUTHS: { id: EmotionSpec['mouth']; label: string }[] = [
  { id: 'soft', label: 'نرم' },
  { id: 'big', label: 'لبخند بزرگ' },
  { id: 'frown', label: 'اخم' },
  { id: 'o', label: 'گرد (اوه)' },
]

const BROWS: { id: EmotionSpec['brow']; label: string }[] = [
  { id: 'idle', label: 'عادی' },
  { id: 'happy', label: 'خوشحال' },
  { id: 'excited', label: 'هیجان' },
  { id: 'thinking', label: 'متفکر' },
  { id: 'encouraging', label: 'تشویق' },
  { id: 'sad', label: 'غمگین' },
  { id: 'surprised', label: 'متعجب' },
  { id: 'sleepy', label: 'خواب‌آلود' },
  { id: 'confused', label: 'گیج' },
  { id: 'proud', label: 'سربلند' },
  { id: 'shy', label: 'خجالتی' },
]

interface Props {
  slug: string
  value: EmotionOverrides
  onChange: (next: EmotionOverrides) => void
}

export default function EmotionEditor({ slug, value, onChange }: Props) {
  const [sel, setSel] = useState<EmotionName>('happy')
  const character = slug in CHARACTERS ? slug : 'simorgh'

  // Effective spec for the selected emotion = preset + saved overrides.
  const base = EMOTIONS[sel]
  const over = value[sel] ?? {}
  const eff: EmotionSpec = { ...base, ...over }

  // Preview frame — full intensity so the tuned channels read at their strongest.
  const frame = useMemo(() => ({ emotion: sel, intensity: 1 as const }), [sel])

  // The emotion's own gaze (added to the frame gaze) — undefined on most presets.
  const baseGaze = base.gaze ?? { x: 0, y: 0 }
  const effGaze = eff.gaze ?? baseGaze

  function set<K extends keyof EmotionSpec>(field: K, v: EmotionSpec[K]) {
    onChange({ ...value, [sel]: { ...value[sel], [field]: v } })
  }
  function setGaze(axis: 'x' | 'y', v: number) {
    set('gaze', { ...effGaze, [axis]: v })
  }
  function resetEmotion() {
    const next = { ...value }
    delete next[sel]
    onChange(next)
  }
  const isTuned = (e: EmotionName) => value[e] != null && Object.keys(value[e]!).length > 0

  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">تنظیم حس‌ها</p>
        <p className="text-xs text-slate-400">هر حس را جدا تنظیم کن — همان مقادیر در اپ بچه‌ها اجرا می‌شود.</p>
      </div>

      {/* Emotion picker — a dot marks the ones that have custom values. */}
      <div className="flex flex-wrap gap-1.5">
        {EMOTION_ORDER.map(e => (
          <button key={e} type="button" onClick={() => setSel(e)}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              sel === e ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
            {EMOTION_LABELS[e]}{isTuned(e) ? ' ●' : ''}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-4">
        {/* Live preview of the selected emotion with the draft overrides. */}
        <div className="shrink-0 w-[124px] h-[124px] rounded-xl bg-white border border-slate-200 flex items-center justify-center">
          <CharacterActor character={character} size={116} blink frame={frame} emotions={value} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <Slider label="جمع‌شدن چشم (لبخند/خواب)" value={eff.squint}
            onChange={v => set('squint', v)} onReset={() => set('squint', base.squint)} def={base.squint} />
          <Slider label="گشادی چشم (تعجب/هیجان)" value={eff.wide}
            onChange={v => set('wide', v)} onReset={() => set('wide', base.wide)} def={base.wide} />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1 block">دهانِ آرام</span>
              <select value={eff.mouth} onChange={e => set('mouth', e.target.value as EmotionSpec['mouth'])}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                {MOUTHS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 mb-1 block">ابرو</span>
              <select value={eff.brow} onChange={e => set('brow', e.target.value as EmotionSpec['brow'])}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                {BROWS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
          </div>

          {/* Emotion gaze — where this feeling points the eyes (added to the frame). */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2">
            <Slider label="نگاه ← افقی →" value={effGaze.x} def={baseGaze.x} min={-1} max={1}
              onChange={v => setGaze('x', v)} onReset={() => setGaze('x', baseGaze.x)} />
            <Slider label="نگاه ↑ عمودی ↓" value={effGaze.y} def={baseGaze.y} min={-1} max={1}
              onChange={v => setGaze('y', v)} onReset={() => setGaze('y', baseGaze.y)} />
          </div>

          <button type="button" onClick={resetEmotion} disabled={!isTuned(sel)}
            className="text-xs text-slate-500 hover:text-red-500 disabled:opacity-40">
            بازگردانی «{EMOTION_LABELS[sel]}» به پیش‌فرض
          </button>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, def, onChange, onReset, min = 0, max = 1 }: {
  label: string; value: number; def: number; onChange: (v: number) => void; onReset: () => void
  min?: number; max?: number
}) {
  const changed = Math.abs(value - def) > 1e-6
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
        <span>{label}</span>
        <span className="ltr tabular-nums text-slate-400">
          {value.toFixed(2)}
          {changed && (
            <button type="button" onClick={onReset} className="ms-2 text-amber-600 hover:underline">↺</button>
          )}
        </span>
      </span>
      <input type="range" min={min} max={max} step={0.05} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-amber-500" />
    </label>
  )
}
