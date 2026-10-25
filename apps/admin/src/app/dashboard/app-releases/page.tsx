'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { getToken } from '@/lib/auth'
import { PageHeader, Button, Badge, Card, Field, Input, Spinner, EmptyState } from '@/components/ui'
import { Icon } from '@/components/icons'
import { bytes, fa } from '@/lib/csv'

/* Android releases handed out directly from the site's /app page, outside
 * Google Play (routes/appReleases.ts). Publishing makes a release the one the
 * download page and the app's update check serve, and queues an announcement
 * in the Telegram approval queue — it never posts to the channel by itself. */

// The public site (apps/web), where the /app download page lives.
const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://koodakbook.eu.cc').replace(/\/+$/, '')

interface Release {
  id: string
  version_name: string
  version_code: number
  download_url: string
  file_bytes: number | null
  sha256: string | null
  notes: string | null
  is_published: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
}

export default function AppReleasesPage() {
  const [rows, setRows] = useState<Release[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [upload, setUpload] = useState<{ pct: number } | null>(null)
  const [form, setForm] = useState({ version_name: '', version_code: '', download_url: '', notes: '', file_bytes: 0, sha256: '' })

  const load = useCallback(() => {
    api.get<Release[]>('/api/admin/app-releases').then(r => {
      if (r.error) setError(r.error); else setRows(r.data ?? [])
    })
  }, [])
  useEffect(() => { load() }, [load])

  const latest = rows?.find(r => r.is_published)
  const nextCode = rows && rows.length ? Math.max(...rows.map(r => r.version_code)) + 1 : 1

  // Chunked upload (backend routes/appReleases.ts): the admin's Next.js proxy
  // refuses request bodies over 10 MB and gives up after 30 s, so the APK
  // (60-120 MB) goes up in 8 MB pieces, in order, each retried a few times.
  const pickFile = async (file: File) => {
    if (!/\.apk$/i.test(file.name)) { setError('فقط فایل .apk'); return }
    setError(null); setNotice(null); setUpload({ pct: 0 })
    const auth = { Authorization: `Bearer ${getToken()}` }
    const fail = (msg: string) => { setUpload(null); setError(msg) }
    try {
      const start = await api.post<{ upload_id: string; chunk_size: number }>('/api/admin/app-releases/upload/start', {})
      if (!start.data) { fail(start.error ?? 'شروع آپلود ناموفق بود'); return }
      const { upload_id: id, chunk_size: chunk } = start.data
      let offset = 0
      while (offset < file.size) {
        const piece = file.slice(offset, Math.min(offset + chunk, file.size))
        let sent = false
        for (let attempt = 1; attempt <= 4 && !sent; attempt++) {
          try {
            const r = await fetch(`/api/admin/app-releases/upload/${id}/chunk?offset=${offset}`, {
              method: 'PUT', headers: { ...auth, 'Content-Type': 'application/octet-stream' }, body: piece,
            })
            const j = await r.json().catch(() => null) as { data: { size: number } | null; error: string | null } | null
            if (r.ok && j?.data) { offset = j.data.size; sent = true }
            else if (r.status === 409 && j?.data) { offset = j.data.size; sent = true }   // server says where it really is
            else if (attempt === 4) { fail(j?.error ?? `آپلود ناموفق (${r.status})`); return }
          } catch {
            if (attempt === 4) { fail('اتصال قطع شد — دوباره امتحان کنید'); return }
          }
        }
        setUpload({ pct: Math.round((offset / file.size) * 100) })
      }
      const done = await api.post<{ url: string; bytes: number; sha256: string }>(
        `/api/admin/app-releases/upload/${id}/finish`, { size: file.size })
      if (!done.data) { fail(done.error ?? 'پایان آپلود ناموفق بود'); return }
      setUpload(null)
      setForm(f => ({ ...f, download_url: done.data!.url, file_bytes: done.data!.bytes, sha256: done.data!.sha256 }))
      setNotice(`فایل آپلود شد ✓ (${bytes(done.data.bytes)})`)
    } catch {
      fail('آپلود ناموفق بود')
    }
  }

  const create = async () => {
    setBusy(true); setError(null); setNotice(null)
    const r = await api.post<Release>('/api/admin/app-releases', {
      version_name: form.version_name.trim(),
      version_code: Number(form.version_code || nextCode),
      download_url: form.download_url.trim(),
      notes: form.notes.trim() || null,
      file_bytes: form.file_bytes || null,
      sha256: form.sha256 || null,
    })
    setBusy(false)
    if (r.error) { setError(r.error); return }
    setForm({ version_name: '', version_code: '', download_url: '', notes: '', file_bytes: 0, sha256: '' })
    setNotice('نسخه ثبت شد — برای عمومی شدن «انتشار» را بزنید')
    load()
  }

  const act = async (id: string, action: 'publish' | 'unpublish' | 'delete', announce = true) => {
    setBusy(true); setError(null); setNotice(null)
    const r = action === 'delete'
      ? await api.delete(`/api/admin/app-releases/${id}`)
      : await api.post<{ draft_id?: string | null }>(`/api/admin/app-releases/${id}/${action}`, { announce })
    setBusy(false)
    if (r.error) { setError(r.error); return }
    if (action === 'publish') setNotice(announce ? 'منتشر شد. متن معرفی در «صف تأیید تلگرام» منتظر تأیید شماست.' : 'منتشر شد (بدون پست تلگرام).')
    load()
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="انتشار اپ اندروید"
        subtitle="نسخه‌ی مستقیم، بیرون از گوگل‌پلی — روی صفحه‌ی «نصب اپ» سایت"
        actions={<a href={`${WEB_URL}/app`} target="_blank" rel="noreferrer" className="text-xs text-amber-700 inline-flex items-center gap-1 hover:underline">
          <Icon name="external" size={13} /> صفحه‌ی دانلود در سایت</a>} />

      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3" role="alert">{error}</div>}
      {notice && <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl p-3" role="status">
        {notice} {notice.includes('صف تأیید') && <Link href="/dashboard/post-drafts" className="underline">رفتن به صف</Link>}
      </div>}

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">نسخه‌ی منتشرشده</p>
          <p className="text-2xl font-bold text-slate-800 mt-1 ltr text-right">{latest ? latest.version_name : '—'}</p>
          <p className="text-[11px] text-slate-400 mt-1">{latest ? `کد ${fa(latest.version_code)}، ${latest.file_bytes ? bytes(latest.file_bytes) : ''}` : 'هنوز نسخه‌ای منتشر نشده'}</p>
        </Card>
        <Card className="p-4 md:col-span-2 text-xs text-slate-600 leading-6">
          <p className="font-semibold text-slate-700 mb-1">ساختن APK روی مک</p>
          <code className="ltr block bg-slate-50 rounded-lg p-2 text-[11px]">cd apps/mobile &amp;&amp; eas build -p android --profile apk</code>
          <p className="mt-1">در پایان، EAS لینک فایل .apk را می‌دهد. فایل را این‌جا آپلود کنید، یا آن را در GitHub Releases بگذارید و لینک https را وارد کنید. «کد نسخه» همان versionCode اندروید است و باید هر بار بزرگ‌تر شود.</p>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">نسخه‌ی تازه</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="نام نسخه" hint="مثلاً 0.2.0"><Input dir="ltr" value={form.version_name} onChange={e => setForm({ ...form, version_name: e.target.value })} /></Field>
          <Field label="کد نسخه (versionCode)" hint={`پیشنهاد: ${nextCode}`}>
            <Input dir="ltr" inputMode="numeric" value={form.version_code} placeholder={String(nextCode)}
              onChange={e => setForm({ ...form, version_code: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="فایل APK">
            <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
              <Icon name="upload" size={15} /> {upload ? `در حال آپلود… ${fa(upload.pct)}٪` : 'انتخاب فایل .apk'}
              <input type="file" accept=".apk,application/vnd.android.package-archive" className="sr-only"
                disabled={!!upload} onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />
            </label>
          </Field>
        </div>
        <Field label="لینک دانلود" hint="بعد از آپلود خودکار پر می‌شود، یا لینک https">
          <Input dir="ltr" value={form.download_url} placeholder="https://… یا /uploads/apps/…" onChange={e => setForm({ ...form, download_url: e.target.value })} />
        </Field>
        <Field label="تازه‌های این نسخه" hint="کوتاه — در پست تلگرام هم می‌آید">
          <Input value={form.notes} maxLength={300} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end">
          <Button onClick={create} disabled={busy || !!upload || !form.version_name.trim() || !form.download_url.trim()}>
            <Icon name="add" size={15} /> ثبت نسخه
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-3">همه‌ی نسخه‌ها</h3>
        {!rows ? <Spinner /> : rows.length === 0 ? <EmptyState>هنوز نسخه‌ای ثبت نشده</EmptyState> : (
          <div className="divide-y divide-slate-100">
            {rows.map(r => (
              <div key={r.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 ltr">{r.version_name}</span>
                    <span className="text-[11px] text-slate-400">کد {fa(r.version_code)}</span>
                    {r.is_published ? <Badge tone="green">منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
                    {latest?.id === r.id && <Badge tone="amber">فعلی</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 ltr text-right truncate max-w-xl">{r.download_url}</div>
                  {r.notes && <div className="text-xs text-slate-500 mt-0.5">{r.notes}</div>}
                </div>
                <div className="ms-auto flex items-center gap-2">
                  <a href={r.download_url} className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"><Icon name="download" size={13} /> دانلود</a>
                  {r.is_published ? (
                    <Button variant="secondary" disabled={busy} onClick={() => act(r.id, 'unpublish')}>برداشتن از انتشار</Button>
                  ) : (<>
                    <Button variant="ghost" disabled={busy} onClick={() => act(r.id, 'delete')}><Icon name="remove" size={14} /></Button>
                    <Button variant="secondary" disabled={busy} onClick={() => act(r.id, 'publish', false)}>انتشار بی‌صدا</Button>
                    <Button disabled={busy} onClick={() => act(r.id, 'publish')}><Icon name="rocket" size={14} /> انتشار + پست تلگرام</Button>
                  </>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
