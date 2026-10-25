'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { celebrate } from '@/lib/confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import { ClayButton } from '@/components/child/clay'
import Mascot from '@/components/child/Mascot'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import EmptyState from '@/components/child/EmptyState'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakOrPlay, initSpeech } from '@/lib/speech'
import { useTimers } from '@/lib/useTimers'
import { toPersianDigits } from '@koodakbook/shared'
import type { Word, Child, AppCharacter, CharacterLine } from '@koodakbook/shared'
import CharacterAvatar from '@/components/child/CharacterAvatar'

/* Memory match — the first data-driven game template: it feeds off the word
 * catalog, so every new word row is automatically new game content. Matching
 * identical Persian words trains fast word-shape recognition, and each flip
 * speaks the word, so even pre-readers play by sound. */

const PAIRS = 6

interface Card {
  key: string      // unique per card
  wordId: string   // pair identity
  persian: string
  english: string
  audio: string | null
  image: string | null
}

function shuffle<T>(a: T[]): T[] { return [...a].sort(() => Math.random() - 0.5) }

function pickLine(host: AppCharacter | null, trigger: string): CharacterLine | null {
  const matches = (host?.lines ?? []).filter(l => l.trigger === trigger)
  return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
}

export default function MemoryGamePage() {
  const router = useRouter()
  const [words, setWords] = useState<Word[] | null>(null)
  const [host, setHost] = useState<AppCharacter | null>(null)
  const [round, setRound] = useState(0)
  // A failed word fetch used to deal an empty board that could never be won.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    let cancelled = false
    // The host's opening line: cleared on leave, or it spoke on the next screen.
    let openTimer: ReturnType<typeof setTimeout> | null = null
    async function load() {
      // ?host=<slug> → this friend presents the game (plan §5: games gain a host)
      const slug = new URLSearchParams(window.location.search).get('host')
      if (slug) {
        api.get<AppCharacter[]>('/api/characters').then(r => {
          if (cancelled) return
          const h = r.data?.find(c => c.slug === slug) ?? null
          setHost(h)
          const open = pickLine(h, 'game_open') ?? pickLine(h, 'greeting')
          if (open) openTimer = setTimeout(() => speakOrPlay(open.audio_url, open.text_persian), 600)
        })
      }
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      if (cancelled) return
      if (!wordsRes.data) { setLoadError(wordsRes.error ?? 'اتصال برقرار نشد. دوباره تلاش کن'); return }
      const child = pickChild(childRes.data ?? [])
      const level = child?.level ?? 1
      // Short, level-appropriate words read best on small cards.
      const pool = (wordsRes.data ?? []).filter(w => w.stage <= level && w.persian.length <= 6)
      setWords(pool.length >= PAIRS ? pool : (wordsRes.data ?? []))
    }
    load()
    return () => { cancelled = true; if (openTimer) clearTimeout(openTimer) }
  }, [router, attempt])

  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => { setLoadError(null); setAttempt(a => a + 1) }} />
  }
  if (!words) return <LoadingScreen message="در حال چیدن کارت‌ها..." />
  if (words.length === 0) {
    return (
      <div className="min-h-screen child-bg pb-nav">
        <PageHeader title="بازی حافظه" module="games" />
        <EmptyState message="هنوز کلمه‌ای برای بازی نیست" />
        <BottomNav />
      </div>
    )
  }
  return <Board key={round} words={words} host={host} onReplay={() => setRound(r => r + 1)} onHome={() => router.push('/child/home')} />
}

function Board({ words, host, onReplay, onHome }: { words: Word[]; host: AppCharacter | null; onReplay: () => void; onHome: () => void }) {
  const cards = useMemo<Card[]>(() => {
    const picked = shuffle(words).slice(0, PAIRS)
    return shuffle(picked.flatMap(w => ([0, 1] as const).map(i => ({
      key: `${w.id}-${i}`, wordId: w.id, persian: w.persian, english: w.english, audio: mediaUrl(w.audio_url), image: mediaUrl(w.image_url),
    }))))
  }, [words])

  const [open, setOpen] = useState<string[]>([])        // currently flipped (≤2)
  const [matched, setMatched] = useState<Set<string>>(new Set())  // matched wordIds
  const [moves, setMoves] = useState(0)
  const later = useTimers()
  // The pairs actually dealt: a catalogue smaller than PAIRS words deals
  // fewer, and `=== PAIRS` then made the board unwinnable.
  const pairs = cards.length / 2
  const done = pairs > 0 && matched.size === pairs

  useEffect(() => {
    if (done) {
      playComplete()
      celebrate({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] })
      const praise = pickLine(host, 'praise')
      if (praise) {
        const t = setTimeout(() => speakOrPlay(praise.audio_url, praise.text_persian), 500)
        return () => clearTimeout(t)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function flip(card: Card) {
    if (open.length === 2 || open.includes(card.key) || matched.has(card.wordId)) return
    playTap()
    speakOrPlay(card.audio ?? '', card.persian)
    const next = [...open, card.key]
    setOpen(next)
    if (next.length === 2) {
      setMoves(m => m + 1)
      const [a, b] = next.map(k => cards.find(c => c.key === k)!)
      if (a.wordId === b.wordId) {
        later(() => { playSuccess(); setMatched(s => new Set(s).add(a.wordId)); setOpen([]) }, 450)
      } else {
        later(() => setOpen([]), 950)
      }
    }
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        {host ? <CharacterAvatar slug={host.slug} size={130} mood="excited" /> : <Mascot size={130} mood="excited" />}
      </motion.div>
      <h1 className="font-display text-h1 font-black text-text-primary">همه را پیدا کردی! <span aria-hidden="true">🎉</span></h1>
      <p className="text-text-primary persian-text">با {toPersianDigits(moves)} حرکت — عالی بود!</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <ClayButton ramp="games" size="lg" onClick={onReplay}>
          دوباره بازی کن <span aria-hidden="true">🔁</span>
        </ClayButton>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-2xl border-2 border-border text-text-secondary font-bold min-h-[56px]">
          برگشت به خانه <span aria-hidden="true">🏠</span>
        </motion.button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="بازی حافظه" subtitle="جفت هر کلمه را پیدا کن" module="games" />

      <div className="px-4 pt-5 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3 text-sm">
          {/* Persian digits like the rest of the UI; the pair count is a
              polite live region so a found pair is announced. */}
          <span className="text-text-secondary persian-text" role="status">جفت‌ها: {toPersianDigits(matched.size)} از {toPersianDigits(pairs)}</span>
          <span className="text-text-secondary">حرکت: {toPersianDigits(moves)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5" dir="rtl">
          {cards.map((card, i) => {
            const isOpen = open.includes(card.key) || matched.has(card.wordId)
            const isMatched = matched.has(card.wordId)
            // Every face-down card used to be named «کارت بسته» — twelve
            // identical names, so a screen-reader player couldn't tell which
            // card they were on. Position first, then state; the word only
            // once the card is actually face-up.
            const n = `کارت ${toPersianDigits(i + 1)}`
            const name = isMatched ? `${n}: ${card.persian}، پیدا شد` : isOpen ? `${n}: ${card.persian}` : `${n}، بسته`
            return (
              <motion.button
                key={card.key}
                onClick={() => flip(card)}
                whileTap={{ scale: isOpen ? 1 : 0.93 }}
                aria-label={name}
                className="relative h-24 [perspective:600px] touch-target-child"
              >
                {/* Both faces are always in the DOM (the flip is a CSS
                    rotation), so the face-down word is hidden from assistive
                    tech explicitly — the button's name above is the only
                    thing read, and it only contains the word when open. */}
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-0 [transform-style:preserve-3d]"
                  animate={{ rotateY: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                >
                  {/* back (face-down) */}
                  <div className="absolute inset-0 rounded-2xl shadow-card flex items-center justify-center [backface-visibility:hidden]"
                    style={{ background: 'linear-gradient(to bottom right, var(--ramp-games-bright), var(--ramp-games-deep))' }}>
                    <span className="text-3xl" aria-hidden="true">🌟</span>
                  </div>
                  {/* front (word) */}
                  <div className={`absolute inset-0 rounded-2xl shadow-card flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched ? 'bg-lessons-soft border-2 border-lessons-bright' : 'bg-games-soft border-2 border-games-bright'}`}>
                    {/* real photo when the word has one — word stays visible below */}
                    {card.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt="" className="w-full h-10 object-cover rounded-t-xl -mt-1" loading="lazy" />
                    )}
                    <span className={`font-bold text-text-primary persian-text leading-tight ${card.image ? 'text-base' : 'text-xl'}`}>{card.persian}</span>
                    <span className="text-[10px] text-text-secondary ltr truncate max-w-full">{card.english}</span>
                  </div>
                </motion.div>
              </motion.button>
            )
          })}
        </div>

        <p className="text-center text-xs text-text-secondary persian-text mt-4">
          روی کارت‌ها بزن، کلمه را بشنو و جفتش را پیدا کن
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
