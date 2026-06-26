'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StoryPage, Story } from '@koodakbook/shared'
import BilingualText from '../shared/BilingualText'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'
import { speakPersian, stopSpeaking } from '@/lib/speech'

interface Props {
  story: Story & { pages: StoryPage[] }
  showBilingual: boolean
  onBack?: () => void
  onPageChange?: (page: number) => void
  onComplete?: () => void
}

export default function StoryReader({ story, showBilingual, onBack, onPageChange, onComplete }: Props) {
  const [currentPage, setCurrentPage] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const page = story.pages[currentPage]
  const isLast = currentPage === story.pages.length - 1
  const progress = Math.round(((currentPage + 1) / story.pages.length) * 100)

  function goNext() {
    playTap()
    stopSpeaking()
    if (isLast) { onComplete?.(); return }
    const next = currentPage + 1
    setCurrentPage(next)
    onPageChange?.(next)
    audioRef.current?.load()
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

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`پیشرفت داستان: ${progress} درصد`}
          className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 flex flex-col overflow-y-auto px-4 py-4 gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            className="flex flex-col gap-4"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Illustration */}
            {mediaUrl(page.image_url) ? (
              <img
                src={mediaUrl(page.image_url)!}
                alt={`صفحه ${page.page_number} از داستان ${story.title_persian}`}
                className="rounded-lg shadow-lg w-full max-h-64 object-contain"
              />
            ) : (
              <div className="w-full h-52 bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg shadow-md flex items-center justify-center">
                <span className="text-7xl">📖</span>
              </div>
            )}

            {/* Story text */}
            <div className="bg-white rounded-lg p-5 shadow-sm">
              <BilingualText
                persian={page.text_persian}
                english={showBilingual ? page.text_english : null}
                persianClassName="persian-body-lg font-bold"
                englishClassName="text-base mt-2"
              />
              <motion.button
                onClick={() => {
                  const recorded = mediaUrl(page.audio_url)
                  if (recorded && audioRef.current) audioRef.current.play().catch(() => speakPersian(page.text_persian))
                  else speakPersian(page.text_persian)
                }}
                whileTap={{ scale: 0.9 }}
                aria-label="پخش صدای این صفحه"
                className="mt-4 flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2.5 rounded-full text-sm font-medium transition-colors min-h-[44px]"
              >
                <span className="text-xl">🔊</span>
                <span>بشنو</span>
                {mediaUrl(page.audio_url) && <audio ref={audioRef} src={mediaUrl(page.audio_url)!} preload="none" />}
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
          className="flex-[2] py-4 rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md min-h-[56px] touch-target"
        >
          {isLast ? '✅ تمام شد!' : 'بعدی ←'}
        </motion.button>
      </div>
    </div>
  )
}
