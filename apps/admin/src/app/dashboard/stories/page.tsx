'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import FileUpload from '@/components/FileUpload'
import type { Story, StoryPage } from '@koodakbook/shared'
import { PageHeader, Button, ui } from '@/components/ui'

const EMPTY_STORY = { title_persian: '', title_english: '', stage: 3, age_min: '', age_max: '', cover_url: '', audio_url: '' }
const EMPTY_PAGE = { page_number: 1, text_persian: '', text_english: '', image_url: '', audio_url: '' }

export default function AdminStoriesPage() {
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [storyForm, setStoryForm] = useState({ ...EMPTY_STORY })
  const [editingStory, setEditingStory] = useState<string | null>(null)
  const [selectedStory, setSelectedStory] = useState<Story | null>(null)
  const [pages, setPages] = useState<StoryPage[]>([])
  const [pageForm, setPageForm] = useState({ ...EMPTY_PAGE })
  const [editingPage, setEditingPage] = useState<string | null>(null)

  useEffect(() => { loadStories() }, [])

  async function loadStories() {
    const res = await api.get<Story[]>('/api/admin/stories')
    if (res.data) setStories(res.data)
  }

  async function loadPages(storyId: string) {
    const res = await api.get<StoryPage[]>(`/api/admin/stories/${storyId}/pages`)
    if (res.data) setPages(res.data)
  }

  async function handleStorySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const payload = { ...storyForm, stage: Number(storyForm.stage), age_min: storyForm.age_min ? Number(storyForm.age_min) : null, age_max: storyForm.age_max ? Number(storyForm.age_max) : null, cover_url: storyForm.cover_url || null, audio_url: storyForm.audio_url || null }
    if (editingStory) await api.patch(`/api/admin/stories/${editingStory}`, payload)
    else await api.post('/api/admin/stories', payload)
    setStoryForm({ ...EMPTY_STORY }); setEditingStory(null); loadStories()
  }

  async function handleDeleteStory(id: string) {
    if (!confirm('این داستان و تمام صفحاتش حذف شود؟')) return
    await api.delete(`/api/admin/stories/${id}`)
    if (selectedStory?.id === id) setSelectedStory(null)
    loadStories()
  }

  async function handlePageSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedStory) return
    const payload = { ...pageForm, page_number: Number(pageForm.page_number), text_english: pageForm.text_english || null, image_url: pageForm.image_url || null, audio_url: pageForm.audio_url || null }
    if (editingPage) await api.patch(`/api/admin/stories/${selectedStory.id}/pages/${editingPage}`, payload)
    else await api.post(`/api/admin/stories/${selectedStory.id}/pages`, payload)
    setPageForm({ ...EMPTY_PAGE }); setEditingPage(null); loadPages(selectedStory.id)
  }

  async function handleDeletePage(id: string) {
    if (!selectedStory || !confirm('این صفحه حذف شود؟')) return
    await api.delete(`/api/admin/stories/${selectedStory.id}/pages/${id}`)
    loadPages(selectedStory.id)
  }

  function selectStory(s: Story) {
    setSelectedStory(s)
    setPageForm({ ...EMPTY_PAGE, page_number: 1 })
    setEditingPage(null)
    loadPages(s.id)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="مدیریت داستان‌ها" subtitle="داستان‌ها و صفحاتشان" />

      {/* Story form */}
      <form onSubmit={handleStorySubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700">{editingStory ? 'ویرایش داستان' : 'داستان جدید'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">عنوان فارسی *</label>
            <input required value={storyForm.title_persian} onChange={e => setStoryForm(f => ({ ...f, title_persian: e.target.value }))}
              className={ui.input} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">English Title *</label>
            <input required value={storyForm.title_english} onChange={e => setStoryForm(f => ({ ...f, title_english: e.target.value }))}
              className={`ltr ${ui.input}`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">مرحله</label>
            <select value={storyForm.stage} onChange={e => setStoryForm(f => ({ ...f, stage: Number(e.target.value) }))}
              className={ui.input}>
              {[1,2,3,4].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">سن از</label>
            <input type="number" value={storyForm.age_min} onChange={e => setStoryForm(f => ({ ...f, age_min: e.target.value }))}
              className={`ltr ${ui.input}`} placeholder="3" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">سن تا</label>
            <input type="number" value={storyForm.age_max} onChange={e => setStoryForm(f => ({ ...f, age_max: e.target.value }))}
              className={`ltr ${ui.input}`} placeholder="8" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUpload type="images" label="تصویر جلد" currentUrl={storyForm.cover_url}
            onUploaded={url => setStoryForm(f => ({ ...f, cover_url: url }))} />
          <FileUpload type="audio" label="صدای کامل داستان" currentUrl={storyForm.audio_url}
            onUploaded={url => setStoryForm(f => ({ ...f, audio_url: url }))} />
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editingStory ? 'ذخیره' : 'ایجاد داستان'}</Button>
          {editingStory && <Button type="button" variant="secondary" onClick={() => { setEditingStory(null); setStoryForm({ ...EMPTY_STORY }) }}>انصراف</Button>}
        </div>
      </form>

      {/* Stories list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stories.map(s => (
          <div key={s.id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 cursor-pointer transition ${selectedStory?.id === s.id ? 'border-amber-400' : 'border-transparent hover:border-gray-200'}`}
            onClick={() => selectStory(s)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-800">{s.title_persian}</p>
                <p className="text-xs text-gray-400 ltr">{s.title_english}</p>
                <p className="text-xs text-gray-400 mt-1">مرحله {s.stage} • {s.age_min}–{s.age_max} سال</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); setEditingStory(s.id); setStoryForm({ title_persian: s.title_persian, title_english: s.title_english, stage: s.stage, age_min: String(s.age_min ?? ''), age_max: String(s.age_max ?? ''), cover_url: s.cover_url ?? '', audio_url: s.audio_url ?? '' }) }}
                  className="text-amber-600 text-xs hover:underline">ویرایش</button>
                <button onClick={e => { e.stopPropagation(); handleDeleteStory(s.id) }}
                  className="text-red-500 text-xs hover:underline">حذف</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pages editor */}
      {selectedStory && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="font-bold text-gray-700">صفحات: {selectedStory.title_persian}</h3>

          <form onSubmit={handlePageSubmit} className="space-y-4 border-b pb-5">
            <h4 className="text-sm font-medium text-gray-600">{editingPage ? 'ویرایش صفحه' : 'صفحه جدید'}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">شماره صفحه *</label>
                <input type="number" required min={1} value={pageForm.page_number} onChange={e => setPageForm(f => ({ ...f, page_number: Number(e.target.value) }))}
                  className={`ltr ${ui.input}`} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">متن فارسی *</label>
              <textarea required value={pageForm.text_persian} onChange={e => setPageForm(f => ({ ...f, text_persian: e.target.value }))} rows={2}
                className={`${ui.input} resize-none`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ترجمه انگلیسی</label>
              <textarea value={pageForm.text_english} onChange={e => setPageForm(f => ({ ...f, text_english: e.target.value }))} rows={2}
                className={`ltr ${ui.input} resize-none`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUpload type="images" label="تصویر صفحه" currentUrl={pageForm.image_url}
                onUploaded={url => setPageForm(f => ({ ...f, image_url: url }))} />
              <FileUpload type="audio" label="صدای صفحه" currentUrl={pageForm.audio_url}
                onUploaded={url => setPageForm(f => ({ ...f, audio_url: url }))} />
            </div>
            <div className="flex gap-2">
              <Button type="submit">{editingPage ? 'ذخیره' : 'افزودن صفحه'}</Button>
              {editingPage && <Button type="button" variant="secondary" onClick={() => { setEditingPage(null); setPageForm({ ...EMPTY_PAGE }) }}>انصراف</Button>}
            </div>
          </form>

          {/* Pages list */}
          <div className="space-y-3">
            {pages.map(p => (
              <div key={p.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-amber-600 bg-amber-100 rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0">{p.page_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{p.text_persian}</p>
                  {p.text_english && <p className="text-xs text-gray-400 ltr mt-0.5">{p.text_english}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    {p.audio_url && <span>🔊 صدا</span>}
                    {p.image_url && <span>🖼 تصویر</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditingPage(p.id); setPageForm({ page_number: p.page_number, text_persian: p.text_persian, text_english: p.text_english ?? '', image_url: p.image_url ?? '', audio_url: p.audio_url ?? '' }) }}
                    className="text-amber-600 text-xs hover:underline">ویرایش</button>
                  <button onClick={() => handleDeletePage(p.id)} className="text-red-500 text-xs hover:underline">حذف</button>
                </div>
              </div>
            ))}
            {pages.length === 0 && <p className="text-center text-gray-400 text-sm py-4">صفحه‌ای اضافه نشده</p>}
          </div>
        </div>
      )}
    </div>
  )
}
