'use client'
import { useRef, useState, useEffect } from 'react'
import { getToken } from '@/lib/auth'

interface Props {
  type: 'audio' | 'images' | 'pdfs'
  onUploaded: (url: string) => void
  label?: string
  currentUrl?: string | null
}

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'

export default function FileUpload({ type, onUploaded, label, currentUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)

  useEffect(() => { setPreview(currentUrl ?? null) }, [currentUrl])

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`${BASE}/api/admin/upload/${type}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    })
    const data = await res.json()
    if (data.data?.url) {
      setPreview(data.data.url)
      onUploaded(data.data.url)
    }
    setUploading(false)
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition">
          {uploading ? 'در حال آپلود...' : '📎 انتخاب فایل'}
        </button>
        {preview && type === 'audio' && (
          <audio controls src={preview.startsWith('http') ? preview : `${BASE}${preview}`} className="h-8 ltr" />
        )}
        {preview && type === 'images' && (
          <img src={preview.startsWith('http') ? preview : `${BASE}${preview}`} className="h-12 w-12 object-cover rounded-lg" alt="" />
        )}
        {preview && !['audio','images'].includes(type) && (
          <span className="text-xs text-green-600">✓ آپلود شد</span>
        )}
      </div>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange}
        accept={
          type === 'audio'  ? '.mp3,.wav,.ogg,.m4a' :
          type === 'images' ? '.jpg,.jpeg,.png,.webp,.gif' :
          '.pdf'
        } />
    </div>
  )
}
