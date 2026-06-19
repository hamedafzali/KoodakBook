'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { pickChild } from '@/lib/activeChild'
import PageHeader from '@/components/child/PageHeader'
import LoadingScreen from '@/components/child/LoadingScreen'
import Mascot from '@/components/child/Mascot'
import type { Child } from '@koodakbook/shared'

// Theme is sent to the backend as free text; the emoji/label are just the UI.
const THEMES = [
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

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    async function load() {
      const res = await api.get<Child[]>('/api/children')
      setChild(pickChild(res.data ?? []) ?? null)
      setLoading(false)
    }
    load()
  }, [router])

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

  // Building the story takes a few seconds — show a friendly waiting screen.
  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center child-bg p-6 gap-5 text-center">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <Mascot size={120} mood="excited" />
        </motion.div>
        <h1 className="text-2xl font-bold text-gray-800">در حال نوشتن داستان تو... ✨</h1>
        <p className="text-gray-500 persian-text">یک لحظه صبر کن، دارم برایت یک داستان می‌سازم!</p>
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
        title="یک داستان برای من بساز ✨"
        subtitle="یک موضوع انتخاب کن"
        gradientClass="from-fuchsia-500 to-purple-600"
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
              className={`flex items-center gap-3 px-4 py-4 rounded-[1.25rem] border-2 text-right transition-colors min-h-[64px] ${
                theme === t.key ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'
              }`}
            >
              <span className="text-3xl" aria-hidden="true">{t.emoji}</span>
              <span className={`font-bold ${theme === t.key ? 'text-purple-800' : 'text-gray-700'}`}>{t.label}</span>
            </motion.button>
          ))}
        </div>

        {error && <p role="alert" className="text-red-500 text-sm mt-4 persian-text text-center">{error}</p>}

        <motion.button
          onClick={generate}
          disabled={!child}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-6 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-bold py-4 rounded-[1.25rem] text-lg shadow-md disabled:opacity-50 touch-target"
        >
          بساز! ✨
        </motion.button>
      </div>
    </div>
  )
}
