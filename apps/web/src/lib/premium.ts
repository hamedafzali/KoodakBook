/* Playback path policy for fixed-path audio (phonics/math packs).
 * DB-backed content gets its audio_url promoted SERVER-side; only client-built
 * paths (/uploads/phonics/<slug>.wav, /uploads/math/…) are resolved here. */

/** Playback candidates for a fixed-path clip. Policy: audio quality is not a
 *  paid tier — EVERY account tries the /uploads/premium/ variant first and
 *  falls through (404) to the base file, then browser TTS. The path prefix is
 *  historical; both variants are available to all accounts. */
export function audioCandidates(url: string): string[] {
  return [url.replace('/uploads/', '/uploads/premium/'), url]
}
