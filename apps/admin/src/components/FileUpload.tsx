'use client'
import { useRef, useState, useEffect } from 'react'
import { getToken } from '@/lib/auth'

interface Props {
  type: 'audio' | 'images' | 'pdfs'
  onUploaded: (url: string) => void
  label?: string
  currentUrl?: string | null
}

export default function FileUpload({ type, onUploaded, label, currentUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const editBufRef = useRef<AudioBuffer | null>(null)   // captured clip awaiting edit/save
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [editing, setEditing] = useState(false)
  const [pitch, setPitch] = useState(1)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)   // edited preview
  const [saved, setSaved] = useState<string | null>(currentUrl ?? null) // last saved
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setSaved(currentUrl ?? null) }, [currentUrl])

  async function uploadBlob(blob: Blob, filename: string) {
    setUploading(true); setErr(null)
    const form = new FormData()
    form.append('file', blob, filename)
    try {
      const res = await fetch(`/api/admin/upload/${type}`, {
        method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form,
      })
      const data = await res.json()
      if (data.data?.url) { setSaved(data.data.url); onUploaded(data.data.url) }
      else setErr(data.error || 'آپلود ناموفق بود')
    } catch { setErr('آپلود ناموفق بود') }
    setUploading(false)
  }

  // Decode any captured audio into an editable buffer and open the editor.
  async function openEditor(blob: Blob) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      const ctx = new AC()
      editBufRef.current = await ctx.decodeAudioData(await blob.arrayBuffer())
      ctx.close()
      setPitch(1); setEditing(true)
      refreshPreview(1)
    } catch {
      // couldn't decode (e.g. exotic format) — just upload the raw file
      await uploadBlob(blob, 'audio')
    }
  }

  async function refreshPreview(p: number) {
    if (!editBufRef.current) return
    const blob = await processToWav(editBufRef.current, p)
    setPreviewUrl(u => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(blob) })
  }

  async function saveEdited() {
    if (!editBufRef.current) return
    const blob = await processToWav(editBufRef.current, pitch)
    await uploadBlob(blob, 'recording.wav')
    closeEditor()
  }

  function closeEditor() {
    setEditing(false); editBufRef.current = null
    setPreviewUrl(u => { if (u) URL.revokeObjectURL(u); return null })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (type === 'audio') openEditor(file)
    else uploadBlob(file, file.name)
  }

  async function startRecording() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        openEditor(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }))
      }
      rec.start(); recorderRef.current = rec; setRecording(true)
    } catch { setErr('دسترسی به میکروفون ممکن نشد') }
  }
  function stopRecording() { recorderRef.current?.stop(); setRecording(false) }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-2 flex-wrap">
        {type === 'audio' && !editing && (
          recording
            ? <button type="button" onClick={stopRecording} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium animate-pulse">⏹ توقف ضبط</button>
            : <button type="button" onClick={startRecording} disabled={uploading} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">🎙️ ضبط صدا</button>
        )}
        {!editing && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || recording} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {uploading ? 'در حال آپلود...' : '📎 آپلود فایل'}
          </button>
        )}
        {!editing && saved && type === 'audio' && <audio controls src={saved} className="h-8 ltr" />}
        {!editing && saved && type === 'images' && <img src={saved} className="h-12 w-12 object-cover rounded-lg" alt="" />}
        {!editing && saved && !['audio', 'images'].includes(type) && <span className="text-xs text-green-600">✓ آپلود شد</span>}
      </div>

      {/* Editor — pitch/voice tuning + preview before saving */}
      {editing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-amber-800">تنظیم صدا</span>
            <span className="text-xs text-amber-700">{pitch === 1 ? 'طبیعی' : pitch > 1 ? `نازک‌تر (${pitch.toFixed(2)}×)` : `بم‌تر (${pitch.toFixed(2)}×)`}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">بم‌تر</span>
            <input type="range" min={0.8} max={1.4} step={0.02} value={pitch}
              onChange={e => { const p = parseFloat(e.target.value); setPitch(p); refreshPreview(p) }}
              className="flex-1" />
            <span className="text-xs text-gray-500">نازک‌تر/کودکانه</span>
          </div>
          {previewUrl && <audio controls src={previewUrl} className="h-8 w-full ltr" />}
          <p className="text-[11px] text-gray-500">صدای ضبط‌شده خودکار اصلاح می‌شود (حذف سکوت + یکسان‌سازی). با لغزنده می‌توانید صدا را نازک‌تر (کودکانه/زنانه) یا بم‌تر کنید.</p>
          <div className="flex gap-2">
            <button type="button" onClick={saveEdited} disabled={uploading} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {uploading ? 'در حال ذخیره...' : '💾 ذخیره'}
            </button>
            <button type="button" onClick={closeEditor} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">✖ لغو</button>
          </div>
        </div>
      )}

      {err && <p className="text-xs text-red-500">{err}</p>}
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange}
        accept={type === 'audio' ? '.mp3,.wav,.ogg,.m4a' : type === 'images' ? '.jpg,.jpeg,.png,.webp,.gif' : '.pdf'} />
    </div>
  )
}

// ── Cleanup + optional pitch shift → WAV (mono) ──
async function processToWav(audio: AudioBuffer, pitch: number): Promise<Blob> {
  const len = audio.length
  let mono: Float32Array = new Float32Array(len)
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c)
    for (let i = 0; i < len; i++) mono[i] += d[i] / audio.numberOfChannels
  }
  // trim silence (+padding)
  const thr = 0.01
  let start = 0, end = len - 1
  while (start < len && Math.abs(mono[start]) < thr) start++
  while (end > start && Math.abs(mono[end]) < thr) end--
  const pad = Math.floor(audio.sampleRate * 0.06)
  start = Math.max(0, start - pad); end = Math.min(len - 1, end + pad)
  mono = mono.slice(start, end + 1)
  // normalize
  let peak = 0
  for (let i = 0; i < mono.length; i++) peak = Math.max(peak, Math.abs(mono[i]))
  const gain = peak > 0 ? 0.95 / peak : 1
  for (let i = 0; i < mono.length; i++) mono[i] *= gain
  // pitch shift via resample (changes pitch; for short clips the slight tempo change is fine)
  if (pitch !== 1) mono = await resample(mono, audio.sampleRate, pitch)
  return encodeWav(mono, audio.sampleRate)
}

async function resample(mono: Float32Array, sampleRate: number, ratio: number): Promise<Float32Array> {
  const AC = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext)
  const srcBuf = new AudioBuffer({ length: mono.length, sampleRate, numberOfChannels: 1 })
  srcBuf.copyToChannel(new Float32Array(mono), 0)
  const off = new AC(1, Math.max(1, Math.floor(mono.length / ratio)), sampleRate)
  const node = off.createBufferSource()
  node.buffer = srcBuf
  node.playbackRate.value = ratio
  node.connect(off.destination)
  node.start()
  const rendered = await off.startRendering()
  return new Float32Array(rendered.getChannelData(0))
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buf)
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2 }
  return new Blob([view], { type: 'audio/wav' })
}
