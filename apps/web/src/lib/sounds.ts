// Web Audio API — no external files needed

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  return ctx
}

function beep(freq: number, duration: number, volume = 0.15) {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + duration)
}

export function playTap() {
  beep(600, 0.08, 0.1)
}

export function playSuccess() {
  beep(520, 0.1)
  setTimeout(() => beep(660, 0.1), 100)
  setTimeout(() => beep(800, 0.2), 200)
}

export function playComplete() {
  ;[0, 80, 160, 260].forEach((delay, i) => {
    setTimeout(() => beep([523, 659, 784, 1047][i], 0.18), delay)
  })
}
