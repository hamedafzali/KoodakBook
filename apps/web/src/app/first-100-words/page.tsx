import type { Metadata } from "next";
import Link from "next/link";
import { wordEmoji } from "@koodakbook/shared";
import {
  TapToHearExplorer,
  type ExplorerItem,
} from "@/components/public/TapToHearExplorer";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const WORD_COUNT = 100;

// force-dynamic, not a static/ISR export: see /alphabet/page.tsx for why
// (the Docker build stage has no backend container up to fetch from).
export const dynamic = "force-dynamic";
const revalidate = 3600;

export const metadata: Metadata = {
  title: "۱۰۰ کلمه اول فارسی برای کودکان — رایگان و بدون ثبت‌نام | کودک‌بوک",
  description:
    "۱۰۰ کلمه پرکاربرد فارسی، هر کدام با تصویر و صدای واقعی — رایگان، بدون نیاز به حساب کاربری. همان واژگانی که کودک‌بوک برای شروع آموزش فارسی به کار می‌برد.",
  alternates: { canonical: `${SITE_URL}/first-100-words` },
  openGraph: {
    title: "۱۰۰ کلمه اول فارسی برای کودکان — رایگان",
    description:
      "۱۰۰ واژه پرکاربرد، هر کدام با تصویر و صدای واقعی. بزن و بشنو — بدون ثبت‌نام.",
    type: "website",
    locale: "fa_IR",
    url: "/first-100-words",
    images: [
      {
        url: "/og/koodakbook-og.png",
        width: 512,
        height: 512,
        alt: "۱۰۰ کلمه اول فارسی — کودک‌بوک",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "۱۰۰ کلمه اول فارسی برای کودکان — رایگان",
    description:
      "۱۰۰ واژه پرکاربرد، هر کدام با تصویر و صدای واقعی. بزن و بشنو — بدون ثبت‌نام.",
    images: ["/og/koodakbook-og.png"],
  },
};

interface PublicWord {
  id: string;
  persian: string;
  english: string;
  finglish: string | null;
  stage: number;
  audio_url: string | null;
  image_url: string | null;
}

async function getFirst100Words(): Promise<PublicWord[]> {
  // See /alphabet/page.tsx's getLetters() for why this is wrapped: fetch()
  // throws on a connection failure rather than just returning a bad response.
  try {
    // ?order=curriculum: the words the lessons teach, in the order a child
    // meets them (animals, colours, family, body, food, numbers, …). The old
    // "stage, then alphabetical" sort made the first hundred all start with
    // آ–ط, which is not what a child learns first.
    const res = await fetch(`${BACKEND_URL}/api/words?order=curriculum`, {
      next: { revalidate },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const words: PublicWord[] = json.data ?? [];
    // A spelling can exist twice in the word bank (نه "no" and نه "nine",
    // آفتاب "sun"/"sunshine"): show each Persian word once, at its first
    // place in the curriculum.
    const seen = new Set<string>();
    return words
      .filter((w) => (seen.has(w.persian) ? false : (seen.add(w.persian), true)))
      .slice(0, WORD_COUNT);
  } catch {
    return [];
  }
}

export default async function First100WordsPage() {
  const words = await getFirst100Words();

  // Each tile is the whole word under its picture (image, else emoji). It
  // used to be only the word's first letter, so sixteen ب-words showed as
  // sixteen identical «ب» tiles and the page looked like a list of
  // duplicates.
  const items: ExplorerItem[] = words.map((w) => ({
    id: w.id,
    tile: w.persian,
    tileEmoji: wordEmoji(w.english) ?? null,
    audioUrl: w.audio_url,
    ttsFallback: w.persian,
    detailTitle: w.persian,
    detailSubtitle: `${w.english}${w.finglish ? ` (${w.finglish})` : ""}`,
    detailImage: w.image_url,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: "۱۰۰ کلمه اول فارسی برای کودکان",
    description:
      "۱۰۰ واژه پرکاربرد فارسی، هر کدام قابل شنیدن با صدای واقعی و همراه با تصویر — رایگان و بدون ثبت‌نام.",
    inLanguage: "fa",
    isAccessibleForFree: true,
    learningResourceType: "reference",
    educationalUse: "instruction",
    audience: { "@type": "EducationalAudience", educationalRole: "child" },
    url: `${SITE_URL}/first-100-words`,
    hasPart: {
      "@type": "ItemList",
      numberOfItems: words.length,
      itemListElement: words.map((w, i) => ({
        "@type": "CreativeWork",
        position: i + 1,
        name: w.persian,
        alternateName: w.english,
        ...(w.audio_url
          ? { audio: { "@type": "AudioObject", contentUrl: w.audio_url } }
          : {}),
      })),
    },
  };

  return (
    <div className="min-h-screen bg-warm-white">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-brand-gradient-br text-white">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-8 text-center">
          {/* Every other public page here (alphabet, privacy, terms) has a
              way back to "/" — this one didn't (its only outbound link went
              sideways to /alphabet, never home), a real dead end for anyone
              who landed here straight from search with no browser-back
              history. Matches privacy/terms's own "→ بازگشت" wording. */}
          <Link href="/" className="text-sm text-white/90 font-bold hover:underline">
            → بازگشت به صفحه‌ی اصلی
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold mt-4">
            ۱۰۰ کلمه اول فارسی
          </h1>
          <p className="mt-2 text-white/90 text-sm sm:text-base">
            با تصویر و صدای واقعی · بزن و بشنو · رایگان و بدون ثبت‌نام
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 -mt-5 pb-16">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-4 sm:p-6">
          {words.length === 0 ? (
            <p className="text-center text-slate-500 py-10">
              در حال حاضر نمی‌توان کلمات را بارگذاری کرد.
            </p>
          ) : (
            <TapToHearExplorer
              tileStyle="word"
              items={items}
              nudgeText="دوست داشتی؟ برای پیگیری پیشرفت فرزندت، رایگان ثبت‌نام کن."
            />
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500 max-w-md mx-auto">
          این همان ۱۰۰ کلمه اولی است که کودک‌بوک برای شروع آموزش فارسی استفاده
          می‌کند.{" "}
          <a
            href="/alphabet"
            className="text-brand-text font-bold hover:underline"
          >
            الفبای فارسی را هم امتحان کن
          </a>
        </p>
      </main>
    </div>
  );
}
