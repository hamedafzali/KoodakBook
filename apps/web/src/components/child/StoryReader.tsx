'use client'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { parseSceneRef, toPersianDigits, type StoryPage, type Story, type SceneSlug, type SceneTime } from '@koodakbook/shared'
import Emoji from '../shared/Emoji'
import SceneBackdrop from './SceneBackdrop'
import { ClayButton, softClayVars } from './clay'
import { roomBand } from './kit'
import { Icon } from '@/components/icons'
import { mediaUrl, thumbUrl } from '@/lib/media'
import { playTap } from '@/lib/sounds'
import { speakOrPlay, speakPersian, stopSpeaking } from '@/lib/speech'

interface Props {
  story: Story & { pages: StoryPage[] }
  showBilingual: boolean
  onBack?: () => void
  onPageChange?: (page: number) => void
  onComplete?: () => void
}

/** Split Persian page text into whitespace-vs-word chunks, preserving every
 *  character (spacing included) so re-joining the tokens reproduces the
 *  original string exactly — only the word chunks become tap targets. A
 *  "word" here just means "non-whitespace run", trailing punctuation and
 *  all; browser TTS handles a stray «،» or «.» fine, and stripping it would
 *  mean re-deriving the original text to keep layout identical, for no
 *  real benefit. */
function tokenizeWords(text: string): { text: string; tappable: boolean }[] {
  return text.split(/(\s+)/).filter(t => t.length > 0).map(t => ({ text: t, tappable: !/^\s+$/.test(t) }))
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

  // Prefetch the NEXT page's clip while this one plays, so the page-turn
  // speaks instantly instead of waiting on the network.
  useEffect(() => {
    const next = story.pages[currentPage + 1]
    const url = mediaUrl(next?.audio_url)
    if (!url) return
    const a = new Audio()
    a.preload = 'auto'
    a.src = url
    // no play() — just warm the browser's media cache
  }, [currentPage, story.pages])

  // Backdrop per page from scene_plan; a page without one inherits the
  // previous page's scene (stories rarely change location every page), and the
  // whole story falls back to a friendly default.
  const scenes = useMemo<{ scene: SceneSlug; time: SceneTime }[]>(() => {
    // Folded into reduce's own accumulator instead of a `let` reassigned from
    // inside .map (react-hooks/immutability — pre-existing finding, fixed
    // while already in this file for the tap-word change above): same
    // "inherit the previous page's scene" logic, without mutating a variable
    // captured across render.
    const out: { scene: SceneSlug; time: SceneTime }[] = []
    story.pages.reduce((last, p) => {
      const ref = parseSceneRef(p.scene_plan?.scene, p.scene_plan?.time) ?? last
      out.push(ref)
      return ref
    }, { scene: 'park', time: 'day' } as { scene: SceneSlug; time: SceneTime })
    return out
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
    // h-dvh + overflow-hidden pins this to the actual viewport height (not
    // just its minimum) so the header and nav can never be pushed off by a
    // tall page — only the middle content region scrolls. Previously this
    // was min-h-screen with no overflow cap, so a page whose image + text
    // was taller than the viewport grew the whole layout past it and shoved
    // "بعدی" below the fold, requiring a scroll to advance every page.
    <div className="flex flex-col h-dvh overflow-hidden child-bg">

      {/* Header */}
      {/* The stories room's band (roomBand) — same as the shelf's header. */}
      <div style={roomBand('stories')} className="shrink-0 backdrop-blur-md border-b rounded-b-[1.75rem] shadow-card px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <motion.button
              onClick={onBack}
              whileTap={{ scale: 0.85 }}
              aria-label="برگشت به لیست داستان‌ها"
              className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
            >
              <Icon name="back" size="md" strokeWidth={2.5} />
            </motion.button>
          )}
          <h1 className="flex-1 min-w-0 font-display font-black text-text-primary truncate persian-text">{story.title_persian}</h1>
          {/* Persian ordinal reads correctly in RTL on its own — an LTR
              "N / total" string flips under bidi (e.g. "12 / 1"). */}
          {/* Polite live region: a page turn otherwise says nothing to a
              screen reader (focus stays on «بعدی»). */}
          <span className="text-sm text-text-secondary shrink-0 persian-text" aria-live="polite">
            {toPersianDigits(currentPage + 1)} از {toPersianDigits(story.pages.length)}
          </span>
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
                <span className={`w-2.5 h-2.5 rounded-full ${i <= currentPage ? 'bg-stories-deep' : 'bg-border'}`} />
                {i === currentPage && (
                  <motion.span layoutId="story-walker" transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="absolute -top-2 text-sm leading-none select-none" aria-hidden="true">{/* EMOJI-CONTENT: the read-along chick follows the words. */}🐣</motion.span>
                )}
              </div>
              {i < story.pages.length - 1 && (
                <div className={`flex-1 h-0.5 border-t-2 border-dotted ${i < currentPage ? 'border-stories-bright' : 'border-border'}`} />
              )}
            </div>
          ))}
          <span className="shrink-0 text-sm ms-1 leading-none select-none" aria-hidden="true">🚩</span>
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
            {/* Illustration: a real page image wins. No story currently has
                per-page art (186 pages, 0 images) — until that's generated,
                reuse the story's own cover, muted, so the page still carries
                that story's visual identity instead of a generic scene. Only
                a story with no cover either falls back to the scene library. */}
            {mediaUrl(page.image_url) ? (
              <img
                src={thumbUrl(page.image_url, 480)!}
                alt={`صفحه ${page.page_number} از داستان ${story.title_persian}`}
                className="rounded-lg shadow-lg w-full max-h-64 object-contain lg:w-1/2 lg:max-h-[64vh] lg:self-center"
              />
            ) : mediaUrl(story.cover_url) ? (
              <div className="relative w-full h-52 rounded-lg shadow-md overflow-hidden lg:w-1/2 lg:h-[64vh] lg:self-center">
                <Image
                  src={mediaUrl(story.cover_url)!}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover opacity-40 grayscale"
                />
              </div>
            ) : (
              <SceneBackdrop scene={sceneRef.scene} time={sceneRef.time}
                className="w-full h-52 shadow-md lg:w-1/2 lg:h-[64vh]" />
            )}

            {/* Story text — Persian words are individually tappable (each one
                calls speakPersian on its own), so a child can hear a single
                word they didn't catch without replaying the whole page. */}
            <div className="clay-static p-5 lg:w-1/2 lg:p-8 lg:self-stretch lg:flex lg:flex-col lg:justify-center" style={softClayVars('stories')}>
              <div className="space-y-1">
                <p lang="fa" dir="rtl" className="persian-text text-start persian-body-lg font-bold">
                  {tokenizeWords(page.text_persian).map((tok, i) => tok.tappable ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { playTap(); speakPersian(tok.text) }}
                      aria-label={`شنیدن «${tok.text}»`}
                      className="inline bg-transparent border-0 p-0 m-0 font-inherit text-inherit rounded px-0.5 -mx-0.5 hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer"
                    >
                      {tok.text}
                    </button>
                  ) : (
                    <span key={i}>{tok.text}</span>
                  ))}
                </p>
                {showBilingual && (page.translation ?? page.text_english) && (
                  <p lang="en" dir="ltr" className="text-start text-text-secondary text-base mt-2">
                    {page.translation ?? page.text_english}
                  </p>
                )}
              </div>
              <motion.button
                onClick={() => { playTap(); readPage() }}
                whileTap={{ scale: 0.9 }}
                aria-label="پخش دوباره‌ی صدای این صفحه"
                className="mt-4 flex items-center gap-2 bg-stories-soft text-stories-ink px-4 py-2.5 rounded-full text-sm font-bold transition-colors min-h-[56px]"
              >
                <Emoji name="speaker-high-volume" size={22} />
                <span>دوباره بشنو</span>
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div
        className="shrink-0 px-4 pb-6 pt-3 flex gap-3 bg-surface/80 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <motion.button
          onClick={goPrev}
          disabled={currentPage === 0}
          whileTap={{ scale: 0.93 }}
          aria-label="صفحه قبلی"
          className="clay-option flex-1 py-4 font-bold disabled:opacity-30 min-h-[56px] touch-target-child"
          style={softClayVars('stories')}
        >
          صفحه قبل
        </motion.button>
        {/* The shared clay primary, not a one-off gradient slab. The name
            keeps the visible words in it (WCAG 2.5.3) — «پایان داستان» alone
            didn't contain «تمام شد», which is what a voice user would say. */}
        <ClayButton
          ramp="brand" size="lg" className="flex-[2]"
          onClick={goNext}
          aria-label={isLast ? 'تمام شد، پایان داستان' : 'صفحه بعدی'}
        >
          {isLast ? <><span aria-hidden="true">✅</span> تمام شد!</> : 'بعدی ←'}
        </ClayButton>
      </div>
    </div>
  )
}
