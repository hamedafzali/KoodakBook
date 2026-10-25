import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { Ionicons } from '@expo/vector-icons'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import {
  ParentButton, ParentCard, ParentChip, ParentDivider, ParentField, ParentHeader, ParentNote, ParentPage, ParentSection, parentUI,
} from '@/components/ParentUI'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, spacing, textSize, textStart } from '@/lib/theme'

interface FriendReq { id: string; requester_name: string; addressee_child_id: string; addressee_name: string }
interface Friend { id: string; name: string; avatar_url: string | null }

/**
 * Friends (parent mode) — connect children only via a shared code with parent
 * approval. No search, no strangers, no chat. Each child has a code to share;
 * entering a friend's code sends a request the other parent approves.
 */
export default function Friends() {
  const insets = useSafeAreaInsets()
  // Checked during render too (see parent/children.tsx).
  const allowed = isParentUnlocked()
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // The focus load reads the current pick from a ref: depending on
  // `selected` (which the load itself sets) ran the whole load twice on the
  // first visit and again on every chip tap.
  const selectedRef = useRef<string | null>(null)
  const select = (id: string | null) => { selectedRef.current = id; setSelected(id) }
  const [code, setCode] = useState<string | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendReq[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  // A failed load used to show as "no children / no requests".
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loadForChild = useCallback(async (childId: string) => {
    setCode(null)
    const [codeRes, friendsRes] = await Promise.all([
      api.get<{ code: string }>(`/api/friends/code/${childId}`),
      api.get<Friend[]>(`/api/friends/of/${childId}`),
    ])
    if (codeRes.data) setCode(codeRes.data.code)
    setFriends(friendsRes.data ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      let cancelled = false
      async function load() {
        const [childRes, reqRes] = await Promise.all([
          api.get<Child[]>('/api/children'),
          api.get<FriendReq[]>('/api/friends/requests'),
        ])
        if (cancelled) return
        if (!childRes.data || !reqRes.data) {
          setLoadError(childRes.error || reqRes.error || PARENT_FALLBACK_ERROR)
          return
        }
        const list = childRes.data
        setChildren(list)
        setRequests(reqRes.data ?? [])
        // Keep the pick if that child still exists, else the first child.
        const cur = selectedRef.current
        const active = (cur && list.some((c) => c.id === cur) ? cur : list[0]?.id) ?? null
        select(active)
        if (active) await loadForChild(active)
        setLoading(false)
      }
      load()
      return () => { cancelled = true }
    }, [loadForChild, reloadKey])
  )

  async function shareCode() {
    if (!code) return
    const child = children.find((c) => c.id === selected)
    try {
      await Share.share({ message: `کد دوستی ${child?.name ?? 'کودک'} در کودک‌بوک: ${code}\nاین کد را در بخش «دوستان» وارد کن تا با هم بازی کنیم!` })
    } catch { /* cancelled */ }
  }

  async function sendRequest() {
    if (!selected) return
    const c = input.trim().toUpperCase()
    if (!c) return
    setMsg(null)
    const res = await api.post<{ friend_name: string; accepted: boolean }>('/api/friends/request', { child_id: selected, code: c })
    if (res.data) {
      setInput('')
      setMsg({ ok: true, text: res.data.accepted ? `${res.data.friend_name} حالا دوست است!` : `درخواست برای ${res.data.friend_name} فرستاده شد` })
      if (res.data.accepted) await loadForChild(selected)
    } else {
      setMsg({ ok: false, text: res.error ?? 'خطا' })
    }
  }

  async function respond(id: string, accept: boolean) {
    await api.post(`/api/friends/requests/${id}/${accept ? 'accept' : 'decline'}`, {})
    setRequests((r) => r.filter((x) => x.id !== id))
    if (accept && selected) await loadForChild(selected)
  }

  async function pickChild(id: string) {
    select(id)
    setMsg(null)
    await loadForChild(id)
  }

  if (!allowed) return <View style={styles.blank} />
  if (loading || loadError) {
    return (
      <ParentLoadState
        title="دوستان" subtitle={SUBTITLE} error={loadError}
        onRetry={() => { setLoadError(null); setReloadKey((k) => k + 1) }}
      />
    )
  }

  const activeChild = children.find((c) => c.id === selected)

  return (
    <ParentPage>
      <ParentHeader title="دوستان" subtitle={SUBTITLE} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {children.map((c) => (
            <ParentChip key={c.id} role="button" label={c.name} selected={selected === c.id} onPress={() => { void pickChild(c.id) }} />
          ))}
        </ScrollView>
      )}

      {/* This child's code */}
      <ParentCard>
        <Text style={styles.cardLabel} accessibilityRole="header">کد دوستی {activeChild?.name}</Text>
        {code ? (
          <Text style={styles.code} accessibilityLabel={`کد: ${code.split('').join(' ')}`} selectable>{code}</Text>
        ) : (
          <ActivityIndicator color={parentUI.accentText} style={styles.codeLoading} accessibilityLabel="در حال بارگذاری کد" />
        )}
        <ParentButton label="اشتراک‌گذاری کد" tone="secondary" disabled={!code} onPress={shareCode} />
        <Text style={styles.hint}>این کد را به خانواده‌ی دوستِ کودک بدهید</Text>
      </ParentCard>

      {/* Add a friend by code */}
      <ParentCard>
        <Text style={styles.cardLabel} accessibilityRole="header">افزودن دوست با کد</Text>
        <View style={styles.inlineRow}>
          <ParentField
            label="کد دوست"
            style={{ flex: 1 }}
            inputStyle={styles.codeInput}
            value={input}
            onChangeText={(t) => { setInput(t); setMsg(null) }}
            placeholder="KB-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={() => { void sendRequest() }}
          />
          <ParentButton label="ارسال" compact disabled={!input.trim()} onPress={() => { void sendRequest() }} style={styles.inlineButton} />
        </View>
        {msg && <ParentNote text={msg.text} tone={msg.ok ? 'success' : 'error'} />}
      </ParentCard>

      {/* Incoming requests */}
      {requests.length > 0 && (
        <>
          <ParentSection label="درخواست‌های دوستی" />
          <ParentCard>
            {requests.map((r, i) => (
              <View key={r.id} style={styles.reqRow}>
                {i > 0 ? <ParentDivider /> : null}
                <Text style={styles.reqText}>«{r.requester_name}» می‌خواهد دوستِ {r.addressee_name} شود</Text>
                <View style={styles.reqButtons}>
                  <ParentButton
                    label="تأیید" compact style={{ flex: 1 }}
                    accessibilityLabel={`تأیید دوستی ${r.requester_name}`}
                    onPress={() => { void respond(r.id, true) }}
                  />
                  <ParentButton
                    label="رد" tone="secondary" compact style={{ flex: 1 }}
                    accessibilityLabel={`رد درخواست ${r.requester_name}`}
                    onPress={() => { void respond(r.id, false) }}
                  />
                </View>
              </View>
            ))}
          </ParentCard>
        </>
      )}

      {/* Friends list */}
      <ParentSection label={`دوستانِ ${activeChild?.name ?? ''}`} />
      <ParentCard>
        {friends.length === 0 ? (
          <Text style={styles.empty}>هنوز دوستی اضافه نشده — کد را به هم بدهید تا با هم بازی کنند</Text>
        ) : (
          friends.map((f) => (
            <View key={f.id} style={styles.friendRow}>
              <Ionicons name="person-circle" size={26} color={parentUI.accentText} />
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.soon}>بازی آنلاین به‌زودی</Text>
            </View>
          ))
        )}
      </ParentCard>
      </ScrollView>
    </ParentPage>
  )
}

const SUBTITLE = 'فقط با کد و تأیید شما — بدون غریبه'

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: parentUI.page },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.md - 2 },
  chips: { gap: spacing.sm },
  cardLabel: { fontSize: textSize.caption + 1, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  // A code is Latin: shown LTR, spaced, and read out letter by letter.
  code: {
    fontSize: 30, fontFamily: fonts.bold, color: parentUI.accentText, letterSpacing: 3,
    textAlign: 'center', writingDirection: 'ltr',
  },
  codeLoading: { minHeight: 47 },
  hint: { fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, textAlign: 'center' },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  inlineButton: { minHeight: 48 },
  codeInput: { fontFamily: fonts.bold, textAlign: 'center', letterSpacing: 2, writingDirection: 'ltr' },
  reqRow: { gap: spacing.sm },
  reqButtons: { flexDirection: 'row', gap: spacing.sm },
  reqText: { fontSize: textSize.caption + 1, fontFamily: fonts.regular, color: parentUI.text, textAlign: textStart },
  empty: { fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.muted, textAlign: 'center', lineHeight: 22 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, minHeight: 44 },
  friendName: { flex: 1, fontSize: textSize.small, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  soon: { fontSize: textSize.micro, fontFamily: fonts.regular, color: parentUI.muted },
})
