import Link from 'next/link'
import { TabletForm, WaitlistForm } from './LeadForms'
import Pricing from './Pricing'
import VoiceDemo from './VoiceDemo'

/* Public marketing landing (server-rendered for SEO).
 * Audience: Iranian parents abroad deciding whether this is safe + effective
 * for their child. Structure follows education-landing best practice:
 * value → proof → method → trust → price → offers → FAQ. */

// ── Content (single source of truth for the page copy) ─────

const STATS = [
  { n: '۳۲', l: 'حرف الفبا با صدا و تمرین نوشتن' },
  { n: '۱۳۰+', l: 'هجا و صداکِشی (بَ بِ بُ …)' },
  { n: '۲۵۰+', l: 'واژه با صدا و مرور هوشمند' },
  { n: '∞', l: 'داستان شخصی با هوش مصنوعی' },
]

const FEATURES = [
  { icon: '📚', title: 'درس‌های مرحله‌ای', text: 'واژگان در ۴ مرحله — حیوانات، خانواده، بدن، رنگ‌ها… هر درس کوتاه، رنگی و بازی‌گونه.' },
  { icon: '✏️', title: 'الفبا و نوشتن', text: 'هر ۳۲ حرف با صدای درست، شکل حرف در اول/وسط/آخر و تمرین نوشتن با انگشت.' },
  { icon: '🎵', title: 'صداکِشی (فونیکس)', text: 'زبر، زیر، پیش — بچه‌ها صدای حرف‌ها را می‌شنوند و ترکیب می‌کنند؛ پایه‌ی واقعی خواندن.' },
  { icon: '🔄', title: 'مرور هوشمند', text: 'تکرار فاصله‌دار (Spaced Repetition): هر واژه دقیقاً وقتی برمی‌گردد که در آستانه‌ی فراموشی است.' },
  { icon: '🎤', title: 'تمرین گفتن', text: 'کودک واژه را بلند می‌گوید و نرم‌افزار با تشخیص گفتار می‌شنود — تلفظ همان‌جا تمرین می‌شود.' },
  { icon: '📖', title: 'داستان با اسم کودک شما', text: 'هوش مصنوعی داستانی می‌سازد که قهرمانش کودک شماست — متناسب با سن و سطح، با صدای گوینده.' },
  { icon: '🏆', title: 'جایزه و نشان', text: 'ستاره‌ها، نشان‌ها و دستاوردها انگیزه را نگه می‌دارند؛ پیشرفت برای کودک قابل‌لمس می‌شود.' },
  { icon: '🧭', title: 'آزمون تعیین سطح', text: 'در شروع، یک بازی کوتاه سطح کودک را می‌سنجد تا از جای درست شروع کند — نه آسان‌تر، نه سخت‌تر.' },
]

const METHOD = [
  {
    icon: '🔤', title: 'اول صدا، بعد حرف',
    text: 'پژوهش‌های علم خواندن (Science of Reading) روشن است: بچه‌ها با شنیدن و ترکیب صداها خواندن را یاد می‌گیرند، نه با حفظ شکل کلمه‌ها. صداکشی ستون این نرم‌افزار است.',
  },
  {
    icon: '🧠', title: 'تکرار در لحظه‌ی درست',
    text: 'حافظه با تکرارِ فاصله‌دار می‌ماند. کودک‌بوک هر واژه را درست قبل از فراموشی برمی‌گرداند — همان روشی که در بهترین نرم‌افزارهای زبان دنیا استفاده می‌شود.',
  },
  {
    icon: '💛', title: 'قصه به‌جای درس',
    text: 'کودک با قصه‌ای که قهرمانش خودش است، واژه‌ها را در بافت واقعی می‌بیند و می‌شنود. یادگیری بدون احساس «کلاس» — همان‌طور که زبان مادری یاد گرفته می‌شود.',
  },
  {
    icon: '🌍', title: 'چندزبانی یک هدیه است',
    text: 'چندزبانی با تمرکز، انعطاف ذهنی و مهارت حل مسئله همراه است — و مهم‌تر: پیوند کودک با مادربزرگ، پدربزرگ و هویتش. روزی ۱۰ دقیقه کافی است.',
  },
]

const PARENT_POINTS = [
  { icon: '🔒', title: 'حالت کودک با پین والدین', text: 'کودک داخل بخش خودش می‌ماند؛ تنظیمات و خرید فقط با پین شما باز می‌شود.' },
  { icon: '🚫', title: 'بدون تبلیغات', text: 'هیچ تبلیغی، هیچ لینک خروجی، هیچ خرید پنهانی — صفحه‌ی کودک فقط محتواست.' },
  { icon: '📊', title: 'داشبورد پیشرفت', text: 'می‌بینید امروز چه تمرین کرده، کدام واژه‌ها را بلد است و کجا گیر کرده.' },
  { icon: '👨‍👩‍👧‍👦', title: 'تا ۵ کودک', text: 'هر فرزند پروفایل، سطح و مسیر خودش را دارد — با یک اشتراک خانواده.' },
]

const FAQ = [
  {
    q: 'برای چه سنی مناسب است؟',
    a: 'طراحی اصلی برای ۳ تا ۱۰ سال است. آزمون تعیین سطحِ شروع، مسیر را با سن و دانسته‌های کودک تنظیم می‌کند — از «اصلاً فارسی نشنیده» تا «حرف می‌زند ولی نمی‌خواند».',
  },
  {
    q: 'کودکم اصلاً فارسی بلد نیست. باز هم جواب می‌دهد؟',
    a: 'بله — مسیر از صفر شروع می‌شود: اول شنیدن و گفتن واژه‌های ساده با تصویر، بعد صداها و حروف، بعد خواندن. همه‌چیز صدا دارد و به خواندنِ والدین وابسته نیست.',
  },
  {
    q: 'روی چه دستگاه‌هایی کار می‌کند؟',
    a: 'همین حالا در مرورگر هر موبایل، تبلت و کامپیوتری کار می‌کند و می‌توانید آن را مثل یک نرم‌افزار به صفحه‌ی اصلی اضافه کنید. نرم‌افزار اندروید و iOS هم در راه است.',
  },
  {
    q: 'وقت من به‌عنوان والد چقدر گرفته می‌شود؟',
    a: 'تقریباً هیچ. کودک مستقل کار می‌کند؛ شما فقط گاهی داشبورد را نگاه می‌کنید. البته «هم‌خوانی» داستان‌ها با هم، بهترین بخش ماجراست — اگر وقتش را داشته باشید.',
  },
  {
    q: 'اشتراک را می‌توانم لغو کنم؟',
    a: 'بله، هر زمان و بدون هیچ شرطی. نسخه‌ی رایگان هم همیشه رایگان می‌ماند — حروف، صداکشی و درس‌های پایه در آن باز است.',
  },
  {
    q: 'اطلاعات کودک من امن است؟',
    a: 'فقط نام کوچک و سال تولد را می‌گیریم — نه عکس، نه موقعیت مکانی. داده‌ها به هیچ شرکت تبلیغاتی داده نمی‌شود. جزئیات در صفحه‌ی حریم خصوصی آمده است.',
  },
]

// ── Small building blocks ──────────────────────────────────

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      <p className="text-amber-600 font-bold text-sm mb-2">{kicker}</p>
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-snug">{title}</h2>
      {sub && <p className="text-slate-500 mt-3 leading-relaxed">{sub}</p>}
    </div>
  )
}

/** Hand-drawn tablet mockup showing a phonics screen — no external images. */
function TabletMock() {
  return (
    <svg viewBox="0 0 320 420" className="w-full max-w-xs mx-auto drop-shadow-xl" role="img"
      aria-label="نمای نرم‌افزار کودک‌بوک روی تبلت: تمرین صداکشی حرف ب">
      <rect x="8" y="8" width="304" height="404" rx="28" fill="#1e293b" />
      <rect x="20" y="20" width="280" height="380" rx="18" fill="#fffbeb" />
      {/* header */}
      <rect x="20" y="20" width="280" height="56" rx="18" fill="#f59e0b" />
      <rect x="20" y="58" width="280" height="18" fill="#f59e0b" />
      <text x="160" y="55" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#fff">صداها 🎵</text>
      {/* big letter card */}
      <rect x="70" y="100" width="180" height="130" rx="20" fill="#fff" stroke="#fde68a" strokeWidth="3" />
      <text x="160" y="185" textAnchor="middle" fontSize="72" fontWeight="bold" fill="#b45309">بَ</text>
      <circle cx="230" cy="120" r="14" fill="#fbbf24" />
      <text x="230" y="126" textAnchor="middle" fontSize="14">🔊</text>
      {/* options */}
      <rect x="45" y="255" width="108" height="52" rx="14" fill="#34d399" />
      <text x="99" y="288" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">با</text>
      <rect x="167" y="255" width="108" height="52" rx="14" fill="#818cf8" />
      <text x="221" y="288" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">بو</text>
      <rect x="45" y="318" width="108" height="52" rx="14" fill="#f472b6" />
      <text x="99" y="351" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">بی</text>
      <rect x="167" y="318" width="108" height="52" rx="14" fill="#fbbf24" />
      <text x="221" y="351" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#fff">بَه</text>
      {/* stars */}
      <text x="48" y="130" fontSize="20">⭐</text>
      <text x="36" y="230" fontSize="14">⭐</text>
    </svg>
  )
}

/** Product shot for the tablet offer: tablet in a kid-proof bumper case with a
 *  gift bow — drawn inline, no stock-photo licensing. */
function TabletProduct() {
  return (
    <svg viewBox="0 0 420 320" className="w-full max-w-md mx-auto" role="img"
      aria-label="تبلت کودک‌بوک با قاب محافظ کودک و روبان هدیه">
      {/* soft backdrop */}
      <ellipse cx="210" cy="290" rx="170" ry="18" fill="#f1f5f9" />
      {/* bumper case */}
      <rect x="40" y="40" width="340" height="230" rx="42" fill="#fb923c" />
      <rect x="46" y="46" width="328" height="218" rx="38" fill="#fdba74" />
      {/* screen */}
      <rect x="72" y="68" width="276" height="174" rx="16" fill="#fffbeb" />
      <rect x="72" y="68" width="276" height="40" rx="16" fill="#f59e0b" />
      <rect x="72" y="92" width="276" height="16" fill="#f59e0b" />
      <text x="210" y="95" textAnchor="middle" fontSize="17" fontWeight="bold" fill="#fff">کودک‌بوک 📚</text>
      {/* app tiles */}
      <rect x="92" y="122" width="72" height="52" rx="12" fill="#34d399" />
      <text x="128" y="155" textAnchor="middle" fontSize="22">🔤</text>
      <rect x="174" y="122" width="72" height="52" rx="12" fill="#818cf8" />
      <text x="210" y="155" textAnchor="middle" fontSize="22">📖</text>
      <rect x="256" y="122" width="72" height="52" rx="12" fill="#f472b6" />
      <text x="292" y="155" textAnchor="middle" fontSize="22">🎵</text>
      <rect x="92" y="184" width="72" height="42" rx="12" fill="#fbbf24" />
      <text x="128" y="212" textAnchor="middle" fontSize="20">🎤</text>
      <rect x="174" y="184" width="72" height="42" rx="12" fill="#60a5fa" />
      <text x="210" y="212" textAnchor="middle" fontSize="20">🏆</text>
      <rect x="256" y="184" width="72" height="42" rx="12" fill="#a78bfa" />
      <text x="292" y="212" textAnchor="middle" fontSize="20">✏️</text>
      {/* grip handles */}
      <circle cx="40" cy="155" r="20" fill="#fb923c" />
      <circle cx="380" cy="155" r="20" fill="#fb923c" />
      {/* gift bow */}
      <circle cx="352" cy="52" r="6" fill="#e11d48" />
      <path d="M352 52c-14-22-34-12-24 2 6 9 18 4 24-2z" fill="#f43f5e" />
      <path d="M352 52c14-22 34-12 24 2-6 9-18 4-24-2z" fill="#f43f5e" />
      <path d="M348 56l-10 26 12-8 8 10z" fill="#fb7185" />
      {/* sparkles */}
      <text x="60" y="35" fontSize="18">✨</text>
      <text x="330" y="295" fontSize="16">⭐</text>
    </svg>
  )
}

function StoreBadge({ store }: { store: 'android' | 'ios' }) {
  return (
    <div className="relative flex items-center gap-3 bg-slate-800 text-white rounded-xl px-5 py-2.5 opacity-70 cursor-default select-none"
      aria-label={`${store === 'android' ? 'Google Play' : 'App Store'} — به‌زودی`}>
      <span className="text-2xl" aria-hidden="true">{store === 'android' ? '🤖' : ''}</span>
      <span className="text-right leading-tight">
        <span className="block text-[10px] text-slate-300">به‌زودی در</span>
        <span className="block font-bold text-sm" dir="ltr">{store === 'android' ? 'Google Play' : 'App Store'}</span>
      </span>
      <span className="absolute -top-2 -left-2 bg-amber-500 text-white text-[10px] font-bold rounded-full px-2 py-0.5">به‌زودی</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="bg-white text-slate-800">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <p className="font-bold text-xl text-amber-600">📚 کودک‌بوک</p>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600" aria-label="منوی اصلی">
            <a href="#features" className="hover:text-amber-600">ویژگی‌ها</a>
            <a href="#method" className="hover:text-amber-600">روش آموزش</a>
            <a href="#parents" className="hover:text-amber-600">والدین</a>
            <a href="#pricing" className="hover:text-amber-600">قیمت</a>
            <a href="#tablet" className="hover:text-amber-600">تبلت</a>
            <a href="#faq" className="hover:text-amber-600">سؤالات</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-amber-600 px-3 py-2">ورود</Link>
            <Link href="/signup" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition">
              شروع رایگان
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight sm:leading-tight text-slate-900">
              کودک شما فارسی را<br />
              <span className="text-amber-600">با قصه و بازی</span> یاد می‌گیرد
            </h1>
            <p className="mt-5 text-slate-600 leading-relaxed text-lg">
              برای خانواده‌های ایرانی خارج از کشور — از الفبا و صداکشی تا داستان‌هایی که
              قهرمانش کودک خودتان است. روزی ۱۰ دقیقه، برای ۳ تا ۱۰ سال.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-7 py-3.5 rounded-2xl text-lg transition shadow-lg shadow-amber-200">
                شروع رایگان
              </Link>
              <a href="#features" className="border-2 border-amber-200 hover:border-amber-400 text-amber-700 font-bold px-7 py-3.5 rounded-2xl text-lg transition">
                ببینید چطور کار می‌کند
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <li>🚫 بدون تبلیغات</li>
              <li>🔒 حالت کودک با پین والدین</li>
              <li>🇮🇷 تمام محتوا با صدای فارسی</li>
            </ul>
          </div>
          <TabletMock />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.l}>
              <p className="text-3xl font-bold text-amber-600">{s.n}</p>
              <p className="text-sm text-slate-500 mt-1 leading-snug">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-20">
        <SectionTitle kicker="ویژگی‌ها" title="یک مسیر کامل، از اولین صدا تا اولین کتاب"
          sub="هشت ابزار که با هم یک برنامه‌ی درسی می‌سازند — نه مجموعه‌ای از بازی‌های پراکنده." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition">
              <p className="text-3xl mb-3" aria-hidden="true">{f.icon}</p>
              <h3 className="font-bold text-slate-800 mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method / pedagogy */}
      <section id="method" className="bg-amber-50/60 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <SectionTitle kicker="روش آموزش" title="چرا این روش جواب می‌دهد؟"
            sub="کودک‌بوک روی سه ستونِ اثبات‌شده‌ی یادگیری زبان ساخته شده — نه روی سرگرمی خالی." />
          <div className="grid sm:grid-cols-2 gap-5">
            {METHOD.map(m => (
              <div key={m.title} className="rounded-2xl bg-white border border-amber-100 p-6">
                <p className="text-3xl mb-3" aria-hidden="true">{m.icon}</p>
                <h3 className="font-bold text-slate-800 mb-2">{m.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parents / trust */}
      <section id="parents" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-20">
        <SectionTitle kicker="برای والدین" title="خیال شما راحت، کنترل دست شما"
          sub="یک نرم‌افزار کودک اول باید امن باشد، بعد آموزشی. این ترتیب را جدی گرفته‌ایم." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PARENT_POINTS.map(p => (
            <div key={p.title} className="rounded-2xl border border-slate-100 p-5 text-center">
              <p className="text-3xl mb-3" aria-hidden="true">{p.icon}</p>
              <h3 className="font-bold text-slate-800 mb-1.5 text-sm">{p.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — synced from the admin plans panel via /api/plans */}
      <section id="pricing" className="bg-slate-50 scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <SectionTitle kicker="قیمت" title="ساده و شفاف — لغو در هر لحظه"
            sub="امروز همه‌چیز با حساب رایگان شروع می‌شود؛ پلن‌های پرمیوم به‌زودی فعال می‌شوند." />
          <Pricing />
          {/* Hear-the-difference: hidden until admin generates both samples */}
          <VoiceDemo />
        </div>
      </section>

      {/* Tablet offer (coming soon — collect interest, no prices yet) */}
      <section id="tablet" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-amber-600 font-bold text-sm mb-2">
            تبلت کودک‌بوک <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full mr-1">به‌زودی</span>
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-snug">
            یک تبلت، آماده و امن — روشن کنید و بدهید دست کودک
          </h2>
          <p className="text-slate-500 mt-3 leading-relaxed">
            برای خانواده‌هایی که نمی‌خواهند موبایل خودشان را بدهند: تبلتی با کودک‌بوک
            نصب‌شده، حالت کودک قفل‌شده و بدون دسترسی باز به اینترنت. بهترین هدیه‌ی تولد
            و نوروز برای نوه و خواهرزاده و برادرزاده. 🎁
          </p>
        </div>

        {/* Packages — deliberately without prices until launch */}
        <div className="grid sm:grid-cols-3 gap-5 mb-12">
          {[
            { icon: '📦', title: 'بسته‌ی پایه', items: ['تبلت ۸ اینچ', 'کودک‌بوک نصب و تنظیم‌شده', 'حالت کودک قفل‌شده'] },
            { icon: '🛡️', title: 'بسته‌ی محافظ', items: ['تبلت ۱۰ اینچ', 'قاب ضدضربه‌ی مخصوص کودک', 'پایه‌ی رومیزی + محافظ صفحه'] },
            { icon: '🎁', title: 'بسته‌ی هدیه', items: ['بسته‌ی محافظ کامل', 'جعبه‌ی هدیه و کارت تبریک', 'ارسال مستقیم به گیرنده در اروپا'] },
          ].map(p => (
            <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-4xl mb-3" aria-hidden="true">{p.icon}</p>
              <h3 className="font-bold text-slate-800 mb-3">{p.title}</h3>
              <ul className="space-y-1.5 text-sm text-slate-500">
                {p.items.map(i => <li key={i}>{i}</li>)}
              </ul>
              <p className="mt-4 text-xs font-bold text-amber-600 bg-amber-50 rounded-full py-1.5">قیمت به‌زودی اعلام می‌شود</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <TabletProduct />
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-1">فرم علاقه‌مندی — بدون پرداخت</h3>
            <p className="text-xs text-slate-400 mb-4">ثبت‌نام کنید تا با اعلام قیمت، اول به شما خبر بدهیم و در اولویت ارسال باشید.</p>
            <TabletForm />
          </div>
        </div>
      </section>

      {/* Mobile apps */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold">نرم‌افزار موبایل در راه است 📱</h2>
            <p className="text-slate-300 mt-2 leading-relaxed max-w-lg">
              کودک‌بوک همین امروز در مرورگر موبایل و تبلت کار می‌کند (به صفحه‌ی اصلی اضافه‌اش کنید).
              نسخه‌ی اندروید و iOS با حالت آفلاین کامل در راه است — ایمیل بگذارید تا اول شما بدانید.
            </p>
            <div className="mt-5 flex gap-3">
              <StoreBadge store="android" />
              <StoreBadge store="ios" />
            </div>
          </div>
          <div className="w-full md:w-auto md:min-w-[320px]">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-4 py-16 scroll-mt-20">
        <SectionTitle kicker="سؤالات پرتکرار" title="هر چیزی که والدین از ما می‌پرسند" />
        <div className="space-y-3">
          {FAQ.map(f => (
            <details key={f.q} className="group rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-bold text-slate-800">
                {f.q}
                <span className="text-amber-500 transition group-open:rotate-45 text-xl leading-none" aria-hidden="true">+</span>
              </summary>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">فارسی، بهترین هدیه‌ای است که به کودکتان می‌دهید</h2>
          <p className="text-slate-500 mt-3">شروع رایگان است — نه کارت بانکی می‌خواهد، نه تعهدی.</p>
          <Link href="/signup" className="inline-block mt-7 bg-amber-500 hover:bg-amber-600 text-white font-bold px-10 py-4 rounded-2xl text-lg transition shadow-lg shadow-amber-200">
            ساخت حساب رایگان
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p className="font-bold text-slate-700">📚 کودک‌بوک — فارسی برای کودکان</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="پیوندهای پایانی">
            <Link href="/privacy" className="hover:text-amber-600">حریم خصوصی</Link>
            <Link href="/terms" className="hover:text-amber-600">شرایط استفاده</Link>
            <Link href="/login" className="hover:text-amber-600">ورود به نرم‌افزار</Link>
            <Link href="/signup" className="hover:text-amber-600">ثبت‌نام</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
