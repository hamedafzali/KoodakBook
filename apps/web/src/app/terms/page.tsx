import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'شرایط استفاده — کودک‌بوک',
  alternates: { canonical: '/terms' },
}

const TERMS: { h: string; t: string }[] = [
  { h: 'حساب کاربری', t: 'حساب توسط والد یا سرپرست قانونی ساخته می‌شود؛ کودکان از پروفایل کودک و در حالت کودک استفاده می‌کنند. مسئولیت نگهداری رمز و پین والدین با شماست.' },
  { h: 'اشتراک و پرداخت', t: 'نسخه‌ی رایگان همیشه رایگان است. اشتراک پرمیوم ماهانه است و هر زمان قابل لغو — پس از لغو تا پایان دوره‌ی پرداخت‌شده فعال می‌ماند و تمدید نمی‌شود.' },
  { h: 'محتوا', t: 'محتوای درسی و داستان‌ها برای استفاده‌ی شخصی خانواده‌ی شماست و اجازه‌ی بازنشر تجاری آن را نمی‌دهیم. داستان‌های ساخته‌شده با هوش مصنوعی برای کودک شما تولید می‌شوند و ممکن است بی‌نقص نباشند؛ گزارش هر مشکل به بهترشدن آن‌ها کمک می‌کند.' },
  { h: 'استفاده‌ی منصفانه', t: 'تلاش برای دسترسی غیرمجاز، استخراج انبوه محتوا یا اختلال در سرویس ممنوع است و به بسته‌شدن حساب می‌انجامد.' },
  { h: 'تغییرات', t: 'اگر این شرایط تغییر مهمی کند، از طریق ایمیل حساب اطلاع می‌دهیم. ادامه‌ی استفاده یعنی پذیرش نسخه‌ی جدید.' },
]

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="text-sm text-amber-600 font-bold">→ بازگشت به صفحه‌ی اصلی</Link>
      <h1 className="text-3xl font-bold text-slate-800 mt-4 mb-8">شرایط استفاده</h1>
      {TERMS.map(s => (
        <section key={s.h} className="mb-7">
          <h2 className="font-bold text-lg text-slate-800 mb-2">{s.h}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{s.t}</p>
        </section>
      ))}
    </div>
  )
}
