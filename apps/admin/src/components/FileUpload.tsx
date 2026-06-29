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
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setPreview(currentUrl ?? null) }, [currentUrl])

  async function uploadFile(file: Blob, filename: string) {
    setUploading(true); setErr(null)
    const form = new FormData()
    form.append('file', file, filename)
    try {
      const res = await fetch(`/api/admin/upload/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json()
      if (data.data?.url) { setPreview(data.data.url); onUploaded(data.data.url) }
      else setErr(data.error || 'آپلود ناموفق بود')
    } catch {
      setErr('آپلود ناموفق بود')
    }
    setUploading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file, file.name)
  }

  async function startRecording() {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const raw = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        try {
          const wav = await processToWav(raw)   // trim silence + normalize → wav
          await uploadFile(wav, 'recording.wav')
        } catch {
          await uploadFile(raw, 'recording.webm')   // fallback: raw
        }
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch {
      setErr('دسترسی به میکروفون ممکن نشد')
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-2 flex-wrap">
        {type === 'audio' && (
          recording ? (
            <button type="button" onClick={stopRecording}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium animate-pulse">
              ⏹ توقف ضبط
            </button>
          ) : (
            <button type="button" onClick={startRecording} disabled={uploading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              🎙️ ضبط صدا
            </button>
          )
        )}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || recording}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition disabled:opacity-50">
          {uploading ? 'در حال آپلود...' : '📎 آپلود فایل'}
        </button>
        {preview && type === 'audio' && <audio controls src={preview} className="h-8 ltr" />}
        {preview && type === 'images' && <img src={preview} className="h-12 w-12 object-cover rounded-lg" alt="" />}
        {preview && !['audio', 'images'].includes(type) && <span className="text-xs text-green-600">✓ آپلود شد</span>}
      </div>
      {type === 'audio' && <p className="text-xs text-gray-400">ضبط مستقیم با میکروفون یا آپلود فایل. صدای ضبط‌شده خودکار اصلاح می‌شود (حذف سکوت و یکسان‌سازی صدا).</p>}
      {err && <p className="text-xs text-red-500">{err}</p>}
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange}
        accept={
          type === 'audio'  ? '.mp3,.wav,.ogg,.m4a' :
          type === 'images' ? '.jpg,.jpeg,.png,.webp,.gif' :
          '.pdf'
        } />
    </div>
  )
}

// ── Browser-side cleanup: decode → mono → trim silence → normalize → WAV ──
async function processToWav(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer()
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
  const ctx = new AC()
  const audio = await ctx.decodeAudioData(arrayBuf)
  const len = audio.length
  const mono = new Float32Array(len)
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c)
    for (let i = 0; i < len; i++) mono[i] += d[i] / audio.numberOfChannels
  }
  // trim leading/trailing silence (with a little padding)
  const thr = 0.01
  let start = 0, end = len - 1
  while (start < len && Math.abs(mono[start]) < thr) start++
  while (end > start && Math.abs(mono[end]) < thr) end--
  const pad = Math.floor(audio.sampleRate * 0.06)
  start = Math.max(0, start - pad); end = Math.min(len - 1, end + pad)
  const cut = mono.subarray(start, end + 1)
  // normalize peak to ~0.95
  let peak = 0
  for (let i = 0; i < cut.length; i++) peak = Math.max(peak, Math.abs(cut[i]))
  const gain = peak > 0 ? 0.95 / peak : 1
  for (let i = 0; i < cut.length; i++) cut[i] *= gain
  ctx.close()
  return encodeWav(cut, audio.sampleRate)
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
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2
  }
  return new Blob([view], { type: 'audio/wav' })
}
