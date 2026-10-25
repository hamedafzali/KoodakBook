/* Pure text builder for the Telegram channel post announcing an app
 * release (routes/appReleases.ts). Kept out of the route module so it can be
 * unit-tested without a database or JWT secret. */

/** The channel post that introduces a release. Plain Persian, our own link
 *  only, under postGuard's length cap — the same gate every draft passes. */
export function releasePostText(r: { version_name: string; notes: string | null }, webUrl: string): string {
  const lines = [
    '📱 اپ اندروید کودک‌بوک آماده است!',
    '',
    `حالا می‌توانید کودک‌بوک را مستقیم روی گوشی یا تبلت اندروید نصب کنید (نسخه‌ی ${r.version_name}).`,
    '',
    `⬇️ دانلود و راهنمای نصب: ${webUrl.replace(/\/+$/, '')}/app`,
    '',
    'اندروید: فایل را دانلود کنید و اگر گوشی پرسید، اجازه‌ی نصب را بدهید.',
    'آیفون و آیپد: همان صفحه را در سافاری باز کنید و «افزودن به صفحه‌ی اصلی» را بزنید.',
  ]
  if (r.notes) lines.push('', `تازه‌های این نسخه: ${r.notes}`)
  lines.push('', 'این نسخه هنوز در گوگل‌پلی نیست. اگر مشکلی دیدید برایمان بنویسید 💛')
  return lines.join('\n')
}
