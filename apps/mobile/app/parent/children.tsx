import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import {
  ParentButton, ParentCard, ParentChip, ParentField, ParentHeader, ParentNote, ParentPage, parentUI,
} from '@/components/ParentUI'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, spacing, textSize, textStart } from '@/lib/theme'

/** Manage children (web: parts of /parent/settings) — add, level, kid username. */
export default function ManageChildren() {
  const insets = useSafeAreaInsets()
  // Checked during render too: a deep link here while locked shows a blank
  // parent page for the one frame before the focus effect sends it to the PIN.
  const allowed = isParentUnlocked()
  const [children, setChildren] = useState<Child[] | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  // A failed load used to leave the spinner up forever.
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      let cancelled = false
      api.get<Child[]>('/api/children').then((res) => {
        if (cancelled) return
        if (res.data) setChildren(res.data)
        else setError(res.error || PARENT_FALLBACK_ERROR)
      })
      return () => { cancelled = true }
    }, [reloadKey])
  )

  if (!allowed) return <View style={styles.blank} />
  if (!children) {
    return (
      <ParentLoadState
        title="کودکان" subtitle="پروفایل‌ها و نام کاربری ورود بچه‌ها" error={error}
        onRetry={() => { setError(null); setReloadKey((k) => k + 1) }}
      />
    )
  }

  return (
    <ParentPage>
      <ParentHeader title="کودکان" subtitle="پروفایل‌ها و نام کاربری ورود بچه‌ها" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >

      {children.map((c) => (
        <ChildCard key={c.id} child={c} onChanged={(updated) =>
          setChildren((cur) => cur?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
        } />
      ))}

      {showAdd ? (
        <AddChildCard onAdded={(child) => { setChildren((cur) => [...(cur ?? []), child]); setShowAdd(false) }} />
      ) : (
        <ParentButton label="+ افزودن کودک" accessibilityLabel="افزودن کودک" tone="secondary" onPress={() => setShowAdd(true)} />
      )}
      </ScrollView>
    </ParentPage>
  )
}

function ChildCard({ child, onChanged }: { child: Child; onChanged: (c: Child) => void }) {
  const [username, setUsername] = useState(child.username ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function saveUsername() {
    const v = username.trim().toLowerCase()
    setBusy(true)
    const res = await api.patch<Child>(`/api/children/${child.id}`, { username: v || null })
    setBusy(false)
    if (res.data) { onChanged(res.data); setMsg({ ok: true, text: 'ذخیره شد' }) }
    else setMsg({ ok: false, text: res.error ?? 'ذخیره نشد' })
  }

  return (
    <ParentCard>
      <View style={styles.cardHeader}>
        <Text style={styles.childName} accessibilityRole="header">{child.name}</Text>
        <Text style={styles.childMeta}>
          سطح {toPersianDigits(child.level)}
          {child.birth_year ? ` · متولد ${toPersianDigits(child.birth_year)}` : ''}
        </Text>
      </View>
      <View style={styles.inlineRow}>
        <ParentField
          label="نام کاربری ورود بچه‌ها (حروف انگلیسی)"
          style={{ flex: 1 }}
          value={username}
          onChangeText={(t) => { setUsername(t); setMsg(null) }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="mina2020"
          returnKeyType="done"
          onSubmitEditing={saveUsername}
        />
        <ParentButton
          label="ذخیره" compact busy={busy} onPress={saveUsername}
          accessibilityLabel={`ذخیره نام کاربری ${child.name}`} style={styles.saveButton}
        />
      </View>
      {msg && <ParentNote text={msg.text} tone={msg.ok ? 'success' : 'error'} />}
    </ParentCard>
  )
}

function AddChildCard({ onAdded }: { onAdded: (c: Child) => void }) {
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) { setError('اسم کودک را بنویسید'); return }
    setBusy(true)
    const res = await api.post<Child>('/api/children', {
      name: name.trim(),
      birth_year: birthYear ? parseInt(birthYear, 10) : null,
      level,
      avatar_url: null,
    })
    setBusy(false)
    if (res.data) onAdded(res.data)
    else setError(res.error ?? 'افزودن ناموفق بود')
  }

  return (
    <ParentCard>
      <Text style={styles.childName} accessibilityRole="header">کودک جدید</Text>
      <ParentField
        label="اسم کودک"
        value={name}
        onChangeText={(t) => { setName(t); setError(null) }}
        placeholder="مثلاً لیلا"
      />
      <ParentField
        label="سال تولد (میلادی، اختیاری)"
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="2019"
      />
      <Text style={styles.fieldLabel}>سطح فارسی</Text>
      <View style={styles.levels} accessibilityRole="radiogroup">
        {([1, 2, 3, 4] as const).map((l) => (
          <ParentChip
            key={l}
            label={toPersianDigits(l)}
            accessibilityLabel={`سطح ${toPersianDigits(l)}`}
            selected={level === l}
            onPress={() => setLevel(l)}
          />
        ))}
      </View>
      {error && <ParentNote text={error} tone="error" />}
      <ParentButton label="افزودن" busy={busy} onPress={add} />
    </ParentCard>
  )
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: parentUI.page },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.md - 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  childName: { fontSize: textSize.body, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  childMeta: { fontSize: textSize.caption - 1, fontFamily: fonts.regular, color: parentUI.muted },
  fieldLabel: { fontSize: textSize.caption, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  // The button sits on the input's baseline (the field has a label above it).
  inlineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  saveButton: { minHeight: 48 },
  levels: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
})
