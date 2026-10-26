'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { PageHeader, Button, Badge, Card, Field, Input, Select, Spinner, EmptyState } from '@/components/ui'
import { Icon } from '@/components/icons'
import { bytes, fa } from '@/lib/csv'

/* Children's videos — the «ویدیوها» menu in the app and on the website
 * (backend routes/videos.ts, migration 070). Videos are grouped into
 * categories; a new video is a draft until «انتشار». All published videos
 * are free for every child. */

interface Category { id: string; slug: string; title_fa: string; emoji: string | null; order_index: number }
interface Video {
  id: string; category_id: string; title_fa: string; description_fa: string | null
  video_url: string; cover_url: string | null; duration_sec: number | null; file_bytes: number | null
  order_index: number; is_published: boolean; published_at: string | null; created_at: string
}

const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://koodakbook.eu.cc').replace(/\/+$/, '')
const dur = (s: number | null) => {
  if (!s) return ''
  const r = Math.round(s)
  return `${fa(Math.floor(r / 60))}:${fa(r % 60).padStart(2, '۰')}`
}

/* Duration of a local file, read by the browser before upload. */
function readDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    const done = (d: number | null) => { URL.revokeObjectURL(url); resolve(d) }
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 100) / 100 : null)
    v.onerror = () => done(null)
    v.src = url
  })
}

/* A JPEG of one frame of a local file, used as the cover when the admin
 * doesn't pick one, so the app's grid shows a picture (native players
 * can't cheaply draw a frame of a remote video). */
function captureFrame(file: File, at: number): Promise<Blob | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'auto'; v.muted = true; v.playsInline = true
    const done = (b: Blob | null) => { URL.revokeObjectURL(url); resolve(b) }
    v.onloadedmetadata = () => { v.currentTime = Math.max(0, Math.min(at, (v.duration || at) - 0.1)) }
    v.onseeked = () => {
      const w = Math.min(960, v.videoWidth || 960)
      const h = Math.round(w * ((v.videoHeight || 9) / (v.videoWidth || 16)))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) { done(null); return }
      ctx.drawImage(v, 0, 0, w, h)
      c.toBlob(b => done(b), 'image/jpeg', 0.85)
    }
    v.onerror = () => done(null)
    v.src = url
  })
}

const emptyForm = { category_id: '', title_fa: '', description_fa: '', video_url: '', cover_url: '', duration_sec: null as number | null, file_bytes: 0 }

export default function VideosPage() {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState<{ pct: number } | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [catForm, setCatForm] = useState({ title_fa: '', slug: '', emoji: '' })
  const [editing, setEditing] = useState<{ id: string; title_fa: string; category_id: string } | null>(null)
  const [editCat, setEditCat] = useState<{ id: string; title_fa: string; emoji: string } | null>(null)

  const load = useCallback(() => {
    api.get<{ categories: Category[]; videos: Video[] }>('/api/admin/videos').then(r => {
      if (r.error || !r.data) { setError(r.error ?? 'خطا'); return }
      setCats(r.data.categories); setVideos(r.data.videos)
      setForm(f => f.category_id || !r.data!.categories[0] ? f : { ...f, category_id: r.data!.categories[0].id })
    })
  }, [])
  useEffect(() => { load() }, [load])

  const byCat = useMemo(() => {
    const m = new Map<string, Video[]>()
    for (const v of videos) m.set(v.category_id, [...(m.get(v.category_id) ?? []), v])
    for (const list of m.values()) list.sort((a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at))
    return m
  }, [videos])
  const published = videos.filter(v => v.is_published).length

  const flash = (r: { error: string | null }, ok?: string) => {
    if (r.error) { setError(r.error); setNotice(null); return false }
    setError(null); if (ok) setNotice(ok); load(); return true
  }

  // Chunked upload, same protocol as the APK upload: the admin proxy caps
  // a request at 10 MB / 30 s, so the file goes up in ≤ 8 MB pieces.
  const pickVideo = async (file: File) => {
    if (!/\.mp4$/i.test(file.name)) { setError('فقط فایل .mp4'); return }
    setError(null); setNotice(null); setUpload({ pct: 0 })
    const duration = await readDuration(file)
    const auth = { Authorization: `Bearer ${getToken()}` }
    const fail = (msg: string) => { setUpload(null); setError(msg) }
    try {
      const start = await api.post<{ upload_id: string; chunk_size: number }>('/api/admin/videos/upload/start', {})
      if (!start.data) { fail(start.error ?? 'شروع آپلود ناموفق بود'); return }
      const { upload_id: id, chunk_size: chunk } = start.data
      let offset = 0
      while (offset < file.size) {
        const piece = file.slice(offset, Math.min(offset + chunk, file.size))
        let sent = false
        for (let attempt = 1; attempt <= 4 && !sent; attempt++) {
          try {
            const r = await fetch(`/api/admin/videos/upload/${id}/chunk?offset=${offset}`, {
              method: 'PUT', headers: { ...auth, 'Content-Type': 'application/octet-stream' }, body: piece,
            })
            const j = await r.json().catch(() => null) as { data: { size: number } | null; error: string | null } | null
            if ((r.ok || r.status === 409) && j?.data) { offset = j.data.size; sent = true }
            else if (attempt === 4) { fail(j?.error ?? `آپلود ناموفق (${r.status})`); return }
          } catch {
            if (attempt === 4) { fail('اتصال قطع شد — دوباره امتحان کنید'); return }
          }
        }
        setUpload({ pct: Math.round((offset / file.size) * 100) })
      }
      const done = await api.post<{ url: string; bytes: number }>(`/api/admin/videos/upload/${id}/finish`, { size: file.size })
      if (!done.data) { fail(done.error ?? 'پایان آپلود ناموفق بود'); return }
      setUpload(null)
      setForm(f => ({ ...f, video_url: done.data!.url, file_bytes: done.data!.bytes, duration_sec: duration }))
      setNotice(`ویدیو آپلود شد ✓ (${bytes(done.data.bytes)}${duration ? `، ${dur(duration)}` : ''})`)
      // No cover chosen yet: use the frame half a second before the end (the
      // word clips end on the animal smiling at the camera). Replaceable.
      if (!form.cover_url) {
        const frame = await captureFrame(file, duration ? duration - 0.5 : 1)
        if (frame) await pickCover(frame, 'frame.jpg')
      }
    } catch {
      fail('آپلود ناموفق بود')
    }
  }

  const pickCover = async (file: File | Blob, name = (file as File).name ?? 'cover.jpg') => {
    setCoverBusy(true); setError(null)
    const body = new FormData(); body.append('file', file, name)
    try {
      const r = await fetch('/api/admin/videos/cover', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body })
      const j = await r.json().catch(() => null) as { data: { url: string } | null; error: string | null } | null
      if (j?.data) setForm(f => ({ ...f, cover_url: j.data!.url }))
      else setError(j?.error ?? `آپلود تصویر ناموفق (${r.status})`)
    } catch { setError('آپلود تصویر ناموفق بود') }
    setCoverBusy(false)
  }

  const create = async () => {
    setBusy(true)
    const r = await api.post<Video>('/api/admin/videos', {
      category_id: form.category_id,
      title_fa: form.title_fa.trim(),
      description_fa: form.description_fa.trim() || null,
      video_url: form.video_url.trim(),
      cover_url: form.cover_url || null,
      duration_sec: form.duration_sec,
      file_bytes: form.file_bytes || null,
    })
    setBusy(false)
    if (flash(r, 'ویدیو ثبت شد — برای دیده شدن در اپ «انتشار» را بزنید')) setForm(f => ({ ...emptyForm, category_id: f.category_id }))
  }

  const patch = async (id: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(true); const r = await api.patch<Video>(`/api/admin/videos/${id}`, body); setBusy(false)
    return flash(r, ok)
  }
  const remove = async (id: string) => { setBusy(true); const r = await api.delete(`/api/admin/videos/${id}`); setBusy(false); flash(r, 'حذف شد') }

  // Swap order with the neighbour (index -1 = up, +1 = down) inside one category.
  const move = async (list: Video[], i: number, dir: -1 | 1) => {
    const a = list[i], b = list[i + dir]; if (!a || !b) return
    setBusy(true)
    const ao = a.order_index === b.order_index ? a.order_index + dir : b.order_index
    await api.patch(`/api/admin/videos/${a.id}`, { order_index: Math.max(0, ao) })
    await api.patch(`/api/admin/videos/${b.id}`, { order_index: Math.max(0, a.order_index) })
    setBusy(false); load()
  }
  const moveCat = async (i: number, dir: -1 | 1) => {
    if (!cats) return
    const a = cats[i], b = cats[i + dir]; if (!a || !b) return
    setBusy(true)
    const ao = a.order_index === b.order_index ? a.order_index + dir : b.order_index
    await api.patch(`/api/admin/video-categories/${a.id}`, { order_index: Math.max(0, ao) })
    await api.patch(`/api/admin/video-categories/${b.id}`, { order_index: Math.max(0, a.order_index) })
    setBusy(false); load()
  }

  const addCat = async () => {
    setBusy(true)
    const r = await api.post<Category>('/api/admin/video-categories', {
      title_fa: catForm.title_fa.trim(), slug: catForm.slug.trim(), emoji: catForm.emoji.trim() || null,
    })
    setBusy(false)
    if (flash(r, 'دسته اضافه شد')) setCatForm({ title_fa: '', slug: '', emoji: '' })
  }
  const saveCat = async () => {
    if (!editCat) return
    setBusy(true)
    const r = await api.patch(`/api/admin/video-categories/${editCat.id}`, { title_fa: editCat.title_fa.trim(), emoji: editCat.emoji.trim() || null })
    setBusy(false)
    if (flash(r, 'ذخیره شد')) setEditCat(null)
  }
  const removeCat = async (id: string) => { setBusy(true); const r = await api.delete(`/api/admin/video-categories/${id}`); setBusy(false); flash(r, 'دسته حذف شد') }

  if (!cats) return <div className="max-w-5xl">{error ? <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3">{error}</div> : <Spinner />}</div>

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="ویدیوهای کودکان"
        subtitle={`منوی «ویدیوها» در اپ و سایت — ${fa(published)} منتشرشده از ${fa(videos.length)}`}
        actions={<a href={`${WEB_URL}/child/videos`} target="_blank" rel="noreferrer" className="text-xs text-amber-700 inline-flex items-center gap-1 hover:underline">
          <Icon name="external" size={13} /> دیدن در سایت</a>} />

      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3" role="alert">{error}</div>}
      {notice && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl p-3" role="status">{notice}</div>}

      {/* New video */}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">ویدیوی تازه</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="فایل ویدیو" hint="MP4 (H.264)، تا ۳۰۰ مگابایت">
            <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              <Icon name="upload" size={15} />
              {upload ? `در حال آپلود… ${fa(upload.pct)}٪` : form.video_url ? 'آپلود شد ✓ — فایل دیگر؟' : 'انتخاب فایل .mp4'}
              <input type="file" accept="video/mp4,.mp4" className="sr-only" disabled={!!upload}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickVideo(f); e.target.value = '' }} />
            </label>
          </Field>
          <Field label="دسته">
            <Select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.emoji ? `${c.emoji} ` : ''}{c.title_fa}</option>)}
            </Select>
          </Field>
          <Field label="عنوان" hint="کودک این را زیر ویدیو می‌بیند، مثلاً «اسب»">
            <Input value={form.title_fa} maxLength={80} onChange={e => setForm({ ...form, title_fa: e.target.value })} />
          </Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Field label="توضیح کوتاه (اختیاری)">
              <Input value={form.description_fa} maxLength={300} onChange={e => setForm({ ...form, description_fa: e.target.value })} />
            </Field>
          </div>
          <Field label="تصویر کاور (اختیاری)" hint="اگر انتخاب نکنید، یک فریم از آخر ویدیو برداشته می‌شود">
            <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              {form.cover_url
                ? <img src={form.cover_url} alt="" className="w-10 h-6 object-cover rounded" />
                : <Icon name="image" size={15} />}
              {coverBusy ? 'در حال آپلود…' : form.cover_url ? 'تغییر تصویر' : 'انتخاب تصویر'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={coverBusy}
                onChange={e => { const f = e.target.files?.[0]; if (f) pickCover(f); e.target.value = '' }} />
            </label>
          </Field>
        </div>
        {form.video_url && (
          <video src={form.video_url} poster={form.cover_url || undefined} controls preload="metadata"
            className="w-full max-w-sm rounded-xl bg-black aspect-video" />
        )}
        <div className="flex justify-end">
          <Button onClick={create} disabled={busy || !!upload || coverBusy || !form.video_url || !form.title_fa.trim() || !form.category_id}>
            <Icon name="add" size={15} /> ثبت ویدیو
          </Button>
        </div>
      </Card>

      {/* Videos by category */}
      {cats.map(c => {
        const list = byCat.get(c.id) ?? []
        return (
          <Card key={c.id} className="p-4">
            <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
              <span aria-hidden>{c.emoji}</span> {c.title_fa}
              <span className="text-[11px] font-normal text-slate-400">{fa(list.length)} ویدیو</span>
            </h3>
            {list.length === 0 ? <EmptyState>هنوز ویدیویی در این دسته نیست</EmptyState> : (
              <div className="divide-y divide-slate-100">
                {list.map((v, i) => (
                  <div key={v.id} className="py-3 flex flex-wrap items-center gap-3">
                    <video src={`${v.video_url}#t=0.5`} poster={v.cover_url || undefined} preload="metadata" muted
                      className="w-28 aspect-video object-cover rounded-lg bg-slate-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      {editing?.id === v.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input value={editing.title_fa} maxLength={80} className="max-w-[12rem]"
                            onChange={e => setEditing({ ...editing, title_fa: e.target.value })} />
                          <Select value={editing.category_id} className="max-w-[12rem]"
                            onChange={e => setEditing({ ...editing, category_id: e.target.value })}>
                            {cats.map(o => <option key={o.id} value={o.id}>{o.title_fa}</option>)}
                          </Select>
                          <Button disabled={busy || !editing.title_fa.trim()} onClick={async () => {
                            if (await patch(v.id, { title_fa: editing.title_fa.trim(), category_id: editing.category_id }, 'ذخیره شد')) setEditing(null)
                          }}><Icon name="save" size={14} /> ذخیره</Button>
                          <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{v.title_fa}</span>
                          {v.is_published ? <Badge tone="green">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {[dur(v.duration_sec), v.file_bytes ? bytes(v.file_bytes) : '', v.description_fa].filter(Boolean).join(' — ')}
                      </div>
                    </div>
                    <div className="ms-auto flex items-center gap-1.5">
                      <Button variant="ghost" disabled={busy || i === 0} onClick={() => move(list, i, -1)} aria-label="بالاتر"><Icon name="moveUp" size={14} /></Button>
                      <Button variant="ghost" disabled={busy || i === list.length - 1} onClick={() => move(list, i, 1)} aria-label="پایین‌تر"><Icon name="moveDown" size={14} /></Button>
                      <Button variant="ghost" disabled={busy} onClick={() => setEditing({ id: v.id, title_fa: v.title_fa, category_id: v.category_id })} aria-label="ویرایش"><Icon name="pencil" size={14} /></Button>
                      <a href={v.video_url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-slate-800 px-2"><Icon name="external" size={13} /></a>
                      {v.is_published ? (
                        <Button variant="secondary" disabled={busy} onClick={() => patch(v.id, { is_published: false }, 'از انتشار برداشته شد')}>برداشتن از انتشار</Button>
                      ) : (<>
                        <Button variant="ghost" disabled={busy} onClick={() => remove(v.id)} aria-label="حذف"><Icon name="remove" size={14} /></Button>
                        <Button disabled={busy} onClick={() => patch(v.id, { is_published: true }, 'منتشر شد — تا یک دقیقه در اپ و سایت دیده می‌شود')}>
                          <Icon name="rocket" size={14} /> انتشار</Button>
                      </>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {/* Categories */}
      <Card className="p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">دسته‌ها</h3>
        <p className="text-xs text-slate-500">در اپ فقط دسته‌هایی نشان داده می‌شوند که دست‌کم یک ویدیوی منتشرشده دارند، به همین ترتیب.</p>
        <div className="divide-y divide-slate-100">
          {cats.map((c, i) => (
            <div key={c.id} className="py-2 flex flex-wrap items-center gap-2">
              {editCat?.id === c.id ? (<>
                <Input value={editCat.emoji} maxLength={8} className="w-16 text-center" aria-label="ایموجی"
                  onChange={e => setEditCat({ ...editCat, emoji: e.target.value })} />
                <Input value={editCat.title_fa} maxLength={60} className="max-w-[14rem]" aria-label="نام دسته"
                  onChange={e => setEditCat({ ...editCat, title_fa: e.target.value })} />
                <Button disabled={busy || !editCat.title_fa.trim()} onClick={saveCat}><Icon name="save" size={14} /> ذخیره</Button>
                <Button variant="ghost" onClick={() => setEditCat(null)}>انصراف</Button>
              </>) : (<>
                <span className="w-6 text-center" aria-hidden>{c.emoji}</span>
                <span className="font-semibold text-slate-700 text-sm">{c.title_fa}</span>
                <span className="text-[11px] text-slate-400 ltr">{c.slug}</span>
                <span className="text-[11px] text-slate-400">{fa((byCat.get(c.id) ?? []).length)} ویدیو</span>
                <div className="ms-auto flex items-center gap-1.5">
                  <Button variant="ghost" disabled={busy || i === 0} onClick={() => moveCat(i, -1)} aria-label="بالاتر"><Icon name="moveUp" size={14} /></Button>
                  <Button variant="ghost" disabled={busy || i === cats.length - 1} onClick={() => moveCat(i, 1)} aria-label="پایین‌تر"><Icon name="moveDown" size={14} /></Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setEditCat({ id: c.id, title_fa: c.title_fa, emoji: c.emoji ?? '' })} aria-label="ویرایش"><Icon name="pencil" size={14} /></Button>
                  <Button variant="ghost" disabled={busy || (byCat.get(c.id) ?? []).length > 0} onClick={() => removeCat(c.id)} aria-label="حذف"><Icon name="remove" size={14} /></Button>
                </div>
              </>)}
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-[5rem_1fr_1fr_auto] gap-3 items-end pt-2 border-t border-slate-100">
          <Field label="ایموجی"><Input value={catForm.emoji} maxLength={8} className="text-center" placeholder="📖" onChange={e => setCatForm({ ...catForm, emoji: e.target.value })} /></Field>
          <Field label="نام دسته"><Input value={catForm.title_fa} maxLength={60} placeholder="قصه‌ها" onChange={e => setCatForm({ ...catForm, title_fa: e.target.value })} /></Field>
          <Field label="شناسه (انگلیسی)" hint="حروف کوچک و خط تیره، مثلاً stories">
            <Input dir="ltr" value={catForm.slug} maxLength={40} placeholder="stories"
              onChange={e => setCatForm({ ...catForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} />
          </Field>
          <Button onClick={addCat} disabled={busy || !catForm.title_fa.trim() || catForm.slug.trim().length < 2}><Icon name="add" size={15} /> افزودن دسته</Button>
        </div>
      </Card>
    </div>
  )
}
