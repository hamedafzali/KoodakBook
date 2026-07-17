import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Child } from '@koodakbook/shared'
import { toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { colors, fonts } from '@/lib/theme'

/** Manage children (web: parts of /parent/settings) — add, level, kid username. */
export default function ManageChildren() {
  const insets = useSafeAreaInsets()
  const [children, setChildren] = useState<Child[] | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!isParentUnlocked()) { router.replace('/parent'); return }
      let cancelled = false
      api.get<Child[]>('/api/children').then((res) => {
        if (!cancelled && res.data) setChildren(res.data)
      })
      return () => { cancelled = true }
    }, [])
  )

  if (!children) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>→</Text>
        </Pressable>
        <Text style={styles.title}>کودکان 🧒</Text>
      </View>

      {children.map((c) => (
        <ChildCard key={c.id} child={c} onChanged={(updated) =>
          setChildren((cur) => cur?.map((x) => (x.id === updated.id ? updated : x)) ?? null)
        } />
      ))}

      {showAdd ? (
        <AddChildCard onAdded={(child) => { setChildren((cur) => [...(cur ?? []), child]); setShowAdd(false) }} />
      ) : (
        <Pressable style={styles.addButton} onPress={() => setShowAdd(true)}>
          <Text style={styles.addButtonText}>+ افزودن کودک</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

function ChildCard({ child, onChanged }: { child: Child; onChanged: (c: Child) => void }) {
  const [username, setUsername] = useState(child.username ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function saveUsername() {
    const v = username.trim().toLowerCase()
    const res = await api.patch<Child>(`/api/children/${child.id}`, { username: v || null })
    if (res.data) { onChanged(res.data); setMsg({ ok: true, text: 'ذخیره شد ✓' }) }
    else setMsg({ ok: false, text: res.error ?? 'ذخیره نشد' })
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.childName}>{child.name}</Text>
        <Text style={styles.childMeta}>
          سطح {toPersianDigits(child.level)}
          {child.birth_year ? ` · متولد ${toPersianDigits(child.birth_year)}` : ''}
        </Text>
      </View>
      <Text style={styles.fieldLabel}>نام کاربری ورود بچه‌ها (حروف انگلیسی)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="mina2020"
          placeholderTextColor={colors.muted}
        />
        <Pressable style={styles.saveButton} onPress={saveUsername}>
          <Text style={styles.saveText}>ذخیره</Text>
        </Pressable>
      </View>
      {msg && <Text style={[styles.msg, { color: msg.ok ? colors.success : colors.danger }]}>{msg.text}</Text>}
    </View>
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
    <View style={styles.card}>
      <Text style={styles.childName}>کودک جدید</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="اسم کودک"
        placeholderTextColor={colors.muted}
      />
      <TextInput
        style={styles.input}
        value={birthYear}
        onChangeText={setBirthYear}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="سال تولد (میلادی، اختیاری)"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.fieldLabel}>سطح فارسی</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([1, 2, 3, 4] as const).map((l) => (
          <Pressable
            key={l}
            style={[styles.levelChip, level === l && styles.levelChipActive]}
            onPress={() => setLevel(l)}
          >
            <Text style={[styles.levelText, level === l && { color: '#fff' }]}>{toPersianDigits(l)}</Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={[styles.msg, { color: colors.danger }]}>{error}</Text>}
      <Pressable style={[styles.saveButton, { alignSelf: 'stretch', alignItems: 'center' }, busy && { opacity: 0.6 }]} disabled={busy} onPress={add}>
        <Text style={styles.saveText}>{busy ? '…' : 'افزودن'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  childName: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  childMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  fieldLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted },
  input: {
    backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text, textAlign: 'right',
  },
  saveButton: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 18, justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 14, fontFamily: fonts.bold },
  msg: { fontSize: 12, fontFamily: fonts.regular },
  levelChip: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  levelChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelText: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  addButton: {
    backgroundColor: colors.primarySoft, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  addButtonText: { fontSize: 15, fontFamily: fonts.bold, color: colors.primary },
})
