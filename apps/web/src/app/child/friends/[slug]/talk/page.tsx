'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import { speakOrPlay, stopSpeaking, initSpeech } from '@/lib/speech'
import { useActing } from '@/lib/useActing'
import { recognitionSupported, dictateOnce } from '@/lib/recognition'
import { playTap } from '@/lib/sounds'
import LoadingScreen from '@/components/child/LoadingScreen'
import SceneBackdrop from '@/components/child/SceneBackdrop'
import CharacterAvatar, { type CharacterMood } from '@/components/child/CharacterAvatar'
import { isSceneSlug, type AppCharacter, type Child } from '@koodakbook/shared'

/* «حرف بزنیم» — the controlled conversation (plan §4). Push-to-talk when the
 * browser can hear Persian, starter phrase chips always (the no-pressure
 * path). The character praises, recasts and asks — never says "wrong". */

interface Turn { role: 'child' | 'character'; text: string }

const STARTERS = ['سلام!', 'من سیب دوست دارم', 'تو چی دوست داری؟', 'یک قصه بگو!']

export default function TalkPage() {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  const [character, setCharacter] = useState<AppCharacter | null>(null)
  const [childId, setChildId] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [mood, setMood] = useState<CharacterMood>('happy')
  const [busy, setBusy] = useState<'listen' | 'think' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const canListen = useMemo(() => recognitionSupported(), [])
  const { mouth: actMouth, speaking } = useActing()   // sentence-matched lip-sync + bob

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    async function load() {
      const [charsRes, childRes] = await Promise.all([
        api.get<AppCharacter[]>('/api/characters'),
        api.get<Child[]>('/api/children'),
      ])
      const c = charsRes.data?.find(x => x.slug === slug) ?? null
      setCharacter(c)
      const child = pickChild(childRes.data ?? [])
      if (child && c) {
        setChildId(child.id)
        const t = await api.get<Turn[]>(`/api/characters/${slug}/chat/${child.id}`)
        if (t.data) setTurns(t.data.slice(-10))
      }
    }
    load()
    return () => stopSpeaking()
  }, [router, slug])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, busy])

  async function send(text: string) {
    if (!character || !childId || busy === 'think' || !text.trim()) return
    setNotice(null)
    setTurns(ts => [...ts, { role: 'child', text }])
    setBusy('think')
    setMood('idle')
    const r = await api.post<{ reply: string; emotion: string; audio_url: string | null }>(
      `/api/characters/${slug}/chat`, { child_id: childId, text })
    setBusy(null)
    if (r.error || !r.data) {
      // cap reached (429) or transient failure — the character says it kindly
      setNotice(r.error ?? 'یک لحظه صبر کن و دوباره بگو!')
      setMood('encouraging')
      return
    }
    setMood((r.data.emotion as CharacterMood) || 'happy')
    setTurns(ts => [...ts, { role: 'character', text: r.data!.reply }])
    speakOrPlay(r.data.audio_url, r.data.reply)
  }

  async function pushToTalk() {
    if (busy) return
    playTap()
    stopSpeaking()
    setBusy('listen')
    try {
      const heard = await dictateOnce()
      if (heard) { setBusy(null); await send(heard) }
      else { setBusy(null); setNotice('نشنیدم! بلندتر بگو یا یکی از جمله‌ها را انتخاب کن 👇') }
    } catch {
      setBusy(null)
      setNotice('میکروفون کار نکرد — از جمله‌های پایین استفاده کن 👇')
    }
  }

  if (!character) return <LoadingScreen message="دوستت داره می‌آد..." />
  const scene = isSceneSlug(character.home_scene) ? character.home_scene : 'garden'

  return (
    <div className="min-h-screen child-bg flex flex-col">
      {/* Character stage */}
      <div className="relative shrink-0">
        <SceneBackdrop scene={scene} className="w-full h-44 !rounded-none rounded-b-[2rem]" />
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <CharacterAvatar slug={character.slug} size={110} talking={speaking}
            mouth={speaking ? actMouth : undefined}
            mood={busy === 'think' ? 'thinking' : mood} className="-mb-1 drop-shadow-lg" />
        </div>
        <Link href={`/child/friends/${slug}`} aria-label="برگشت"
          className="absolute top-3 right-3 w-11 h-11 bg-white/90 backdrop-blur rounded-2xl shadow flex items-center justify-center text-slate-500">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 max-w-md w-full mx-auto">
        {turns.length === 0 && (
          <p className="text-center text-sm text-slate-400 persian-text pt-4">
            سلام کن یا یکی از جمله‌های پایین را بزن! 💬
          </p>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${t.role === 'child' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm persian-text leading-relaxed ${
                t.role === 'child'
                  ? 'bg-amber-500 text-white rounded-tr-sm'
                  : 'bg-white shadow-card text-slate-700 rounded-tl-sm'}`}>
                {t.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy === 'think' && (
          <div className="flex justify-end">
            <div className="bg-white shadow-card rounded-2xl rounded-tl-sm px-4 py-3">
              <motion.span className="inline-flex gap-1"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }}>
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
                <span className="w-2 h-2 bg-amber-400 rounded-full" />
              </motion.span>
            </div>
          </div>
        )}
        {notice && <p className="text-center text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2 persian-text">{notice}</p>}
        <div ref={endRef} />
      </div>

      {/* Input: mic (when supported) + starter chips (always) */}
      <div className="shrink-0 px-4 pb-6 pt-2 bg-white/85 backdrop-blur-md border-t border-amber-100 space-y-3"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-md mx-auto">
          {STARTERS.map(sTxt => (
            <button key={sTxt} onClick={() => { playTap(); send(sTxt) }} disabled={busy === 'think'}
              className="flex-shrink-0 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium rounded-full px-4 py-2 disabled:opacity-50">
              {sTxt}
            </button>
          ))}
        </div>
        {canListen && (
          <div className="flex justify-center">
            <motion.button onClick={pushToTalk} disabled={busy === 'think'}
              whileTap={{ scale: 0.9 }}
              animate={busy === 'listen' ? { scale: [1, 1.12, 1] } : {}}
              transition={busy === 'listen' ? { duration: 0.9, repeat: Infinity } : {}}
              aria-label={busy === 'listen' ? 'دارم گوش می‌کنم…' : 'ضربه بزن و حرف بزن'}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg text-4xl ${
                busy === 'listen' ? 'bg-rose-500' : 'bg-brand-gradient-br'} text-white disabled:opacity-60`}>
              🎤
            </motion.button>
          </div>
        )}
        <p className="text-center text-[11px] text-slate-400 persian-text">
          {canListen ? (busy === 'listen' ? 'دارم گوش می‌کنم… بگو!' : 'دکمه را بزن و فارسی حرف بزن') : 'از جمله‌های بالا انتخاب کن'}
        </p>
      </div>
    </div>
  )
}
