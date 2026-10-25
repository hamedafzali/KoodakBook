'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { PageHeader, Button, Badge, Spinner } from '@/components/ui'
import { Donut, BarList, CohortHeatmap } from '@/components/charts'
import { KpiCard, Segmented, Panel, TrendChart, ProgressRow, DataGrid } from '@/components/report'
import { Icon } from '@/components/icons'
import { downloadCsv, fa, pct, bytes } from '@/lib/csv'

/* Reports — four tabs over GET /api/admin/reports/* (routes/adminReports.ts).
 * Every number is computed from the tables the app already writes; nothing
 * here is tracked separately. Period: 7 / 30 / 90 days. */

type Tab = 'growth' | 'learning' | 'content' | 'system'
const TABS: { value: Tab; label: string }[] = [
  { value: 'growth', label: 'رشد و درآمد' },
  { value: 'learning', label: 'یادگیری و تعامل' },
  { value: 'content', label: 'محتوا و کیفیت' },
  { value: 'system', label: 'سیستم و هزینه' },
]

interface Growth {
  days: number
  kpis: Record<'families' | 'new_families' | 'prev_new_families' | 'children' | 'new_children' | 'premium_active' | 'paying' | 'temp_grants' | 'new_leads' | 'open_leads' | 'suspended', number>
  series: { day: string; signups: number; children: number }[]
  plans: { plan: string; count: number }[]
  billing: { configured: boolean; started: number; cancel_scheduled: number; ended: number; payment_failed: number }
  leads: { type: string; status: string; count: number }[]
  funnel: Record<'signed_up' | 'added_child' | 'placed' | 'first_lesson' | 'first_story' | 'came_back_week2', number>
}
interface Learning {
  days: number
  kpis: Record<'dau' | 'wau' | 'mau' | 'active' | 'sessions' | 'minutes' | 'avg_session_min' | 'lessons_done' | 'stories_done' | 'words_mastered' | 'ai_stories', number>
  series: { day: string; active: number; sessions: number; minutes: number; lessons: number }[]
  cohorts: { week: string; size: number; retention: (number | null)[] }[]
  levels: { level: number; count: number }[]
  ages: { age: number | null; count: number }[]
  lessons: { title: string; completed: number; started: number }[]
  mastery: Record<string, number>
}
interface Content {
  days: number
  coverage: Record<'words' | 'words_with_image' | 'words_with_audio' | 'letters' | 'letters_with_audio' | 'stories' | 'stories_with_cover' | 'story_pages' | 'story_pages_with_audio' | 'lessons' | 'ai_stories_total', number>
  queues: Record<'word_images' | 'covers' | 'drafts' | 'leads' | 'feedback', number>
  hardest_words: { persian: string; english: string; avg_replay: number; learners: number }[]
  stories: { title: string; started: number; completed: number; recent: number }[]
  categories: { category: string; total: number; with_image: number; with_audio: number }[]
}
interface System {
  days: number
  ai: { day: string; stories: number; translate: number; audio: number }[]
  tts: { month: string; chars: number }[]
  errors: { kind: string; detail: string; last_at: string; suppressed: number }[]
  deploys: { at: string; version: string; migrations: string[] }[]
  database: { bytes: number; tables: { name: string; bytes: number; rows: number }[] }
  recordings: { count: number; bytes: number }
  integrations: {
    admin_telegram: boolean; alert_telegram: boolean; healthchecks: boolean; channel_telegram: boolean
    stripe: boolean; ai: boolean; ai_provider: string | null; tts: boolean; summary: { tz: string; hour: number }
  }
}

const PLAN_LABEL: Record<string, string> = { free: 'رایگان', premium: 'پریمیوم', premium_solo: 'پریمیوم (هدیه/آزمایشی)', 'free (expired)': 'رایگان (منقضی)' }
const PLAN_COLOR: Record<string, string> = { free: '#cbd5e1', premium: '#7c3aed', premium_solo: '#a78bfa', 'free (expired)': '#e2e8f0' }
const LEAD_LABEL: Record<string, string> = { tablet: 'تبلت', app_waitlist: 'لیست انتظار اپ', contact: 'تماس' }
const LEVEL_LABEL: Record<number, string> = { 1: 'مرحله ۱ — واژه', 2: 'مرحله ۲ — الفبا', 3: 'مرحله ۳ — داستان', 4: 'مرحله ۴ — خواندن' }
const MASTERY: { key: string; label: string; color: string }[] = [
  { key: 'introduced', label: 'آشنا شده', color: '#cbd5e1' },
  { key: 'practicing', label: 'در حال تمرین', color: '#fbbf24' },
  { key: 'mastered', label: 'یاد گرفته', color: '#34d399' },
  { key: 'consolidated', label: 'تثبیت‌شده', color: '#059669' },
]

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('growth')
  const [days, setDays] = useState<7 | 30 | 90>(30)
  // The loaded report remembers which tab/period it belongs to: right after a
  // tab switch the previous tab's data must never reach the new tab's view
  // (each view reads fields only its own report has).
  const [loaded, setLoaded] = useState<{ key: string; data: Growth | Learning | Content | System } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const key = `${tab}:${days}`
  const latest = useRef(key)

  const load = useCallback(() => {
    latest.current = key
    setError(null)
    api.get<Growth | Learning | Content | System>(`/api/admin/reports/${tab}?days=${days}`).then(r => {
      if (latest.current !== key) return  // a newer request is in flight
      if (r.error || !r.data) setError(r.error ?? 'گزارش بارگذاری نشد')
      else { setLoaded({ key, data: r.data }); setLoadedAt(new Date()) }
    })
  }, [tab, days, key])
  useEffect(() => { load() }, [load])
  const data = loaded?.key === key ? loaded.data : null

  return (
    <div className="space-y-5 max-w-7xl">
      <PageHeader
        title="گزارش‌ها"
        subtitle={loadedAt ? `به‌روز شده ${loadedAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'همه‌ی اعداد از داده‌ی واقعی اپ محاسبه می‌شوند'}
        actions={<>
          <Segmented label="بازه" value={days} onChange={setDays}
            options={[{ value: 7, label: '۷ روز' }, { value: 30, label: '۳۰ روز' }, { value: 90, label: '۹۰ روز' }]} />
          <Button variant="secondary" onClick={load} aria-label="بارگذاری دوباره"><Icon name="regenerate" size={15} /></Button>
        </>}
      />
      <Segmented label="بخش گزارش" value={tab} onChange={setTab} options={TABS} />

      {error && <div className="bg-rose-50 text-rose-700 text-sm rounded-xl p-3">{error}</div>}
      {!data && !error && <Spinner />}
      {data && tab === 'growth' && <GrowthView d={data as Growth} />}
      {data && tab === 'learning' && <LearningView d={data as Learning} />}
      {data && tab === 'content' && <ContentView d={data as Content} />}
      {data && tab === 'system' && <SystemView d={data as System} />}
    </div>
  )
}

function CsvButton({ name, rows }: { name: string; rows: Record<string, unknown>[] }) {
  return (
    <button type="button" onClick={() => downloadCsv(`${name}.csv`, rows)} disabled={!rows.length}
      className="text-[11px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 disabled:opacity-40">
      <Icon name="download" size={13} /> CSV
    </button>
  )
}

// ── Growth ────────────────────────────────────────────────
function GrowthView({ d }: { d: Growth }) {
  const k = d.kpis
  const delta = k.prev_new_families > 0 ? (k.new_families - k.prev_new_families) / k.prev_new_families : null
  const f = d.funnel
  const leadsByType = Object.entries(d.leads.reduce<Record<string, number>>((m, l) => ({ ...m, [l.type]: (m[l.type] ?? 0) + l.count }), {}))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="خانواده‌ها" value={k.families} icon="families" tone="amber" hint={`${fa(k.new_families)} تازه در ${fa(d.days)} روز`} />
        <KpiCard label="ثبت‌نام تازه" value={k.new_families} icon="up" tone="emerald" delta={delta} hint="نسبت به دوره‌ی قبل" />
        <KpiCard label="کودکان" value={k.children} icon="children" tone="sky" hint={`${fa(k.new_children)} تازه`} />
        <KpiCard label="مشترک پرداختی" value={k.paying} icon="card" tone="violet" hint={`${fa(pct(k.paying, k.families))}٪ خانواده‌ها`} />
        <KpiCard label="پریمیوم فعال" value={k.premium_active} icon="badges" tone="violet" hint={`${fa(k.temp_grants)} هدیه در دوره`} />
        <KpiCard label="درخواست‌های باز" value={k.open_leads} icon="inbox" tone="rose" hint={`${fa(k.new_leads)} تازه`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="ثبت‌نام روزانه" subtitle="خانواده‌ها و کودکان تازه" className="lg:col-span-2"
          actions={<CsvButton name="signups" rows={d.series} />}>
          <TrendChart labels={d.series.map(s => s.day)} series={[
            { name: 'خانواده', color: '#f59e0b', points: d.series.map(s => s.signups) },
            { name: 'کودک', color: '#0ea5e9', points: d.series.map(s => s.children) },
          ]} />
        </Panel>
        <Panel title="پلن‌ها">
          <Donut slices={d.plans.map(p => ({ label: PLAN_LABEL[p.plan] ?? p.plan, value: p.count, color: PLAN_COLOR[p.plan] ?? '#94a3b8' }))} />
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="قیف فعال‌سازی" subtitle={`خانواده‌هایی که در ${fa(d.days)} روز اخیر ثبت‌نام کردند`} className="lg:col-span-2">
          <div className="space-y-3">
            <ProgressRow label="ثبت‌نام" value={f.signed_up} total={f.signed_up} color="#94a3b8" />
            <ProgressRow label="کودک اضافه کرد" value={f.added_child} total={f.signed_up} color="#f59e0b" />
            <ProgressRow label="ارزیابی اولیه تمام شد" value={f.placed} total={f.signed_up} color="#f59e0b" />
            <ProgressRow label="اولین درس تمام شد" value={f.first_lesson} total={f.signed_up} color="#10b981" />
            <ProgressRow label="اولین داستان تمام شد" value={f.first_story} total={f.signed_up} color="#10b981" />
            <ProgressRow label="هفته‌ی دوم برگشت" value={f.came_back_week2} total={f.signed_up} color="#7c3aed" />
          </div>
        </Panel>
        <Panel title="پرداخت‌ها" subtitle={d.billing.configured ? `رویدادهای Stripe در ${fa(d.days)} روز` : 'Stripe هنوز وصل نشده'}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'اشتراک تازه', v: d.billing.started, c: 'text-emerald-600' },
              { label: 'درخواست لغو', v: d.billing.cancel_scheduled, c: 'text-amber-600' },
              { label: 'اشتراک تمام‌شده', v: d.billing.ended, c: 'text-slate-600' },
              { label: 'پرداخت ناموفق', v: d.billing.payment_failed, c: 'text-rose-600' },
            ].map(b => (
              <div key={b.label} className="bg-slate-50 rounded-xl p-3">
                <div className={`text-xl font-bold tabular-nums ${b.c}`}>{fa(b.v)}</div>
                <div className="text-[11px] text-slate-500">{b.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-slate-500 mb-2">درخواست‌ها بر اساس نوع</h4>
            <BarList color="#f43f5e" items={leadsByType.map(([t, n]) => ({ label: LEAD_LABEL[t] ?? t, value: n }))} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ── Learning ──────────────────────────────────────────────
function LearningView({ d }: { d: Learning }) {
  const k = d.kpis
  const masteryTotal = MASTERY.reduce((a, m) => a + (d.mastery[m.key] ?? 0), 0)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="فعال امروز (DAU)" value={k.dau} icon="activity" tone="emerald" />
        <KpiCard label="فعال هفته (WAU)" value={k.wau} icon="activity" tone="emerald" hint={`ماه: ${fa(k.mau)}`} />
        <KpiCard label="چسبندگی" value={`${fa(pct(k.dau, k.mau))}٪`} icon="up" tone="sky" hint="DAU ÷ MAU" />
        <KpiCard label="دقیقه‌ی یادگیری" value={k.minutes} icon="headphones" tone="amber" hint={`میانگین جلسه ${fa(k.avg_session_min, 1)} دقیقه`} />
        <KpiCard label="درس تمام‌شده" value={k.lessons_done} icon="lessons" tone="violet" hint={`داستان: ${fa(k.stories_done)}`} />
        <KpiCard label="واژه‌ی یادگرفته" value={k.words_mastered} icon="words" tone="rose" hint={`داستان AI: ${fa(k.ai_stories)}`} />
      </div>

      <Panel title="فعالیت روزانه" subtitle="کودکان فعال، جلسه‌ها و درس‌های تمام‌شده" actions={<CsvButton name="activity" rows={d.series} />}>
        <TrendChart labels={d.series.map(s => s.day)} series={[
          { name: 'کودک فعال', color: '#10b981', points: d.series.map(s => s.active) },
          { name: 'جلسه', color: '#0ea5e9', points: d.series.map(s => s.sessions) },
          { name: 'درس تمام‌شده', color: '#8b5cf6', points: d.series.map(s => s.lessons) },
        ]} />
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="ماندگاری هفتگی کودکان" subtitle="سهم هر گروه هفتگی که در هفته‌های بعد برگشت">
          <CohortHeatmap cohorts={d.cohorts.map(c => ({ ...c, retention: c.retention.slice(0, 6) }))} />
        </Panel>
        <Panel title="وضعیت واژه‌ها" subtitle="همه‌ی واژه‌هایی که کودکان دیده‌اند">
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-3">
            {MASTERY.map(m => (
              <div key={m.key} style={{ width: `${masteryTotal ? ((d.mastery[m.key] ?? 0) / masteryTotal) * 100 : 0}%`, background: m.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {MASTERY.map(m => (
              <div key={m.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                <span className="text-slate-600">{m.label}</span>
                <span className="text-slate-400 ms-auto tabular-nums">{fa(d.mastery[m.key] ?? 0)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 mb-2">سطح کودکان</h4>
              <BarList color="#f59e0b" items={d.levels.map(l => ({ label: LEVEL_LABEL[l.level] ?? `مرحله ${l.level}`, value: l.count }))} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-500 mb-2">سن کودکان</h4>
              <BarList color="#0ea5e9" items={d.ages.map(a => ({ label: a.age === null ? 'نامشخص' : `${fa(a.age)} سال`, value: a.count }))} />
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="درس‌ها به ترتیب برنامه" subtitle="کجا کودکان متوقف می‌شوند" actions={<CsvButton name="lessons" rows={d.lessons} />}>
        <div className="max-h-96 overflow-y-auto">
        <DataGrid rows={d.lessons} columns={[
          { key: 'title', label: 'درس' },
          { key: 'started', label: 'شروع', align: 'end' },
          { key: 'completed', label: 'تمام', align: 'end' },
          { key: 'completed', label: 'نرخ تکمیل', align: 'end', render: r => `${fa(pct(r.completed, r.started))}٪` },
        ]} />
        </div>
      </Panel>
    </div>
  )
}

// ── Content ───────────────────────────────────────────────
function ContentView({ d }: { d: Content }) {
  const c = d.coverage, q = d.queues
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="تصویر واژه‌ها در صف" value={q.word_images} icon="image" tone="amber" hint="منتظر تأیید" />
        <KpiCard label="جلد داستان در صف" value={q.covers} icon="stories" tone="amber" hint="منتظر تأیید" />
        <KpiCard label="پیش‌نویس تلگرام" value={q.drafts} icon="send" tone="sky" hint="منتظر تأیید" />
        <KpiCard label="بازخورد و درخواست باز" value={q.feedback + q.leads} icon="inbox" tone="rose" hint={`بازخورد ${fa(q.feedback)}، درخواست ${fa(q.leads)}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="پوشش محتوا" subtitle="هرچه کامل‌تر، تجربه‌ی کودک بهتر">
          <div className="space-y-3">
            <ProgressRow label="واژه‌ها با تصویر" value={c.words_with_image} total={c.words} color="#f59e0b" />
            <ProgressRow label="واژه‌ها با صدا" value={c.words_with_audio} total={c.words} color="#10b981" />
            <ProgressRow label="حروف با صدا" value={c.letters_with_audio} total={c.letters} color="#10b981" />
            <ProgressRow label="داستان‌ها با جلد" value={c.stories_with_cover} total={c.stories} color="#8b5cf6" />
            <ProgressRow label="صفحه‌های داستان با صدا" value={c.story_pages_with_audio} total={c.story_pages} color="#0ea5e9" />
          </div>
          <p className="text-[11px] text-slate-400 mt-3">{fa(c.lessons)} درس، {fa(c.ai_stories_total)} داستان ساخته‌شده با هوش مصنوعی</p>
        </Panel>
        <Panel title="پوشش بر اساس دسته" actions={<CsvButton name="categories" rows={d.categories} />}>
          <DataGrid rows={d.categories} columns={[
            { key: 'category', label: 'دسته' },
            { key: 'total', label: 'واژه', align: 'end' },
            { key: 'with_image', label: 'تصویر', align: 'end', render: r => `${fa(pct(r.with_image, r.total))}٪` },
            { key: 'with_audio', label: 'صدا', align: 'end', render: r => `${fa(pct(r.with_audio, r.total))}٪` },
          ]} />
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="سخت‌ترین واژه‌ها" subtitle="بیشترین تکرار شنیدن برای هر کودک" actions={<CsvButton name="hardest-words" rows={d.hardest_words} />}>
          <BarList color="#ef4444" suffix="×"
            items={d.hardest_words.map(w => ({ label: `${w.persian} (${w.english})`, value: w.avg_replay, sub: `${fa(w.learners)} کودک` }))} />
        </Panel>
        <Panel title="داستان‌ها" subtitle={`«اخیر» = خوانده‌شده در ${fa(d.days)} روز`} actions={<CsvButton name="stories" rows={d.stories} />}>
          <DataGrid rows={d.stories} columns={[
            { key: 'title', label: 'داستان' },
            { key: 'started', label: 'شروع', align: 'end' },
            { key: 'completed', label: 'تکمیل', align: 'end', render: r => `${fa(pct(r.completed, r.started))}٪` },
            { key: 'recent', label: 'اخیر', align: 'end' },
          ]} />
        </Panel>
      </div>
    </div>
  )
}

// ── System ────────────────────────────────────────────────
function SystemView({ d }: { d: System }) {
  const [notice, setNotice] = useState<string | null>(null)
  const i = d.integrations
  const send = async (path: string) => {
    setNotice('در حال ارسال…')
    const r = await api.post<{ result: string }>(path, {})
    const label: Record<string, string> = { sent: 'فرستاده شد ✓', 'dry-run': 'توکن تنظیم نشده — فقط در لاگ نوشته شد', error: 'تلگرام خطا داد — لاگ بک‌اند را ببینید' }
    setNotice(r.error ?? label[r.data?.result ?? ''] ?? r.data?.result ?? '')
  }
  const aiTotal = d.ai.reduce((a, r) => a + r.stories, 0)
  const integrations: { label: string; ok: boolean; note?: string }[] = [
    { label: 'تلگرام مدیر (اعلان‌ها و گزارش روزانه)', ok: i.admin_telegram, note: `گزارش روزانه ${fa(i.summary.hour)}:۰۰ — ${i.summary.tz}` },
    { label: 'هشدارهای سیستمی (تلگرام)', ok: i.alert_telegram },
    { label: 'healthchecks.io', ok: i.healthchecks },
    { label: 'کانال تلگرام', ok: i.channel_telegram },
    { label: 'پرداخت (Stripe)', ok: i.stripe },
    { label: 'هوش مصنوعی', ok: i.ai, note: i.ai_provider ?? undefined },
    { label: 'صدا (TTS)', ok: i.tts },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="داستان AI در دوره" value={aiTotal} icon="ai" tone="violet" />
        <KpiCard label="خطاهای گزارش‌شده" value={d.errors.length} icon="warning" tone="rose" hint={`${fa(d.errors.reduce((a, e) => a + e.suppressed, 0))} مورد تکراری`} />
        <KpiCard label="حجم پایگاه داده" value={bytes(d.database.bytes)} icon="server" tone="slate" />
        <KpiCard label="صدای ضبط‌شده‌ی کودکان" value={d.recordings.count} icon="record" tone="sky" hint={bytes(d.recordings.bytes)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="اتصال‌ها" subtitle="از متغیرهای محیطی بک‌اند خوانده می‌شود">
          <ul className="space-y-2">
            {integrations.map(it => (
              <li key={it.label} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${it.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-slate-600">{it.label}</span>
                <span className="ms-auto">{it.ok ? <Badge tone="green">فعال</Badge> : <Badge>خاموش</Badge>}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400 mt-2">{integrations[0].note}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="secondary" onClick={() => send('/api/admin/notify/test')}><Icon name="bell" size={14} /> پیام آزمایشی</Button>
            <Button variant="secondary" onClick={() => send('/api/admin/notify/summary')}><Icon name="send" size={14} /> گزارش روزانه‌ی همین حالا</Button>
          </div>
          {notice && <p className="text-xs text-slate-500 mt-2" role="status">{notice}</p>}
        </Panel>
        <Panel title="مصرف هوش مصنوعی" subtitle="داستان، صفحه‌های ترجمه و بازسازی صدا" className="lg:col-span-2"
          actions={<CsvButton name="ai-usage" rows={d.ai} />}>
          <TrendChart labels={d.ai.map(r => r.day)} series={[
            { name: 'داستان', color: '#8b5cf6', points: d.ai.map(r => r.stories) },
            { name: 'ترجمه (صفحه)', color: '#0ea5e9', points: d.ai.map(r => r.translate) },
            { name: 'صدا (صفحه)', color: '#f59e0b', points: d.ai.map(r => r.audio) },
          ]} />
          {d.tts.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-500 mb-2">کاراکترهای TTS در ماه</h4>
              <BarList color="#f59e0b" items={d.tts.map(t => ({ label: t.month, value: t.chars }))} />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="خطاهای اخیر" subtitle="همان‌هایی که در تلگرام اعلام شدند">
          <DataGrid rows={d.errors} empty="خطایی ثبت نشده 🎉" columns={[
            { key: 'kind', label: 'نوع', render: r => <Badge tone={r.kind === 'crash' ? 'red' : r.kind === 'ai' ? 'violet' : 'amber'}>{r.kind}</Badge> },
            { key: 'detail', label: 'جزئیات', render: r => <span className="ltr block truncate max-w-[260px]" title={r.detail}>{r.detail}</span> },
            { key: 'suppressed', label: 'تکرار', align: 'end' },
            { key: 'last_at', label: 'آخرین', align: 'end', render: r => new Date(r.last_at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) },
          ]} />
        </Panel>
        <Panel title="اجراها و استقرارها" subtitle="هر بار که بک‌اند بالا آمد">
          <DataGrid rows={d.deploys} empty="هنوز ثبت نشده (از این نسخه به بعد ثبت می‌شود)" columns={[
            { key: 'at', label: 'زمان', render: r => new Date(r.at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) },
            { key: 'version', label: 'نسخه', render: r => <span className="ltr">{r.version || '—'}</span> },
            { key: 'migrations', label: 'مایگریشن', render: r => r.migrations.length
              ? <span className="ltr text-[11px]" title={r.migrations.join(', ')}>{r.migrations.length > 3 ? `${r.migrations.slice(-3).join(', ')} (+${r.migrations.length - 3})` : r.migrations.join(', ')}</span>
              : '—' },
          ]} />
        </Panel>
      </div>

      <Panel title="بزرگ‌ترین جدول‌ها">
        <DataGrid rows={d.database.tables} columns={[
          { key: 'name', label: 'جدول', render: r => <span className="ltr">{r.name}</span> },
          { key: 'rows', label: 'ردیف (تقریبی)', align: 'end' },
          { key: 'bytes', label: 'حجم', align: 'end', render: r => bytes(r.bytes) },
        ]} />
      </Panel>
    </div>
  )
}
