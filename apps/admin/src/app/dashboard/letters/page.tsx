'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { Letter } from '@koodakbook/shared'

const GROUP_COLORS: Record<number, string> = {
  1:'bg-red-50 border-red-200', 2:'bg-orange-50 border-orange-200', 3:'bg-yellow-50 border-yellow-200',
  4:'bg-green-50 border-green-200', 5:'bg-teal-50 border-teal-200', 6:'bg-blue-50 border-blue-200',
  7:'bg-indigo-50 border-indigo-200', 8:'bg-purple-50 border-purple-200',
}

export default function AdminLettersPage() {
  const [letters, setLetters] = useState<Letter[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState('')

  useEffect(() => {
    api.get<Letter[]>('/api/letters').then(r => { if (r.data) setLetters(r.data) })
  }, [])

  async function saveAudio(id: string) {
    await api.patch(`/api/admin/letters/${id}`, { audio_url: audioUrl || null })
    setEditing(null)
    setAudioUrl('')
    const res = await api.get<Letter[]>('/api/letters')
    if (res.data) setLetters(res.data)
  }

  const grouped = letters.reduce<Record<number, Letter[]>>((acc, l) => {
    acc[l.group] = [...(acc[l.group] ?? []), l]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">مدیریت حروف الفبا</h2>
      <p className="text-sm text-gray-500">برای هر حرف می‌توانید فایل صوتی آپلود کنید.</p>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className={`rounded-2xl border p-4 ${GROUP_COLORS[Number(group)] ?? 'bg-gray-50 border-gray-200'}`}>
          <h3 className="font-bold text-gray-700 mb-3">گروه {group}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map(l => (
              <div key={l.id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="text-center mb-2">
                  <span className="text-4xl font-bold">{l.character}</span>
                  <p className="text-xs text-gray-500 mt-1">{l.name_persian} / {l.name_english}</p>
                </div>
                {editing === l.id ? (
                  <div className="space-y-2">
                    <FileUpload type="audio" onUploaded={url => setAudioUrl(url)} currentUrl={l.audio_url} />
                    <div className="flex gap-1">
                      <button onClick={() => saveAudio(l.id)} className="flex-1 bg-amber-500 text-white text-xs py-1.5 rounded-lg">ذخیره</button>
                      <button onClick={() => setEditing(null)} className="flex-1 bg-gray-100 text-gray-600 text-xs py-1.5 rounded-lg">انصراف</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    {l.audio_url
                      ? <span className="text-xs text-green-600">🔊 صدا دارد</span>
                      : <span className="text-xs text-gray-400">بدون صدا</span>
                    }
                    <button onClick={() => { setEditing(l.id); setAudioUrl(l.audio_url ?? '') }}
                      className="block w-full mt-2 text-xs text-amber-600 hover:underline">
                      {l.audio_url ? 'تغییر صدا' : 'افزودن صدا'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
