'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import PageHeader from '@/components/child/PageHeader'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
import Mascot from '@/components/child/Mascot'
import { playTap, playSuccess } from '@/lib/sounds'
import { speakPersian, initSpeech } from '@/lib/speech'
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
      // Prefer words that have an emoji so the child has a visual cue
      const all = wordsRes.data ?? []
      const withVisual = all.filter(w => wordEmoji(w.english))
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
        if (childId) api.post('/api/progress/word', { child_id: childId, word_id: word.id, status: 'practiced' })
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
      <PageHeader title="تمرین گفتن 🎤" subtitle={`کلمه ${idx + 1} از ${words.length}`} gradientClass="from-rose-400 to-pink-500" />

      <div className="px-4 pt-6 flex flex-col items-center gap-5">
        {!supported && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-2xl p-3 text-center persian-text max-w-sm">
            مرورگر تو از تشخیص صدا پشتیبانی نمی‌کند. می‌توانی کلمه را بشنوی و بلند تکرار کنی.
          </div>
        )}

        {/* Word card */}
        <button
          onClick={() => { playTap(); speakPersian(word.persian) }}
          className="w-full max-w-sm bg-white rounded-[1.75rem] shadow-md p-6 flex flex-col items-center gap-2 touch-target"
          aria-label={`بشنو: ${word.persian}`}
        >
          {emoji && <span className="text-7xl leading-none" aria-hidden="true">{emoji}</span>}
          <span className="text-5xl font-bold text-gray-800">{word.persian}</span>
          <span className="text-base text-gray-400 ltr">{word.english}</span>
          <span className="text-xs text-amber-500">🔊 اول گوش کن</span>
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
              <p className="font-medium text-gray-500 persian-text">دوباره امتحان کن، می‌تونی!</p>
              {heard && <p className="text-xs text-gray-400">شنیدم: «{heard}»</p>}
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
            className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg touch-target ${
              phase === 'listening' ? 'bg-red-500' : 'bg-gradient-to-br from-rose-400 to-pink-500'
            }`}
            aria-label={phase === 'listening' ? 'در حال شنیدن' : 'ضربه بزن و بگو'}
          >
            <span className="text-4xl">{phase === 'listening' ? '👂' : '🎤'}</span>
          </motion.button>
        )}
        <p className="text-sm text-gray-500 persian-text">
          {phase === 'listening' ? 'بگو...' : supported ? 'ضربه بزن و کلمه را بگو' : ''}
        </p>

        <motion.button
          onClick={nextWord}
          whileTap={{ scale: 0.95 }}
          className="w-full max-w-sm py-4 rounded-[1.25rem] bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md min-h-[56px]"
        >
          کلمه بعدی ←
        </motion.button>
      </div>

      <BottomNav />
    </div>
  )
}
