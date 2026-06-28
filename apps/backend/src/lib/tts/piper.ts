// Free baseline voice — calls the Piper sidecar (offline, no key). Returns WAV.
export async function ttsPiper(voice: string, text: string): Promise<Buffer> {
  const base = (process.env.PIPER_URL || 'http://piper:5000').replace(/\/$/, '')
  const res = await fetch(`${base}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) throw new Error(`Piper ${res.status}: ${await res.text().catch(() => '')}`)
  return Buffer.from(await res.arrayBuffer())
}
