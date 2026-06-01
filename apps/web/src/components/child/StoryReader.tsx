'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { StoryPage, Story } from '@koodakbook/shared'
import BilingualText from '../shared/BilingualText'
import { mediaUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'

interface Props {
  story: Story & { pages: StoryPage[] }
  showBilingual: boolean
  onPageChange?: (page: number) => void
  onComplete?: () => void
}

export default function StoryReader({ story, showBilingual, onPageChange, onComplete }: Props) {
  const [currentPage, setCurrentPage] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const page = story.pages[currentPage]
  const isLast = currentPage === story.pages.length - 1

  function goNext() {
    playTap()
    if (isLast) { onComplete?.(); return }
    const next = currentPage + 1
    setCurrentPage(next)
    onPageChange?.(next)
    audioRef.current?.load()
  }

  function goPrev() {
    playTap()
    if (currentPage === 0) return
    const prev = currentPage - 1
    setCurrentPage(prev)
    onPageChange?.(prev)
  }

  if (!page) return null

  return (
    <div className="flex flex-col h-full min-h-screen bg-amber-50">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${((currentPage + 1) / story.pages.length) * 100}%` }}
        />
      </div>

      {/* Story title */}
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <h1 className="font-bold text-gray-800">{story.title_persian}</h1>
        <span className="text-sm text-gray-400">{currentPage + 1} / {story.pages.length}</span>
      </div>

      {/* Page illustration */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentPage} className="w-full"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            {mediaUrl(page.image_url) ? (
              <img src={mediaUrl(page.image_url)!} alt={`صفحه ${page.page_number}`}
                className="rounded-3xl shadow-lg max-h-64 object-contain w-full" />
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl shadow-lg flex items-center justify-center">
                <span className="text-8xl">📖</span>
              </div>
            )}

            {/* Text */}
            <div className="bg-white rounded-2xl p-6 shadow-sm w-full mt-4">
              <BilingualText
                persian={page.text_persian}
                english={showBilingual ? page.text_english : null}
                persianClassName="text-2xl font-bold leading-relaxed"
                englishClassName="text-base mt-2"
              />
              {mediaUrl(page.audio_url) && (
                <motion.button onClick={() => audioRef.current?.play()}
                  whileTap={{ scale: 0.9 }}
                  className="mt-4 flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-full text-sm font-medium">
                  <span className="text-xl">🔊</span> بشنو
                  <audio ref={audioRef} src={mediaUrl(page.audio_url)!} preload="none" />
                </motion.button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 pt-4 flex gap-3">
        <motion.button onClick={goPrev} disabled={currentPage === 0} whileTap={{ scale: 0.93 }}
          className="flex-1 py-4 rounded-2xl border-2 border-gray-300 text-gray-500 font-bold disabled:opacity-30">
          ← قبلی
        </motion.button>
        <motion.button onClick={goNext} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
          className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-lg shadow-md"
        >
          {isLast ? '✅ تمام شد!' : 'بعدی →'}
        </motion.button>
      </div>
    </div>
  )
}
