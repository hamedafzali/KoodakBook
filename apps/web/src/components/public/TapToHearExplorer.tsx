'use client'
import { useState } from 'react'
import Link from 'next/link'
import { speakOrPlay } from '@/lib/speech'
import { playTap } from '@/lib/sounds'

/**
 * One grid item: a tappable tile (a letter, or a word) plus the detail it
 * reveals when tapped. Shared by /alphabet and /first-100-words — the two
 * public, signup-free content pages — so both get the same tap-to-hear
 * mechanics and the same signup nudge instead of two hand-rolled copies.
 */
export interface ExplorerItem {
  id: string
  tile: string
  tileSub?: string
  audioUrl: string | null
  ttsFallback: string
  detailTitle: string
  detailSubtitle: string
  detailImage?: string | null
  detailEmoji?: string | null
}

export function TapToHearExplorer({
  items,
  nudgeText,
}: {
  items: ExplorerItem[]
  /** Shown once a visitor has tapped at least one tile — earned, not upfront. */
  nudgeText: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find(i => i.id === selectedId) ?? null

  function select(item: ExplorerItem) {
    playTap()
    setSelectedId(item.id)
    speakOrPlay(item.audioUrl, item.ttsFallback)
  }

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => select(item)}
            aria-pressed={item.id === selectedId}
            className={`aspect-square rounded-2xl border flex items-center justify-center text-xl sm:text-2xl font-bold transition
              ${item.id === selectedId
                ? 'bg-brand-light border-brand text-brand shadow-sm ring-2 ring-brand-light'
                : 'bg-white border-slate-200 text-slate-800 hover:border-brand/50 hover:bg-brand-pale'}`}
          >
            {item.tile}
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
          <button
            onClick={() => { playTap(); speakOrPlay(selected.audioUrl, selected.ttsFallback) }}
            aria-label="پخش دوباره"
            className="w-14 h-14 rounded-xl bg-brand-pale border border-brand-light flex items-center justify-center text-2xl shrink-0"
          >
            {selected.detailImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.detailImage} alt="" className="w-10 h-10 object-contain" />
            ) : (
              <span aria-hidden="true">{selected.detailEmoji ?? '🔊'}</span>
            )}
          </button>
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900">{selected.detailTitle}</div>
            <div className="text-sm text-slate-500 truncate">{selected.detailSubtitle}</div>
          </div>
        </div>
      )}

      {selectedId && (
        <div className="mt-6 text-center text-sm text-slate-500 border-t border-dashed border-slate-200 pt-4">
          {nudgeText}{' '}
          <Link href="/signup" className="text-brand font-bold hover:underline">ثبت‌نام رایگان</Link>
        </div>
      )}
    </div>
  )
}
