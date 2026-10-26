/* An MP4 (ISO base media) file starts with a box whose type, at bytes 4-8,
 * is "ftyp". Checked before an uploaded video is moved into /uploads so a
 * renamed .mov/.webm or random file can't end up in the children's menu. */
export function isMp4Head(head: Buffer): boolean {
  return head.length >= 8 && head.toString('latin1', 4, 8) === 'ftyp'
}

/** "1:05" from 65.3 seconds; null/invalid → "" */
export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return ''
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
