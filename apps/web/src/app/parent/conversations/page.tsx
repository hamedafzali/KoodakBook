'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { isLoggedIn } from '@/lib/auth'
import { PageHeader, Panel } from '@/components/parent/flat'
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
    <div className="min-h-screen bg-parent-bg">
      <PageHeader
        title="گفت‌وگوها"
        subtitle="هر چیزی که شخصیت‌ها با کودک شما گفته‌اند — شفاف و قابل بازبینی"
        back="/parent/settings"
      />

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <select value={childId} onChange={e => setChildId(e.target.value)} aria-label="کودک"
            className="flex-1 min-h-[44px] border border-border rounded-xl px-3 py-2 text-sm bg-parent-surface text-parent-text">
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={slug} onChange={e => setSlug(e.target.value)} aria-label="شخصیت"
            className="flex-1 min-h-[44px] border border-border rounded-xl px-3 py-2 text-sm bg-parent-surface text-parent-text">
            {characters.map(c => <option key={c.slug} value={c.slug}>{c.name_persian}</option>)}
          </select>
        </div>

        {turns === null ? (
          <p className="text-center text-sm text-parent-muted py-8">در حال بارگذاری…</p>
        ) : turns.length === 0 ? (
          <Panel>
            <p className="text-center text-sm text-parent-muted py-4 persian-text">
              هنوز گفت‌وگویی بین {child?.name ?? 'کودک'} و {character?.name_persian ?? 'این شخصیت'} انجام نشده.
            </p>
          </Panel>
        ) : (
          <Panel className="space-y-2">
            {/* Who said what is carried by side AND by tint, not by side
                alone — the two columns are only a few pixels apart at the
                widths a phone gives this, and a transcript that can be
                misattributed is worse than no transcript. */}
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'child' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2 text-sm persian-text text-parent-text"
                  style={{ background: t.role === 'child' ? 'var(--ramp-brand-soft)' : 'rgb(241 245 249)' }}
                >
                  <span className="block text-[10px] text-parent-muted mb-0.5">
                    {t.role === 'child' ? child?.name ?? 'کودک' : character?.name_persian}
                    {' · '}{new Date(t.created_at).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {t.text}
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>
    </div>
  )
}
