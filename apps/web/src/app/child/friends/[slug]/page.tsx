'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { speakOrPlay, stopSpeaking, initSpeech } from '@/lib/speech'
import { useActing } from '@/lib/useActing'
import { playTap } from '@/lib/sounds'
import BottomNav from '@/components/child/BottomNav'
import LoadingScreen from '@/components/child/LoadingScreen'
import SceneBackdrop from '@/components/child/SceneBackdrop'
import CharacterAvatar, { type CharacterMood } from '@/components/child/CharacterAvatar'
import { ModuleCard } from '@/components/child/kit'
import { isSceneSlug, type AppCharacter, type CharacterLine } from '@koodakbook/shared'


/* Character home (plan §5): the friend in its own scene, greeting on arrival
 * (auto-play, replay by tapping the character), and three chunky doors. V1 =
 * scripted lines; the «حرف بزنیم» door sleeps until the V2 conversation engine. */

function lineFor(c: AppCharacter, trigger: string): CharacterLine | null {
  const matches = (c.lines ?? []).filter(l => l.trigger === trigger)
  return matches.length ? matches[Math.floor(Math.random() * matches.length)] : null
}

export default function CharacterHomePage() {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  const [chars, setChars] = useState<AppCharacter[] | null>(null)
  const [mood, setMood] = useState<CharacterMood>('happy')
  const { mouth: actMouth, speaking } = useActing()

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    initSpeech()
    api.get<AppCharacter[]>('/api/characters').then(r => { if (r.data) setChars(r.data) })
  }, [router])

  const character = useMemo(() => chars?.find(c => c.slug === slug) ?? null, [chars, slug])

  function say(trigger: string, fallbackMood: CharacterMood = 'happy') {
    if (!character) return
    const line = lineFor(character, trigger)
    if (!line) return
    setMood((line.emotion as CharacterMood) || fallbackMood)
    speakOrPlay(line.audio_url, line.text_persian)
  }

  // The greeting IS the introduction — plays the moment the child arrives.
  useEffect(() => {
    if (!character) return
    const t = setTimeout(() => say('greeting', 'excited'), 450)
    return () => { clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id])

  if (!chars) return <LoadingScreen message="در حال آمدن دوستت..." />
  if (!character) { router.replace('/child/home'); return null }

  const scene = isSceneSlug(character.home_scene) ? character.home_scene : 'garden'
  const greeting = lineFor(character, 'greeting')

  return (
    <div className="min-h-screen child-bg pb-nav">
      {/* The friend's room: its scene with the character living in it */}
      <div className="relative">
        <SceneBackdrop scene={scene} className="w-full h-64 !rounded-none rounded-b-[2rem]" />
        <button
          onClick={() => { playTap(); say('greeting', 'excited') }}
          aria-label={`دوباره سلام کن به ${character.name_persian}`}
          className="absolute inset-x-0 bottom-0 flex justify-center"
        >
          <CharacterAvatar slug={character.slug} size={150} mood={mood} talking={speaking}
            mouth={speaking ? actMouth : undefined} className="-mb-2 drop-shadow-lg" />
        </button>
        <Link href="/child/home" aria-label="برگشت به خانه"
          className="absolute top-3 right-3 w-14 h-14 bg-white/90 backdrop-blur rounded-2xl shadow flex items-center justify-center text-text-secondary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      </div>

      <div className="px-4 pt-4 max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">{character.name_persian}</h1>
          <p className="text-sm text-text-secondary persian-text mt-1">{character.personality}</p>
          {greeting && (
            <p className="mt-3 bg-white rounded-2xl shadow-card px-4 py-3 text-text-primary persian-text text-sm leading-relaxed">
              «{greeting.text_persian}»
            </p>
          )}
        </div>

        {/* Three doors — chunky, in the friend's module colors */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          <ModuleCard
            module="games" glyph="🃏" href={`/child/games/memory?host=${character.slug}`}
            title="با هم بازی کنیم!" sub={`بازی حافظه با ${character.name_persian}`}
          />
          <ModuleCard
            module="stories" glyph="📖" href="/child/story"
            title="قصه بگو!" sub="برو سراغ قصه‌ها"
          />
          <ModuleCard
            module="speak" glyph="💬" href={`/child/friends/${character.slug}/talk`}
            title="حرف بزنیم!" sub={`${character.name_persian} گوش می‌کنه و جواب می‌ده`}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
