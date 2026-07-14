'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import type { Child, AppCharacter } from '@koodakbook/shared'

/* Parent transcript view (character plan §4 — trust feature): every word the
 * characters exchanged with each child, reviewable. Read-only by design. */

interface Turn { role: 'child' | 'character'; text: string; created_at: string }

export default function ConversationsPage() {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>([])
  const [characters, setCharacters] = useState<AppCharacter[]>([])
  const [childId, setChildId] = useState('')
  const [slug, setSlug] = useState('')
  const [turns, setTurns] = useState<Turn[] | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return }
    Promise.all([api.get<Child[]>('/api/children'), api.get<AppCharacter[]>('/api/characters')])
      .then(([c, ch]) => {
        setChildren(c.data ?? []); setCharacters(ch.data ?? [])
        if (c.data?.[0]) setChildId(c.data[0].id)
        if (ch.data?.[0]) setSlug(ch.data[0].slug)
      })
  }, [router])

  useEffect(() => {
    if (!childId || !slug) return
    setTurns(null)
    api.get<Turn[]>(`/api/characters/${slug}/chat/${childId}`).then(r => setTurns(r.data ?? []))
  }, [childId, slug])

  const child = children.find(c => c.id === childId)
  const character = characters.find(c => c.slug === slug)

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3 pt-2">
          <Link href="/parent/settings" className="text-slate-400 hover:text-slate-600" aria-label="برگشت">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <div>
            <h1 className="font-bold text-xl text-slate-800">گفت‌وگوها</h1>
            <p className="text-xs text-slate-400">هر چیزی که شخصیت‌ها با کودک شما گفته‌اند — شفاف و قابل بازبینی</p>
          </div>
        </div>

        <div className="flex gap-2">
          <select value={childId} onChange={e => setChildId(e.target.value)} aria-label="کودک"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={slug} onChange={e => setSlug(e.target.value)} aria-label="شخصیت"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
            {characters.map(c => <option key={c.slug} value={c.slug}>{c.name_persian}</option>)}
          </select>
        </div>

        {turns === null ? (
          <p className="text-center text-sm text-slate-400 py-8">در حال بارگذاری…</p>
        ) : turns.length === 0 ? (
          <p className="text-center text-sm text-slate-400 bg-white rounded-2xl py-8 shadow-sm">
            هنوز گفت‌وگویی بین {child?.name ?? 'کودک'} و {character?.name_persian ?? 'این شخصیت'} انجام نشده.
          </p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'child' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm persian-text ${
                  t.role === 'child' ? 'bg-amber-50 text-slate-800' : 'bg-slate-100 text-slate-700'}`}>
                  <span className="block text-[10px] text-slate-400 mb-0.5">
                    {t.role === 'child' ? child?.name ?? 'کودک' : character?.name_persian}
                    {' · '}{new Date(t.created_at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
