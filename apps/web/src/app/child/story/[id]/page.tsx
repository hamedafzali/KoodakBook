'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { motion } from 'framer-motion'
import StoryReader from '@/components/child/StoryReader'
import RewardPopup from '@/components/child/RewardPopup'
import LoadingScreen from '@/components/child/LoadingScreen'
import Mascot from '@/components/child/Mascot'
import { pickChild } from '@/lib/activeChild'
import { getTranslationLang } from '@/lib/translation'
import type { Story, StoryPage, Badge, Child, Promotion } from '@koodakbook/shared'
import ReadAloud from '@/components/child/ReadAloud'

type FullStory = Story & { pages: StoryPage[] }

export default function StoryPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [story, setStory] = useState<FullStory | null>(null)
  const [childId, setChildId] = useState('')
  const [lang] = useState(() => getTranslationLang())   // parent-set family language
  const [newBadge, setNewBadge] = useState<Badge | null>(null)
  const [showUnlock, setShowUnlock] = useState(false)
  /* The read-aloud prompt only exists if the parent has switched recording on
   * (mig 061). Fetched up-front rather than at completion time so the child
   * never waits on a round-trip at the emotional peak of the story. */
  const [canRecord, setCanRecord] = useState(false)
  const [askRecord, setAskRecord] = useState(false)
  /* What handleComplete decided to do next, deferred until the read-aloud is
   * finished or skipped. The prompt goes FIRST: a badge popup is a reward for
   * what they just did, but reading it aloud is the thing the product exists
   * for, and it has to land while the story is still warm. */
  const afterRecord = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const [storyRes, childRes] = await Promise.all([
        api.get<FullStory>(`/api/stories/${id}?lang=${lang}`),
        api.get<Child[]>('/api/children'),
      ])
      if (storyRes.data) setStory(storyRes.data)
      const child = pickChild(childRes.data ?? [])
      if (child) setChildId(child.id)
      const consent = await api.get<{ consented_at: string | null }>('/api/read-aloud/consent')
      setCanRecord(!!consent.data?.consented_at)
    }
    load()
  }, [id, router, lang])

  // Self-heal: an AI story (created for this child) with any silent page builds
  // its own audio (single cloud voice), then we refetch so بشنو plays — no manual step.
  useEffect(() => {
    if (!story) return
    const isAi = !!(story as { created_for_child?: string | null }).created_for_child
    if (!isAi || !story.pages.some(p => !p.audio_url)) return
    let cancelled = false
    api.post(`/api/ai/stories/${story.id}/audio`, {})
      .then(async () => {
        if (cancelled) return
        const r = await api.get<FullStory>(`/api/stories/${story.id}`)
        if (r.data && !cancelled) setStory(r.data)
      })
      .catch(() => { /* leave text-only; the manual button remains */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id])

  // Self-heal translations: if the family language isn't English/none and some
  // pages lack it, translate on demand (AI, cached) then refetch with the lang.
  useEffect(() => {
    if (!story || lang === 'none' || lang === 'en') return
    if (!story.pages.some(p => !p.translation)) return
    let cancelled = false
    api.post(`/api/ai/stories/${story.id}/translate`, { lang })
      .then(async () => {
        if (cancelled) return
        const r = await api.get<FullStory>(`/api/stories/${story.id}?lang=${lang}`)
        if (r.data && !cancelled) setStory(r.data)
      })
      .catch(() => { /* leave Persian-only; nothing breaks */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id])

  async function handlePageChange(page: number) {
    if (!childId || !story) return
    await api.post('/api/progress/story', { child_id: childId, story_id: story.id, last_page: page })
  }

  async function handleComplete() {
    if (!childId || !story) return
    try {
      // new_badges / promotions are top-level on the response, not under `data`.
      const res = await api.post('/api/progress/story',
        { child_id: childId, story_id: story.id, last_page: story.pages.length - 1, completed: true }
      ) as { new_badges?: Badge[]; promotions?: Promotion[] }
      const next = () => {
        if (res.new_badges?.[0]) setNewBadge(res.new_badges[0])
        else if (res.promotions?.length) {
          setShowUnlock(true)
          setTimeout(() => router.push('/child/home'), 2600)
        }
        else router.push('/child/home')
      }
      if (canRecord && childId) { afterRecord.current = next; setAskRecord(true) }
      else next()
    } catch {
      router.push('/child/home')   // never leave the child stuck on the last page
    }
  }

  /* Runs on every exit from the prompt — sent, skipped, or failed — so a
   * recording that doesn't upload still can't strand the child on this screen. */
  function finishRecording() {
    setAskRecord(false)
    const next = afterRecord.current
    afterRecord.current = null
    if (next) next(); else router.push('/child/home')
  }

  if (!story) return <LoadingScreen message="در حال بارگذاری داستان..." />

  if (askRecord) {
    return <ReadAloud childId={childId} storyId={story.id} onDone={finishRecording} />
  }

  if (showUnlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 text-center gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <p className="text-3xl" aria-hidden="true">🔓✨</p>
        <h1 className="text-2xl font-bold text-text-primary">محتوای جدید باز شد!</h1>
        <p className="text-text-secondary persian-text">داستان‌ها و درس‌های تازه در خانه منتظرت هستند</p>
      </div>
    )
  }

  return (
    <>
      {newBadge && <RewardPopup badge={newBadge} onClose={() => router.push('/child/home')} />}

      <StoryReader
        story={story}
        showBilingual={lang !== 'none'}
        onBack={() => router.push('/child/story')}
        onPageChange={handlePageChange}
        onComplete={handleComplete}
      />
    </>
  )
}
