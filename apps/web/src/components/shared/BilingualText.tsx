'use client'
import { useState } from 'react'

interface Props {
  persian: string
  english: string | null
  persianClassName?: string
  englishClassName?: string
  showToggle?: boolean
}

export default function BilingualText({ persian, english, persianClassName, englishClassName, showToggle = false }: Props) {
  const [showEnglish, setShowEnglish] = useState(true)

  return (
    <div className="space-y-1">
      <p
        lang="fa"
        dir="rtl"
        className={`persian-text text-right ${persianClassName ?? 'text-xl font-medium'}`}
      >
        {persian}
      </p>
      {english && showEnglish && (
        <p
          lang="en"
          dir="ltr"
          className={`text-left text-gray-500 ${englishClassName ?? 'text-base'}`}
        >
          {english}
        </p>
      )}
      {showToggle && english && (
        <button
          onClick={() => setShowEnglish(v => !v)}
          aria-expanded={showEnglish}
          aria-controls="english-translation"
          className="text-xs text-amber-600 hover:underline mt-1 transition-colors"
        >
          {showEnglish ? 'پنهان کردن ترجمه' : 'نمایش ترجمه'}
        </button>
      )}
    </div>
  )
}
