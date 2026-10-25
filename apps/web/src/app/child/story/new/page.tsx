'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import PageHeader from '@/components/child/PageHeader'
import { ClayButton } from '@/components/child/clay'
import LoadingScreen from '@/components/child/LoadingScreen'
import ErrorState from '@/components/child/ErrorState'
import Mascot from '@/components/child/Mascot'
import type { Child } from '@koodakbook/shared'

// Theme is sent to the backend as free text; the emoji/label are just the UI.
const THEMES = [
  // EMOJI-CONTENT: these are story *subjects* a pre-reader picks by picture —
  // the picture IS the label. Outline icons would make them harder to tell
  // apart, not easier. Wants illustrated topic cards.
  { key: 'حیوانات', emoji: '🦊', label: 'حیوانات' },
  { key: 'فضا و ستاره‌ها', emoji: '🚀', label: 'فضا' },
  { key: 'دریا و ماهی‌ها', emoji: '🐠', label: 'دریا' },
  { key: 'خانواده', emoji: '👨‍👩‍👧', label: 'خانواده' },
  { key: 'دوستی', emoji: '🤝', label: 'دوستی' },
  { key: 'ماجراجویی', emoji: '🗺️', label: 'ماجراجویی' },
  { key: 'جنگل', emoji: '🌳', label: 'جنگل' },
  { key: 'جشن تولد', emoji: '🎂', label: 'تولد' },
]

export default function NewStoryPage() {
  const router = useRouter()
  const [child, setChild] = useState<Child | null>(null)
  const [theme, setTheme] = useState<string>(THEMES[0].key)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A failed fetch used to leave «بساز!» disabled with nothing saying why.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    let cancelled = false
    async function load() {
      const res = await api.get<Child[]>('/api/children')
      if (cancelled) return
      if (!res.data) setLoadError(res.error ?? 'اتصال برقرار نشد. دوباره تلاش کن')
      else setChild(pickChild(res.data) ?? null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [router, attempt])

  async function generate() {
    if (!child || generating) return
    setGenerating(true)
    setError(null)
    const res = await api.post<{ id: string }>('/api/ai/stories/generate', {
      child_id: child.id,
      theme,
    })
    if (res.data?.id) {
      router.push(`/child/story/${res.data.id}`)
    } else {
      setError(res.error ?? 'ساختن داستان موفق نبود. دوباره تلاش کن')
      setGenerating(false)
    }
  }

  if (loading) return <LoadingScreen message="در حال آماده‌سازی..." />
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => { setLoadError(null); setLoading(true); setAttempt(a => a + 1) }}
        backHref="/child/story"
        backLabel="برگشت به داستان‌ها"
      />
    )
  }

  // Building the story takes a few seconds — show a friendly waiting screen.
  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <h1 className="font-display text-2xl font-black text-text-primary" role="status">در حال نوشتن داستان تو... <span aria-hidden="true">✨</span></h1>
        <p className="text-text-secondary persian-text">یک لحظه صبر کن، دارم برایت یک داستان می‌سازم!</p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-3 h-3 rounded-full bg-amber-400"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen child-bg pb-10">
      <PageHeader
        title="یک داستان برای من بساز"
        subtitle="یک موضوع انتخاب کن"
        module="stories"
        emoji="✨"
      />

      <div className="px-4 pt-6 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="موضوع داستان">
          {THEMES.map(t => (
            <motion.button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={theme === t.key}
              onClick={() => setTheme(t.key)}
              whileTap={{ scale: 0.96 }}
              className={`flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-start transition-colors min-h-[64px] ${
                theme === t.key ? 'border-purple-500 bg-purple-50' : 'border-border bg-white hover:border-purple-300'
              }`}
            >
              <span className="text-3xl" aria-hidden="true">{t.emoji}</span>
              <span className={`font-bold ${theme === t.key ? 'text-purple-800' : 'text-text-primary'}`}>{t.label}</span>
            </motion.button>
          ))}
        </div>

        {error && <p role="alert" className="text-red-700 text-sm mt-4 persian-text text-center">{error}</p>}

        <ClayButton ramp="stories" size="lg" className="mt-6" onClick={generate} disabled={!child}>
          بساز! <span aria-hidden="true">✨</span>
        </ClayButton>
      </div>
    </div>
  )
}
