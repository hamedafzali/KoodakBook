import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

/* /app — install KoodakBook on a phone outside the app stores.
 *
 * Android: a direct APK download (the newest PUBLISHED row of app_releases,
 * via GET /api/app/latest — routes/appReleases.ts in the backend).
 * iPhone/iPad: Apple doesn't allow installing apps from a file, so the
 * honest option is the web app added to the Home Screen (it's a PWA:
 * public/manifest.json, standalone display). */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Same reasoning as /alphabet: no backend during `next build`, so render per
// request and let the fetch cache for a couple of minutes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "نصب اپ کودک‌بوک روی گوشی و تبلت | کودک‌بوک",
  description:
    "کودک‌بوک را روی گوشی یا تبلت اندروید نصب کنید، یا روی آیفون و آیپد به صفحه‌ی اصلی اضافه کنید — رایگان و بدون تبلیغ.",
  alternates: { canonical: `${SITE_URL}/app` },
  openGraph: {
    title: "اپ کودک‌بوک برای اندروید، آیفون و آیپد",
    description: "دانلود مستقیم برای اندروید و راهنمای نصب روی آیفون و آیپد.",
    type: "website",
    locale: "fa_IR",
    url: "/app",
    images: [{ url: "/og/koodakbook-og.png", width: 512, height: 512, alt: "کودک‌بوک" }],
  },
};

interface Release {
  version_name: string;
  version_code: number;
  download_url: string;
  file_bytes: number | null;
  sha256: string | null;
  notes: string | null;
  published_at: string | null;
}

async function getLatest(): Promise<Release | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/app/latest`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

const fa = (n: number) => n.toLocaleString("fa-IR");
const mb = (b: number) => `${(b / (1024 * 1024)).toLocaleString("fa-IR", { maximumFractionDigits: 0 })} مگابایت`;

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-sm grid place-items-center shrink-0">
            {fa(i + 1)}
          </span>
          <span className="text-sm text-slate-700 leading-7">{t}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function AppPage() {
  const release = await getLatest();
  const published = release?.published_at
    ? new Date(release.published_at).toLocaleDateString("fa-IR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-warm-white">
      <header className="bg-brand-gradient-br text-on-brand">
        <div className="max-w-3xl mx-auto px-5 pt-10 pb-10 text-center">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-white/40 mb-3">
            <Icon name="mobile" size={28} />
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold">کودک‌بوک روی گوشی و تبلت</h1>
          <p className="mt-2 text-sm sm:text-base">
            رایگان · بدون تبلیغ · همان حساب کاربری سایت
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 -mt-6 pb-16 space-y-5">
        {/* Android */}
        <section aria-labelledby="android" className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 sm:p-7">
          <div className="flex items-start gap-3 flex-wrap">
            <div>
              <h2 id="android" className="text-xl font-extrabold text-slate-800">اندروید (گوشی و تبلت)</h2>
              {release ? (
                <p className="text-xs text-slate-500 mt-1">
                  نسخه‌ی <span dir="ltr">{release.version_name}</span>
                  {published ? `، ${published}` : ""}
                  {release.file_bytes ? `، ${mb(release.file_bytes)}` : ""}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">نسخه‌ی اندروید به‌زودی این‌جا منتشر می‌شود.</p>
              )}
            </div>
            {release && (
              <a href={release.download_url} download
                className="btn-brand ms-auto inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold text-base">
                <Icon name="save" size={20} /> دانلود اپ اندروید
              </a>
            )}
          </div>

          {release?.notes && (
            <p className="mt-4 text-sm bg-amber-50 rounded-2xl px-4 py-3 text-slate-700">
              <span className="font-bold">تازه‌های این نسخه: </span>{release.notes}
            </p>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">نصب در چهار قدم</h3>
            <Steps items={[
              "روی «دانلود اپ اندروید» بزنید و صبر کنید دانلود تمام شود.",
              "فایل دانلودشده (koodakbook…apk) را از اعلان‌ها یا پوشه‌ی دانلودها باز کنید.",
              "اگر گوشی پرسید، برای مرورگرتان «اجازه‌ی نصب از این منبع» را روشن کنید و برگردید.",
              "«نصب» را بزنید، بعد اپ را باز کنید و با همان ایمیل و رمز سایت وارد شوید.",
            ]} />
          </div>

          <p className="mt-5 text-xs text-slate-500 leading-6">
            این نسخه مستقیم از سایت خود کودک‌بوک پخش می‌شود و هنوز در گوگل‌پلی نیست؛ برای همین گوشی
            ممکن است یک هشدار عمومی نشان دهد. نسخه‌های تازه را هم از همین صفحه بگیرید — اپ در بخش والدین
            خبر می‌دهد که نسخه‌ی تازه آمده است.
          </p>
          {release?.sha256 && (
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer">بررسی اصالت فایل (SHA-256)</summary>
              <code dir="ltr" className="block mt-2 break-all bg-slate-50 rounded-lg p-2">{release.sha256}</code>
            </details>
          )}
        </section>

        {/* iPhone / iPad */}
        <section aria-labelledby="ios" className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 sm:p-7">
          <h2 id="ios" className="text-xl font-extrabold text-slate-800">آیفون و آیپد</h2>
          <p className="text-xs text-slate-500 mt-1">
            اپل نصب اپ از فایل را اجازه نمی‌دهد؛ اما کودک‌بوک را می‌شود مثل یک اپ به صفحه‌ی اصلی اضافه کرد —
            تمام‌صفحه و با آیکون خودش.
          </p>
          <div className="mt-5">
            <Steps items={[
              "همین سایت را در «سافاری» باز کنید (نه در اینستاگرام یا تلگرام).",
              "دکمه‌ی «اشتراک‌گذاری» (مربع با فلش رو به بالا) را بزنید.",
              "«افزودن به صفحه‌ی اصلی» (Add to Home Screen) را انتخاب کنید و «افزودن» را بزنید.",
              "از آیکون کودک‌بوک روی صفحه‌ی اصلی وارد شوید.",
            ]} />
          </div>
          <Link href="/login" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-text hover:underline">
            ورود به کودک‌بوک <Icon name="arrowNext" size={16} />
          </Link>
        </section>

        <p className="text-center text-sm text-slate-500">
          نصب نشد یا سؤالی دارید؟{" "}
          <Link href="/#contact" className="text-brand-text font-bold hover:underline">برایمان بنویسید</Link>
          {" · "}
          <Link href="/#faq" className="text-brand-text font-bold hover:underline">سؤالات پرتکرار</Link>
        </p>
      </main>
    </div>
  );
}
