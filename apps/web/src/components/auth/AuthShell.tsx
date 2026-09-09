import Link from 'next/link'
import { Icon, type IconName } from '@/components/icons'

/* Themed shell for the auth pages. Login and signup deliberately look
 * DIFFERENT (color, illustration, copy) — with the same panel users mixed the
 * two pages up. Login = warm amber "welcome back"; signup = fresh green
 * "start the adventure". */

type Variant = 'login' | 'signup'

const THEME: Record<Variant, {
  page: string
  panel: string
  logoHover: string
  headline: string
  points: { icon: IconName; text: string }[]
  chips: { icon: IconName; text: string }[]
  badge: string
}> = {
  login: {
    page: 'bg-amber-50',
    panel: 'bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500',
    logoHover: 'hover:opacity-90',
    headline: 'هر شب یک قصه‌ی فارسی،\nهر روز چند واژه‌ی تازه',
    points: [
      { icon: 'stories' as IconName, text: 'داستان‌هایی که قهرمانش کودک شماست' },
      { icon: 'phonics' as IconName, text: 'الفبا و صداکشی با صدای درست فارسی' },
      { icon: 'rewards' as IconName, text: 'بازی، ستاره و نشان — نه کلاس درس' },
    ],
    chips: [
      { icon: 'noAds' as IconName, text: 'بدون تبلیغات' },
      { icon: 'locked' as IconName, text: 'حالت کودک با پین والدین' },
      { icon: 'listen' as IconName, text: 'تمام محتوا با صدای فارسی' },
    ],
    badge: 'ورود',
  },
  signup: {
    page: 'bg-emerald-50',
    panel: 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600',
    logoHover: 'hover:opacity-90',
    headline: 'ماجراجویی فارسی\nاز همین‌جا شروع می‌شود',
    points: [
      { icon: 'timer' as IconName, text: 'ساخت حساب فقط ۲ دقیقه طول می‌کشد' },
      { icon: 'placement' as IconName, text: 'کودک را اضافه کنید — آزمون کوتاه، سطحش را پیدا می‌کند' },
      { icon: 'night' as IconName, text: 'اولین قصه همین امشب آماده است' },
    ],
    chips: [
      { icon: 'doneCircle' as IconName, text: 'رایگان برای همیشه' },
      { icon: 'noAds' as IconName, text: 'بدون کارت بانکی' },
      { icon: 'locked' as IconName, text: 'امن برای کودک' },
    ],
    badge: 'ثبت‌نام',
  },
}

/** Login scene: open book under moon and stars (bedtime story). */
function StoryScene() {
  return (
    <svg viewBox="0 0 360 240" className="w-full max-w-sm mx-auto" role="img"
      aria-label="کتاب باز با حروف فارسی و ستاره‌ها">
      <circle cx="308" cy="44" r="22" fill="#fef3c7" />
      <circle cx="298" cy="38" r="20" fill="#f59e0b" opacity="0.15" />
      <g transform="translate(36 32)" className="text-amber-300 fill-amber-300"><Icon name="star" size={17} /></g>
      <g transform="translate(92 16)" className="text-amber-200"><Icon name="sparkle" size={12} /></g>
      <g transform="translate(246 78)" className="text-amber-200"><Icon name="sparkle" size={14} /></g>
      <text x="120" y="70" fontSize="30" fontWeight="bold" fill="#fbbf24" opacity="0.9">ب</text>
      <text x="170" y="48" fontSize="24" fontWeight="bold" fill="#fda4af" opacity="0.9">آ</text>
      <text x="212" y="76" fontSize="27" fontWeight="bold" fill="#93c5fd" opacity="0.9">م</text>
      <text x="158" y="100" fontSize="21" fontWeight="bold" fill="#86efac" opacity="0.9">د</text>
      <path d="M60 150 Q120 122 180 145 Q240 122 300 150 L300 200 Q240 176 180 196 Q120 176 60 200 Z" fill="#fff" />
      <path d="M60 150 Q120 122 180 145 L180 196 Q120 176 60 200 Z" fill="#fffbeb" />
      <path d="M180 145 L180 196" stroke="#fde68a" strokeWidth="3" />
      <path d="M60 150 Q120 122 180 145 Q240 122 300 150" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <path d="M84 162 q44 -14 82 -4 M84 176 q44 -14 82 -4" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M194 158 q44 -10 82 0 M194 172 q44 -10 82 0" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="180" cy="216" rx="120" ry="10" fill="#f59e0b" opacity="0.12" />
    </svg>
  )
}

/** Signup scene: hot-air balloon lifting a basket of books (new adventure). */
function BalloonScene() {
  return (
    <svg viewBox="0 0 360 240" className="w-full max-w-sm mx-auto" role="img"
      aria-label="بالن در حال پرواز با سبدی از کتاب‌ها">
      {/* sun + clouds */}
      <circle cx="52" cy="42" r="18" fill="#fef9c3" />
      <ellipse cx="290" cy="50" rx="34" ry="12" fill="#ffffff" opacity="0.85" />
      <ellipse cx="268" cy="58" rx="24" ry="10" fill="#ffffff" opacity="0.7" />
      <ellipse cx="86" cy="110" rx="28" ry="10" fill="#ffffff" opacity="0.6" />
      <g transform="translate(296 108)" className="text-white/70"><Icon name="sparkle" size={14} /></g>
      <text x="48" y="160" fontSize="16">⭐</text>
      {/* balloon envelope */}
      <path d="M180 24c-42 0-64 30-64 58 0 34 34 52 48 72h32c14-20 48-38 48-72 0-28-22-58-64-58z" fill="#fff" />
      <path d="M180 24c-16 0-26 34-26 58 0 32 12 54 18 72h16c6-18 18-40 18-72 0-24-10-58-26-58z" fill="#fbbf24" />
      <path d="M180 24c-42 0-64 30-64 58 0 34 34 52 48 72" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
      <path d="M180 24c42 0 64 30 64 58 0 34-34 52-48 72" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
      {/* ropes */}
      <path d="M164 154l-6 26M196 154l6 26" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      {/* basket of books */}
      <rect x="150" y="178" width="60" height="34" rx="8" fill="#d97706" />
      <rect x="150" y="178" width="60" height="10" rx="5" fill="#b45309" />
      <rect x="158" y="164" width="14" height="18" rx="3" fill="#34d399" transform="rotate(-8 165 173)" />
      <rect x="174" y="162" width="14" height="20" rx="3" fill="#f472b6" />
      <rect x="190" y="164" width="14" height="18" rx="3" fill="#93c5fd" transform="rotate(8 197 173)" />
      {/* flag */}
      <path d="M180 8v18" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" />
      <path d="M180 9l20 5-20 6z" fill="#f43f5e" />
      <ellipse cx="180" cy="224" rx="90" ry="8" fill="#0d9488" opacity="0.12" />
    </svg>
  )
}

export default function AuthShell({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  const t = THEME[variant]
  return (
    <div className={`min-h-screen grid lg:grid-cols-2 ${t.page}`}>

      {/* Branding / story panel (desktop) */}
      <aside className={`hidden lg:flex flex-col justify-center ${t.panel} text-white p-12 relative overflow-hidden`}>
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className={`inline-flex items-center gap-2 font-bold text-2xl ${t.logoHover}`}><Icon name="book" size="lg" />کودک‌بوک</Link>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">{t.badge}</span>
          </div>
          {variant === 'login' ? <StoryScene /> : <BalloonScene />}
          <h2 className="text-2xl font-bold mt-8 leading-snug whitespace-pre-line">{t.headline}</h2>
          <ul className="mt-6 space-y-3">
            {t.points.map(p => (
              <li key={p.text} className="flex items-center gap-3 text-white/90">
                <span className="bg-white/15 rounded-xl w-10 h-10 flex items-center justify-center shrink-0"><Icon name={p.icon} size="md" /></span>
                <span className="text-sm">{p.text}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/70">
            {t.chips.map(c => (
              <li key={c.text} className="inline-flex items-center gap-1.5"><Icon name={c.icon} size="xs" />{c.text}</li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <Link href="/" className={`lg:hidden inline-flex items-center gap-2 font-bold text-lg ${variant === 'login' ? 'text-amber-600' : 'text-emerald-600'}`}><Icon name="book" size="md" />کودک‌بوک</Link>
          <Link href="/" className="mr-auto text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1.5 py-2">
            بازگشت به سایت
            <span aria-hidden="true">←</span>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center py-6">
          {children}
        </div>
      </div>
    </div>
  )
}
