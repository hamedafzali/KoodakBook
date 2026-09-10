'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import BottomNav from '@/components/child/BottomNav'
import PageHeader from '@/components/child/PageHeader'
import { RoomSections } from '@/components/child/rooms'
import type { AppCharacter } from '@koodakbook/shared'

/* «همه‌ی بخش‌ها» — kept as a route, no longer a gate.
 *
 * Everything on this page is now also on home, rendered from the same
 * components/child/rooms.tsx, because a room a pre-reader has to go looking for
 * is a room they don't have. This URL survives for the deep link and for older
 * children who navigated here by habit; it is not the only way in any more, and
 * nothing may ever live here that isn't also on home. */

export default function ChildRoomsPage() {
  const [friends, setFriends] = useState<AppCharacter[]>([])

  useEffect(() => {
    api.get<AppCharacter[]>('/api/characters').then(r => { if (r.data) setFriends(r.data) })
  }, [])

  return (
    <div className="min-h-screen child-bg pb-nav">
      <PageHeader title="همه‌ی بخش‌ها" subtitle="هر جا دوست داری برو" backHref="/child/home" />

      <div className="px-4 pt-5 space-y-7 max-w-2xl mx-auto">
        <RoomSections friends={friends} />
      </div>

      <BottomNav />
    </div>
  )
}
