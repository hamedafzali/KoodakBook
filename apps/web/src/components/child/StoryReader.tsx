'use client'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { parseSceneRef, type StoryPage, type Story, type SceneSlug, type SceneTime } from '@koodakbook/shared'
import BilingualText from '../shared/BilingualText'
import SceneBackdrop from './SceneBackdrop'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'
import { speakOrPlay, stopSpeaking } from '@/lib/speech'

interface Props {
  story: Story & { pages: StoryPage[] }
  showBilingual: boolean
  onBack?: () => void
  onPageChange?: (page: number) => void
  onComplete?: () => void
}

export default function StoryReader({ story, showBilingual, onBack, onPageChange, onComplete }: Props) {
  const [currentPage, setCurrentPage] = useState(0)
  const page = story.pages[currentPage]
  const isLast = currentPage === story.pages.length - 1
  const progress = Math.round(((currentPage + 1) / story.pages.length) * 100)

  /** Read this page aloud (recorded clip → premium/free → TTS fallback). */
  function readPage() {
    if (page) speakOrPlay(page.audio_url, page.text_persian)
  }

  // Auto-read each page the moment it appears — the child listens immediately;
  // «بشنو» stays for a replay. A short delay lets the page-turn settle and any
  // previous page's audio stop. Stops audio when leaving the reader.
  useEffect(() => {
    const t = setTimeout(readPage, 350)
    return () => { clearTimeout(t); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, story.id])

  // Backdrop per page from scene_plan; a page without one inherits the
  // previous page's scene (stories rarely change location every page), and the
  // whole story falls back to a friendly default.
  const scenes = useMemo<{ scene: SceneSlug; time: SceneTime }[]>(() => {
    let last: { scene: SceneSlug; time: SceneTime } = { scene: 'park', time: 'day' }
    return story.pages.map(p => {
      const ref = parseSceneRef(p.scene_plan?.scene, p.scene_plan?.time)
      if (ref) last = ref
      return last
    })
  }, [story.pages])
  const sceneRef = scenes[currentPage]

  function goNext() {
    playTap()
    stopSpeaking()
    if (isLast) { onComplete?.(); return }
    const next = currentPage + 1
    setCurrentPage(next)
    onPageChange?.(next)
  }

  function goPrev() {
    playTap()
    stopSpeaking()
    if (currentPage === 0) return
    const prev = currentPage - 1
    setCurrentPage(prev)
    onPageChange?.(prev)
  }

  if (!page) return null

  return (
    <div className="flex flex-col h-full min-h-screen child-bg">

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-amber-100 px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <motion.button
              onClick={onBack}
              whileTap={{ scale: 0.85 }}
              aria-label="برگشت به لیست داستان‌ها"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </motion.button>
          )}
          <h1 className="flex-1 font-bold text-gray-800 truncate persian-text">{story.title_persian}</h1>
          <span className="text-sm text-gray-400 shrink-0">{currentPage + 1} / {story.pages.length}</span>
        </div>

        {/* Progress path — a trail of stepping stones, one per page; the
            walker hops a stone per page-turn and a flag waits at the end.
            Kids read "how far to go" spatially, without numbers. */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`پیشرفت داستان: ${progress} درصد`}
          className="mt-2 flex items-center gap-0"
          dir="rtl"
        >
          {story.pages.map((_, i) => (
            <div key={i} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div className="relative shrink-0 w-5 h-5 flex items-center justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${i <= currentPage ? 'bg-amber-500' : 'bg-gray-200'}`} />
                {i === currentPage && (
                  <motion.span layoutId="story-walker" transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="absolute -top-2 text-sm leading-none select-none">🐣</motion.span>
                )}
              </div>
              {i < story.pages.length - 1 && (
                <div className={`flex-1 h-0.5 border-t-2 border-dotted ${i < currentPage ? 'border-amber-400' : 'border-gray-200'}`} />
              )}
            </div>
          ))}
          <span className="shrink-0 text-sm mr-1 leading-none select-none" aria-hidden="true">🚩</span>
        </div>
      </div>

      {/* Page content — stacked on mobile, a two-page spread at lg
          (RTL: illustration left, text right, vertically centred) */}
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 gap-4 lg:px-10 lg:py-8 lg:justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            className="flex flex-col gap-4 lg:flex-row-reverse lg:items-center lg:gap-10 lg:w-full lg:max-w-5xl lg:mx-auto"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Illustration: a real page image wins; otherwise the scene
                library paints the page's location with a slow Ken Burns drift. */}
            {mediaUrl(page.image_url) ? (
              <img
                src={mediaUrl(page.image_url)!}
                alt={`صفحه ${page.page_number} از داستان ${story.title_persian}`}
                className="rounded-lg shadow-lg w-full max-h-64 object-contain lg:w-1/2 lg:max-h-[64vh] lg:self-center"
              />
            ) : (
              <SceneBackdrop scene={sceneRef.scene} time={sceneRef.time}
                className="w-full h-52 shadow-md lg:w-1/2 lg:h-[64vh]" />
            )}

            {/* Story text */}
            <div className="bg-white rounded-lg p-5 shadow-sm lg:w-1/2 lg:p-8 lg:self-stretch lg:flex lg:flex-col lg:justify-center">
              <BilingualText
                persian={page.text_persian}
                english={showBilingual ? page.text_english : null}
                persianClassName="persian-body-lg font-bold"
                englishClassName="text-base mt-2"
              />
              <motion.button
                onClick={() => { playTap(); readPage() }}
                whileTap={{ scale: 0.9 }}
                aria-label="پخش دوباره‌ی صدای این صفحه"
                className="mt-4 flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2.5 rounded-full text-sm font-medium transition-colors min-h-[44px]"
              >
                <span className="text-xl">🔊</span>
                <span>دوباره بشنو</span>
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div
        className="px-4 pb-6 pt-3 flex gap-3 bg-white/80 backdrop-blur-md border-t border-amber-100"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <motion.button
          onClick={goPrev}
          disabled={currentPage === 0}
          whileTap={{ scale: 0.93 }}
          aria-label="صفحه قبلی"
          className="flex-1 py-4 rounded-md border-2 border-gray-200 text-gray-500 font-bold disabled:opacity-30 min-h-[56px] touch-target"
        >
          صفحه قبل
        </motion.button>
        <motion.button
          onClick={goNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          aria-label={isLast ? 'پایان داستان' : 'صفحه بعدی'}
          className="flex-[2] py-4 rounded-md bg-brand-gradient text-white font-bold text-lg shadow-md min-h-[56px] touch-target"
        >
          {isLast ? '✅ تمام شد!' : 'بعدی ←'}
        </motion.button>
      </div>
    </div>
  )
}
