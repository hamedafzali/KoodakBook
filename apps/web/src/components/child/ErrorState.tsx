'use client'
import Link from 'next/link'
import CharacterAvatar from './CharacterAvatar'
import { ClayButton } from './clay'

interface Props {
  /** The api client's own message ("اینترنت قطع است…") when there is one. */
  message?: string | null
  /** Omit when retrying can't help (something that doesn't exist). */
  onRetry?: () => void
  /** Where the way-out link goes. `null` hides it (a screen that already
   *  carries the bottom nav / rail still gets one — a pre-reader shouldn't
   *  have to find the nav to escape a dead screen). */
  backHref?: string | null
  backLabel?: string
  title?: string
}

/* The failed-to-load screen for a child page that fetches before it can show
 * anything. Several pages used to stay on LoadingScreen forever when their
 * fetch failed (the api client never rejects, it resolves `{ data: null,
 * error }`), and list pages showed their "nothing here yet" empty state —
 * an error dressed up as an empty catalogue. Every such page now lands here:
 * the same child-bg and the same host (چرخی, who fronts every wait in
 * LoadingScreen) so the swap from loading to failed doesn't jump, then the
 * message, a retry and a way home. Same copy as mobile's LoadState.
 *
 * `onRetry` must clear the page's error before it refetches, so this swaps
 * straight back to LoadingScreen and a second tap can't start a duplicate
 * request. No automatic retries.
 *
 * role="alert": this replaces the loading screen in place with no focus
 * change, so without an assertive live region a screen-reader user would
 * never hear that the load failed. */
export default function ErrorState({
  message,
  onRetry,
  backHref = '/child/home',
  backLabel = 'برگشت به خانه',
  title = 'نتونستیم صفحه رو بیاریم',
}: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 child-bg p-6 text-center">
      <CharacterAvatar slug="charkhi" size={100} mood="confused" />
      <div role="alert" className="flex flex-col items-center gap-2 max-w-xs">
        <h1 className="font-display font-black text-card-title text-text-primary persian-text">{title}</h1>
        {message && <p className="text-small text-text-primary persian-text">{message}</p>}
      </div>
      <div className="w-full max-w-xs flex flex-col items-center gap-2">
        {onRetry && (
          <ClayButton size="lg" onClick={onRetry}>دوباره امتحان کن</ClayButton>
        )}
        {backHref && (
          <Link
            href={backHref}
            className="min-h-[48px] min-w-[88px] inline-flex items-center justify-center px-4 rounded-xl font-bold text-text-primary underline underline-offset-4 persian-text"
          >
            {backLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
