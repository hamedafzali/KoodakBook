'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import Mascot from '@/components/child/Mascot'
import LoadingScreen from '@/components/child/LoadingScreen'
import { playTap, playSuccess, playComplete } from '@/lib/sounds'
import { speakOrPlay, initSpeech } from '@/lib/speech'
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

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    async function load() {
      // ?host=<slug> → this friend presents the game (plan §5: games gain a host)
      const slug = new URLSearchParams(window.location.search).get('host')
      if (slug) {
        api.get<AppCharacter[]>('/api/characters').then(r => {
          const h = r.data?.find(c => c.slug === slug) ?? null
          setHost(h)
          const open = pickLine(h, 'game_open') ?? pickLine(h, 'greeting')
          if (open) setTimeout(() => speakOrPlay(open.audio_url, open.text_persian), 600)
        })
      }
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      const child = pickChild(childRes.data ?? [])
      const level = child?.level ?? 1
      // Short, level-appropriate words read best on small cards.
      const pool = (wordsRes.data ?? []).filter(w => w.stage <= level && w.persian.length <= 6)
      setWords(pool.length >= PAIRS ? pool : (wordsRes.data ?? []))
    }
    load()
  }, [router])

  if (!words) return <LoadingScreen message="در حال چیدن کارت‌ها..." />
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
  const done = matched.size === PAIRS

  useEffect(() => {
    if (done) {
      playComplete()
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 }, colors: ['#a78bfa', '#f472b6', '#fbbf24'] })
      const praise = pickLine(host, 'praise')
      if (praise) setTimeout(() => speakOrPlay(praise.audio_url, praise.text_persian), 500)
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
        setTimeout(() => { playSuccess(); setMatched(s => new Set(s).add(a.wordId)); setOpen([]) }, 450)
      } else {
        setTimeout(() => setOpen([]), 950)
      }
    }
  }

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
        {host ? <CharacterAvatar slug={host.slug} size={130} mood="excited" /> : <Mascot size={130} mood="excited" />}
      </motion.div>
      <h1 className="text-3xl font-bold text-gray-800">همه را پیدا کردی! 🎉</h1>
      <p className="text-gray-600 persian-text">با {moves} حرکت — عالی بود!</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <motion.button onClick={onReplay} whileTap={{ scale: 0.96 }}
          className="w-full py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md">
          دوباره بازی کن 🔁
        </motion.button>
        <motion.button onClick={onHome} whileTap={{ scale: 0.96 }}
          className="w-full py-3.5 rounded-md border-2 border-slate-200 text-slate-600 font-bold">
          برگشت به خانه 🏠
        </motion.button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="بازی حافظه 🃏" subtitle="جفت هر کلمه را پیدا کن" gradientClass="from-violet-500 to-purple-500" />

      <div className="px-4 pt-5 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-gray-500 persian-text">جفت‌ها: {matched.size} از {PAIRS}</span>
          <span className="text-gray-400">حرکت: {moves}</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5" dir="rtl">
          {cards.map(card => {
            const isOpen = open.includes(card.key) || matched.has(card.wordId)
            const isMatched = matched.has(card.wordId)
            return (
              <motion.button
                key={card.key}
                onClick={() => flip(card)}
                whileTap={{ scale: isOpen ? 1 : 0.93 }}
                aria-label={isOpen ? card.persian : 'کارت بسته'}
                className="relative h-24 [perspective:600px] touch-target"
              >
                <motion.div
                  className="absolute inset-0 [transform-style:preserve-3d]"
                  animate={{ rotateY: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                >
                  {/* back (face-down) */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 shadow-sm flex items-center justify-center [backface-visibility:hidden]">
                    <span className="text-3xl" aria-hidden="true">🌟</span>
                  </div>
                  {/* front (word) */}
                  <div className={`absolute inset-0 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                    isMatched ? 'bg-green-100 border-2 border-green-300' : 'bg-white border-2 border-violet-200'}`}>
                    {/* real photo when the word has one — word stays visible below */}
                    {card.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.image} alt="" className="w-full h-10 object-cover rounded-t-xl -mt-1" loading="lazy" />
                    )}
                    <span className={`font-bold text-gray-800 persian-text leading-tight ${card.image ? 'text-base' : 'text-xl'}`}>{card.persian}</span>
                    <span className="text-[10px] text-gray-400 ltr truncate max-w-full">{card.english}</span>
                  </div>
                </motion.div>
              </motion.button>
            )
          })}
        </div>

        <p className="text-center text-xs text-gray-400 persian-text mt-4">
          روی کارت‌ها بزن، کلمه را بشنو و جفتش را پیدا کن
        </p>
      </div>

      <BottomNav />
    </div>
  )
}
