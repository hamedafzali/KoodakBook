import type { Metadata } from 'next'
import { TapToHearExplorer, type ExplorerItem } from '@/components/public/TapToHearExplorer'

// Server-side fetch talks straight to the backend (Docker service name in
// prod, localhost in dev) — the /api/* rewrite in next.config exists for the
// browser, not for a server component's own fetch.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// force-dynamic, not a static/ISR export: the Docker build stage that runs
// `next build` has no backend container up yet, so a build-time fetch would
// break every deploy (confirmed — it does). Rendering per-request instead;
// the fetch's own `next.revalidate` below still caches the actual data for
// an hour, so this doesn't mean hitting the DB on every visit.
export const dynamic = 'force-dynamic'
const revalidate = 3600

export const metadata: Metadata = {
  title: 'الفبای فارسی برای کودکان — رایگان و بدون ثبت‌نام | کودک‌بوک',
  description:
    '۳۲ حرف الفبای فارسی را با صدای واقعی بشنوید و تمرین کنید — رایگان، بدون نیاز به حساب کاربری. مناسب کودکان فارسی‌زبان خارج از ایران که می‌خواهند الفبا یاد بگیرند.',
  alternates: { canonical: '/alphabet' },
  openGraph: {
    title: 'الفبای فارسی برای کودکان — رایگان',
    description: '۳۲ حرف، هر کدام با صدای واقعی. بزن و بشنو — بدون ثبت‌نام.',
    type: 'website',
    locale: 'fa_IR',
    url: '/alphabet',
    images: [{ url: '/og/koodakbook-og.png', width: 512, height: 512, alt: 'الفبای فارسی — کودک‌بوک' }],
  },
  twitter: {
    card: 'summary',
    title: 'الفبای فارسی برای کودکان — رایگان',
    description: '۳۲ حرف، هر کدام با صدای واقعی. بزن و بشنو — بدون ثبت‌نام.',
    images: ['/og/koodakbook-og.png'],
  },
}

interface LetterWithExample {
  id: string
  character: string
  name_persian: string
  name_english: string
  audio_url: string | null
  example_word: {
    persian: string
    english: string
    finglish: string | null
    audio_url: string | null
    image_url: string | null
  } | null
}

async function getLetters(): Promise<LetterWithExample[]> {
  // A public marketing page degrading to "couldn't load right now" beats a
  // 500 — fetch() throws outright on a connection failure (backend down,
  // network blip), it doesn't just return a non-ok response, so that has to
  // be caught here too, not only the !res.ok case.
  try {
    const res = await fetch(`${BACKEND_URL}/api/letters`, { next: { revalidate } })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

export default async function AlphabetPage() {
  const letters = await getLetters()

  const items: ExplorerItem[] = letters.map(l => ({
    id: l.id,
    tile: l.character,
    audioUrl: l.audio_url,
    ttsFallback: l.name_persian,
    detailTitle: l.example_word ? `${l.character} برای ${l.example_word.persian}` : l.name_persian,
    detailSubtitle: l.example_word
      ? `${l.name_english} — ${l.example_word.english}${l.example_word.finglish ? ` (${l.example_word.finglish})` : ''}`
      : l.name_english,
    detailImage: l.example_word?.image_url ?? null,
    detailEmoji: '🔤',
  }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: 'الفبای فارسی برای کودکان',
    description: 'تمام ۳۲ حرف الفبای فارسی، هر کدام قابل شنیدن با صدای واقعی — رایگان و بدون ثبت‌نام.',
    inLanguage: 'fa',
    isAccessibleForFree: true,
    learningResourceType: 'reference',
    educationalUse: 'instruction',
    audience: { '@type': 'EducationalAudience', educationalRole: 'child' },
    url: `${SITE_URL}/alphabet`,
    hasPart: {
      '@type': 'ItemList',
      numberOfItems: letters.length,
      itemListElement: letters.map((l, i) => ({
        '@type': 'CreativeWork',
        position: i + 1,
        name: l.name_persian,
        alternateName: l.name_english,
        ...(l.audio_url ? { audio: { '@type': 'AudioObject', contentUrl: l.audio_url } } : {}),
      })),
    },
  }

  return (
    <div className="min-h-screen bg-warm-white">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="bg-brand-gradient-br text-white">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold">الفبای فارسی</h1>
          <p className="mt-2 text-white/90 text-sm sm:text-base">۳۲ حرف · بزن و بشنو · رایگان و بدون ثبت‌نام</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 -mt-5 pb-16">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-4 sm:p-6">
          {letters.length === 0 ? (
            <p className="text-center text-slate-500 py-10">در حال حاضر نمی‌توان حروف را بارگذاری کرد.</p>
          ) : (
            <TapToHearExplorer
              items={items}
              nudgeText="دوست داشتی؟ برای پیگیری پیشرفت فرزندت، رایگان ثبت‌نام کن."
            />
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500 max-w-md mx-auto">
          کودک‌بوک آموزش فارسی را با صداکشی (ترکیب صداها) شروع می‌کند — همان روشی که علم خواندن آن را تأیید کرده.{' '}
          <a href="/" className="text-brand-text font-bold hover:underline">درباره کودک‌بوک بیشتر بدانید</a>
        </p>
      </main>
    </div>
  )
}
