import Link from 'next/link'

/* Shared shell for login/signup: a branded story-panel next to the form, and
 * an always-visible way back to the marketing site (users kept getting
 * stranded on the bare form). The form pages stay dumb cards. */

const POINTS = [
  { icon: '📖', text: 'داستان‌هایی که قهرمانش کودک شماست' },
  { icon: '🎵', text: 'الفبا و صداکشی با صدای درست فارسی' },
  { icon: '🏆', text: 'بازی، ستاره و نشان — نه کلاس درس' },
]

/** Bedtime-story scene: open book, rising letters, moon and stars. */
function StoryScene() {
  return (
    <svg viewBox="0 0 360 240" className="w-full max-w-sm mx-auto" role="img"
      aria-label="کتاب باز با حروف فارسی و ستاره‌ها">
      {/* moon + stars */}
      <circle cx="308" cy="44" r="22" fill="#fef3c7" />
      <circle cx="298" cy="38" r="20" fill="#f59e0b" opacity="0.15" />
      <text x="40" y="46" fontSize="18">⭐</text>
      <text x="96" y="26" fontSize="12">✨</text>
      <text x="250" y="90" fontSize="14">✨</text>
      {/* rising letters */}
      <text x="120" y="70" fontSize="30" fontWeight="bold" fill="#fbbf24" opacity="0.9">ب</text>
      <text x="170" y="48" fontSize="24" fontWeight="bold" fill="#fda4af" opacity="0.9">آ</text>
      <text x="212" y="76" fontSize="27" fontWeight="bold" fill="#93c5fd" opacity="0.9">م</text>
      <text x="158" y="100" fontSize="21" fontWeight="bold" fill="#86efac" opacity="0.9">د</text>
      {/* open book */}
      <path d="M60 150 Q120 122 180 145 Q240 122 300 150 L300 200 Q240 176 180 196 Q120 176 60 200 Z" fill="#fff" />
      <path d="M60 150 Q120 122 180 145 L180 196 Q120 176 60 200 Z" fill="#fffbeb" />
      <path d="M180 145 L180 196" stroke="#fde68a" strokeWidth="3" />
      <path d="M60 150 Q120 122 180 145 Q240 122 300 150" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      {/* text lines on pages */}
      <path d="M84 162 q44 -14 82 -4 M84 176 q44 -14 82 -4" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M194 158 q44 -10 82 0 M194 172 q44 -10 82 0" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* ground shadow */}
      <ellipse cx="180" cy="216" rx="120" ry="10" fill="#f59e0b" opacity="0.12" />
    </svg>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-amber-50">

      {/* Branding / story panel (desktop) */}
      <aside className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white p-12 relative overflow-hidden">
        <div className="max-w-md mx-auto w-full">
          <Link href="/" className="inline-block font-bold text-2xl mb-10 hover:opacity-90">📚 کودک‌بوک</Link>
          <StoryScene />
          <h2 className="text-2xl font-bold mt-8 leading-snug">
            هر شب یک قصه‌ی فارسی،<br />هر روز چند واژه‌ی تازه
          </h2>
          <ul className="mt-6 space-y-3">
            {POINTS.map(p => (
              <li key={p.text} className="flex items-center gap-3 text-amber-50">
                <span className="text-xl bg-white/15 rounded-xl w-10 h-10 flex items-center justify-center shrink-0" aria-hidden="true">{p.icon}</span>
                <span className="text-sm">{p.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-amber-100/80">🚫 بدون تبلیغات &nbsp;·&nbsp; 🔒 حالت کودک با پین والدین &nbsp;·&nbsp; 🇮🇷 تمام محتوا با صدای فارسی</p>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between">
          {/* Mobile logo (panel hidden) + always-visible way back to the site */}
          <Link href="/" className="lg:hidden font-bold text-lg text-amber-600">📚 کودک‌بوک</Link>
          <Link href="/" className="mr-auto text-sm font-bold text-slate-500 hover:text-amber-600 flex items-center gap-1.5 py-2">
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
