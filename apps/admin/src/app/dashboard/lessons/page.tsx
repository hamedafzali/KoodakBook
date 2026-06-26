'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/ui'
import type { Lesson, Word, Letter } from '@koodakbook/shared'
import { LESSON_TYPE_EMOJI } from '@koodakbook/shared'

type LessonItem = { id: string; item_type: 'word' | 'letter'; order_index: number; word?: Word; letter?: Letter }

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [selected, setSelected] = useState<Lesson | null>(null)
  const [items, setItems] = useState<LessonItem[]>([])
  const [words, setWords] = useState<Word[]>([])
  const [letters, setLetters] = useState<Letter[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Lesson[]>('/api/admin/lessons'),
      api.get<Word[]>('/api/admin/words'),
      api.get<Letter[]>('/api/letters'),
    ]).then(([l, w, lt]) => {
      if (l.data) setLessons(l.data)
      if (w.data) setWords(w.data)
      if (lt.data) setLetters(lt.data)
    })
  }, [])

  async function selectLesson(lesson: Lesson) {
    setSelected(lesson)
    setSearch('')
    const res = await api.get<LessonItem[]>(`/api/admin/lessons/${lesson.id}/items`)
    if (res.data) setItems(res.data)
  }

  async function addWord(word: Word) {
    if (!selected) return
    if (items.some(i => i.word?.id === word.id)) return
    const res = await api.post<LessonItem>(`/api/admin/lessons/${selected.id}/items`, { word_id: word.id })
    if (res.data) setItems(i => [...i, res.data!])
  }

  async function addLetter(letter: Letter) {
    if (!selected) return
    if (items.some(i => i.letter?.id === letter.id)) return
    const res = await api.post<LessonItem>(`/api/admin/lessons/${selected.id}/items`, { letter_id: letter.id })
    if (res.data) setItems(i => [...i, res.data!])
  }

  async function removeItem(id: string) {
    if (!selected) return
    await api.delete(`/api/admin/lessons/${selected.id}/items/${id}`)
    setItems(i => i.filter(item => item.id !== id))
  }

  async function moveItem(id: string, direction: 'up' | 'down') {
    const idx = items.findIndex(i => i.id === id)
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === items.length - 1)) return

    const newItems = [...items]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newItems[idx], newItems[swapIdx]] = [newItems[swapIdx], newItems[idx]]
    const reordered = newItems.map((item, i) => ({ ...item, order_index: i + 1 }))
    setItems(reordered)

    await api.patch(`/api/admin/lessons/${selected!.id}/items/reorder`, {
      order: reordered.map(({ id, order_index }) => ({ id, order_index }))
    })
  }

  const isVocab = selected?.type === 'vocabulary'
  const itemWordIds = new Set(items.map(i => i.word?.id).filter(Boolean))
  const itemLetterIds = new Set(items.map(i => i.letter?.id).filter(Boolean))

  const filteredWords = words.filter(w =>
    !itemWordIds.has(w.id) &&
    (search === '' || w.persian.includes(search) || w.english.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredLetters = letters.filter(l =>
    !itemLetterIds.has(l.id) &&
    (search === '' || l.character.includes(search) || l.name_english.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <PageHeader title="مدیریت محتوای درس‌ها" subtitle="تخصیص کلمه/حرف به هر درس" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lesson list */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-600 mb-2">درس‌ها</h3>
          {lessons.map(l => (
            <button key={l.id} onClick={() => selectLesson(l)}
              className={`w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-sm ${
                selected?.id === l.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-200'
              }`}>
              <span>{LESSON_TYPE_EMOJI[l.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{l.title}</p>
                <p className="text-xs text-gray-400">مرحله {l.stage}</p>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <>
            {/* Current items */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-600">محتوای «{selected.title}» ({items.length})</h3>
              {items.length === 0 && <p className="text-gray-400 text-sm text-center py-4">خالی — از ستون کناری اضافه کنید</p>}
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                    <div className="flex-1">
                      {item.word && (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{item.word.persian}</span>
                          <span className="text-xs text-gray-400 ltr">{item.word.english}</span>
                        </div>
                      )}
                      {item.letter && (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{item.letter.character}</span>
                          <span className="text-xs text-gray-500">{item.letter.name_persian}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveItem(item.id, 'up')} disabled={idx === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▲</button>
                      <button onClick={() => moveItem(item.id, 'down')} disabled={idx === items.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none">▼</button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add items */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-600">افزودن {isVocab ? 'کلمه' : 'حرف'}</h3>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="جستجو..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {isVocab ? filteredWords.map(w => (
                  <button key={w.id} onClick={() => addWord(w)}
                    className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-amber-50 transition">
                    {w.image_url && <img src={w.image_url} className="w-8 h-8 object-contain rounded" alt="" />}
                    <span className="font-medium text-gray-800">{w.persian}</span>
                    <span className="text-xs text-gray-400 ltr mr-auto">{w.english}</span>
                    <span className="text-amber-500 text-lg">+</span>
                  </button>
                )) : filteredLetters.map(l => (
                  <button key={l.id} onClick={() => addLetter(l)}
                    className="w-full text-right flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-amber-50 transition">
                    <span className="text-2xl font-bold w-8 text-center">{l.character}</span>
                    <span className="text-sm text-gray-700">{l.name_persian}</span>
                    <span className="text-xs text-gray-400 ltr mr-auto">{l.name_english}</span>
                    <span className="text-amber-500 text-lg">+</span>
                  </button>
                ))}
                {isVocab && filteredWords.length === 0 && <p className="text-gray-400 text-sm text-center py-4">کلمه‌ای یافت نشد</p>}
                {!isVocab && filteredLetters.length === 0 && <p className="text-gray-400 text-sm text-center py-4">حرفی یافت نشد</p>}
              </div>
            </div>
          </>
        ) : (
          <div className="md:col-span-2 flex items-center justify-center text-gray-400 text-sm bg-white rounded-2xl shadow-sm p-8">
            یک درس از ستون چپ انتخاب کنید
          </div>
        )}
      </div>
    </div>
  )
}
