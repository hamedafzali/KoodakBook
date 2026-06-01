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
      <p className={`persian-text ${persianClassName ?? 'text-xl font-medium'}`}>{persian}</p>
      {english && showEnglish && (
        <p className={`ltr text-gray-500 ${englishClassName ?? 'text-sm'}`}>{english}</p>
      )}
      {showToggle && english && (
        <button
          onClick={() => setShowEnglish(v => !v)}
          className="text-xs text-amber-500 hover:underline mt-1"
        >
          {showEnglish ? 'پنهان کردن ترجمه' : 'نمایش ترجمه'}
        </button>
      )}
    </div>
  )
}
