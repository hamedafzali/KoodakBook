'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import { clayVars } from '@/components/child/clay'
import LoadingScreen from '@/components/child/LoadingScreen'
import Mascot from '@/components/child/Mascot'
import Emoji from '@/components/shared/Emoji'
import { playTap, playSuccess } from '@/lib/sounds'
import { speakOrPlay, initSpeech } from '@/lib/speech'
import { recognitionSupported, listenOnce } from '@/lib/recognition'
import { wordEmoji } from '@koodakbook/shared'
import type { Word, Child } from '@koodakbook/shared'

type Phase = 'idle' | 'listening' | 'correct' | 'tryagain'

export default function SpeakPage() {
  const router = useRouter()
  const [words, setWords] = useState<Word[]>([])
  const [idx, setIdx] = useState(0)
  const [childId, setChildId] = useState('')
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const supported = recognitionSupported()

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    async function load() {
      const [wordsRes, childRes] = await Promise.all([
        api.get<Word[]>('/api/words'),
        api.get<Child[]>('/api/children'),
      ])
      // Prefer words that have a real image or, failing that, an emoji, so
      // the child always has a visual cue — same "has a visual" test WordTile
      // and QuizCard use, not emoji-only.
      const all = wordsRes.data ?? []
      const withVisual = all.filter(w => w.image_url || wordEmoji(w.english))
      setWords((withVisual.length >= 8 ? withVisual : all).slice(0, 20))
      const child = pickChild(childRes.data ?? [])
      if (child) setChildId(child.id)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return <LoadingScreen message="در حال بارگذاری..." />
  if (words.length === 0) return <LoadingScreen message="کلمه‌ای نیست" />

  const word = words[idx]
  const image = mediaUrl(word.image_url)
  const emoji = wordEmoji(word.english)

  async function record() {
    if (phase === 'listening') return
    playTap()
    setHeard('')
    setPhase('listening')
    try {
      const res = await listenOnce(word.persian)
      setHeard(res.transcript)
      if (res.matched) {
        playSuccess()
        setPhase('correct')
        if (childId) api.post('/api/progress/word', { child_id: childId, word_id: word.id, status: 'practiced', track: 'productive' })
      } else {
        setPhase('tryagain')
      }
    } catch {
      setPhase('idle')
    }
  }

  function nextWord() {
    setPhase('idle')
    setHeard('')
    setIdx(i => (i + 1) % words.length)
  }

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="تمرین گفتن" subtitle={`کلمه ${idx + 1} از ${words.length}`} module="speak" />

      <div className="px-4 pt-6 flex flex-col items-center gap-5">
        {!supported && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-3 text-center persian-text max-w-sm">
            مرورگر تو از تشخیص صدا پشتیبانی نمی‌کند. می‌توانی کلمه را بشنوی و بلند تکرار کنی.
          </div>
        )}

        {/* Word card */}
        <button
          onClick={() => { playTap(); speakOrPlay(word.audio_url, word.persian) }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-card p-6 flex flex-col items-center gap-2 touch-target-child"
          aria-label={`بشنو: ${word.persian}`}
        >
          {image ? (
            <img src={image} alt="" className="w-28 h-28 object-contain" />
          ) : emoji ? (
            <span className="text-7xl leading-none" aria-hidden="true">{emoji}</span>
          ) : null}
          <span className="text-5xl font-bold text-text-primary">{word.persian}</span>
          <span className="text-base text-text-secondary ltr">{word.english}</span>
          <span className="flex items-center gap-1 text-xs text-amber-700"><Emoji name="speaker-high-volume" size={16} /> اول گوش کن</span>
        </button>

        {/* Mascot feedback */}
        <AnimatePresence mode="wait">
          {phase === 'correct' && (
            <motion.div key="correct" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <Mascot size={90} mood="excited" />
              <p className="font-bold text-green-600 text-lg">آفرین! درست گفتی 🌟</p>
            </motion.div>
          )}
          {phase === 'tryagain' && (
            <motion.div key="tryagain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
              <Mascot size={90} mood="idle" />
              <p className="font-medium text-text-secondary persian-text">دوباره امتحان کن، می‌تونی!</p>
              {heard && <p className="text-xs text-text-secondary">شنیدم: «{heard}»</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Record button */}
        {supported && (
          <motion.button
            onClick={record}
            disabled={phase === 'listening'}
            whileTap={{ scale: 0.9 }}
            animate={phase === 'listening' ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={phase === 'listening' ? { duration: 1, repeat: Infinity } : {}}
            className="w-24 h-24 rounded-full flex items-center justify-center shadow-raised touch-target-child text-white"
            /* Recording is a state, not a module, so the live mic keeps a red —
               but rose-600 rather than red-500: it has to read as "different
               from resting" against the speak ramp beside it, and at 500 it
               did not. */
            style={{ background: phase === 'listening' ? 'rgb(225 29 72)' : 'var(--ramp-speak-bright)' }}
            aria-label={phase === 'listening' ? 'در حال شنیدن' : 'ضربه بزن و بگو'}
          >
            <span className="text-4xl" aria-hidden="true">{phase === 'listening' ? '👂' : '🎤'}</span>
          </motion.button>
        )}
        <p className="text-sm text-text-secondary persian-text">
          {phase === 'listening' ? 'بگو...' : supported ? 'ضربه بزن و کلمه را بگو' : ''}
        </p>

        <motion.button
          onClick={nextWord}
          whileTap={{ scale: 0.95 }}
          style={clayVars('speak')}
          className="clay w-full max-w-sm py-4 font-bold text-lg min-h-[56px]"
        >
          کلمه بعدی ←
        </motion.button>
      </div>

      <BottomNav />
    </div>
  )
}
