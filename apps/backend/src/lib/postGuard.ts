/* Deterministic content gate for AI-generated public-channel drafts
 * (routes/adminPostDrafts.ts, scripts/generatePostDrafts.ts).
 *
 * Same role as chatGuard.ts's validReply for the character chat: a pure,
 * dependency-free, unit-testable rule check that runs on every AI-generated
 * candidate BEFORE it's even shown to a human reviewer. It is not a
 * replacement for approval — a human still confirms every post — it's the
 * second, independent check: a bad generation should not depend solely on a
 * reviewer catching it (a tired reviewer clicking approve is a real failure
 * mode, not a hypothetical one). A candidate that fails this gate is never
 * inserted as a pending draft at all; it's logged and the admin is notified
 * that a generation was discarded (lib/adminNotify.notifyDraftGenerationFailed).
 *
 * This is deliberately narrower/looser than validReply where the two differ:
 * a channel post is allowed to carry the app's own link (a chat reply never
 * should), and can run longer than a two-sentence chat turn.
 */

const MIN_LEN = 10
const MAX_LEN = 800

export function validDraftText(text: string, opts: { allowedLinkHost?: string } = {}): boolean {
  const t = text.trim()
  if (t.length < MIN_LEN || t.length > MAX_LEN) return false

  // Any link must point at our own site — an injected or hallucinated link to
  // somewhere else must never reach a public post drafted for a children's
  // product.
  const urls = t.match(/https?:\/\/\S+/g) ?? []
  for (const u of urls) {
    let host: string
    try {
      host = new URL(u).host
    } catch {
      return false
    }
    if (!opts.allowedLinkHost) return false
    if (host !== opts.allowedLinkHost && !host.endsWith(`.${opts.allowedLinkHost}`)) return false
  }

  // Never asks for or states anything that reads like collecting personal info.
  if (/آدرس|شماره تلفن|رمز عبور|پسورد|کجا زندگی/.test(t)) return false

  // A long run of Latin letters outside of a URL is a sign of injected or
  // off-topic content — real copy here is Persian prose plus our own link.
  const withoutUrls = t.replace(/https?:\/\/\S+/g, '')
  if (/[A-Za-z]{15,}/.test(withoutUrls)) return false

  return true
}
