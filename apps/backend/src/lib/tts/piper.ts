// Free baseline voice — calls the Piper sidecar (offline, no key). Returns WAV.
// Retries with backoff so a memory-capped sidecar restart (during a big
// regeneration) doesn't fail the item — it just waits for it to come back.
export async function ttsPiper(voice: string, text: string): Promise<Buffer> {
  const base = (process.env.PIPER_URL || 'http://piper:5000').replace(/\/$/, '')
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${base}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      })
      if (!res.ok) throw new Error(`Piper ${res.status}: ${await res.text().catch(() => '')}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastErr = err
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))   // let the sidecar restart
    }
  }
  throw lastErr
}
