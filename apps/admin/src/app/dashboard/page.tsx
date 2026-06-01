'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Stats { users: number; children: number; words: number; stories: number; lessons: number }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get<Stats>('/api/admin/stats').then(r => { if (r.data) setStats(r.data) })
  }, [])

  const cards = [
    { label: 'کاربران',   value: stats?.users,    emoji: '👨‍👩‍👧' },
    { label: 'کودکان',    value: stats?.children,  emoji: '👶' },
    { label: 'کلمات',     value: stats?.words,     emoji: '📝' },
    { label: 'داستان‌ها', value: stats?.stories,   emoji: '📖' },
    { label: 'درس‌ها',    value: stats?.lessons,   emoji: '📚' },
  ]

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">داشبورد</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <div className="text-3xl mb-2">{c.emoji}</div>
            <div className="text-3xl font-bold text-gray-800">{c.value ?? '—'}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
