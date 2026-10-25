import { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Constants from 'expo-constants'
import { toPersianDigits } from '@koodakbook/shared'
import {
  ParentButton, ParentCard, ParentChip, ParentField, ParentHeader, ParentNote, ParentPage, ParentSection, parentUI,
} from '@/components/ParentUI'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { fonts, radii, spacing, textSize, textStart, ui } from '@/lib/theme'

/* «پیشنهاد، مشکل یا سؤال» (web: /parent/feedback). Sends to the team with
 * the account email (backend routes/feedback.ts); our replies appear below
 * under «پیام‌های من», and opening this screen marks them read. The app
 * version and platform go along so a problem report is actionable — nothing
 * about the child is sent. Behind the parent PIN like every parent screen. */

type Kind = 'idea' | 'problem' | 'question' | 'other'
const KINDS: { value: Kind; label: string }[] = [
  { value: 'idea', label: 'پیشنهاد' },
  { value: 'problem', label: 'مشکل' },
  { value: 'question', label: 'سؤال' },
  { value: 'other', label: 'پیام دیگر' },
]
const KIND_LABEL: Record<Kind, string> = { idea: 'پیشنهاد', problem: 'مشکل', question: 'سؤال', other: 'پیام' }
const STATUS_LABEL: Record<string, string> = { new: 'رسید', in_progress: 'در حال بررسی', answered: 'جواب داده شد', closed: 'بسته شد' }

interface Mine {
  id: string
  kind: Kind
  message: string
  status: string
  reply: string | null
  replied_at: string | null
  reply_seen_at: string | null
  created_at: string
}

const date = (iso: string) => new Date(iso).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long' })

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets()
  const allowed = isParentUnlocked()
  const [kind, setKind] = useState<Kind>('idea')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [items, setItems] = useState<Mine[] | null>(null)

  useFocusEffect(useCallback(() => {
    if (!isParentUnlocked()) router.replace('/parent')
  }, []))

  const load = useCallback(() => {
    api.get<{ items: Mine[]; unread: number }>('/api/feedback/mine').then(res => {
      if (!res.data) return
      setItems(res.data.items)
      if (res.data.unread > 0) api.post('/api/feedback/mine/seen', {})
    })
  }, [])
  useEffect(() => { if (allowed) load() }, [allowed, load])

  async function send() {
    setError(null)
    if (message.trim().length < 5) { setError('لطفاً کمی بیشتر بنویسید'); return }
    setBusy(true)
    const res = await api.post('/api/feedback', {
      source: 'parent_mobile',
      kind,
      message: message.trim(),
      context: {
        screen: 'parent/feedback',
        platform: Platform.OS,
        os: String(Platform.Version),
        app_version: Constants.expoConfig?.version ?? '',
      },
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setMessage('')
    setSent(true)
    load()
  }

  if (!allowed) return <View style={styles.blank} />

  return (
    <ParentPage>
      <ParentHeader title="پیشنهاد، مشکل یا سؤال" subtitle="مستقیم برای تیم کودک‌بوک" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled">
          <ParentCard>
            <Text style={styles.cardTitle} accessibilityRole="header">درباره‌ی چیست؟</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {KINDS.map(k => (
                <ParentChip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
              ))}
            </View>
            <ParentField
              label="پیام شما"
              value={message}
              onChangeText={t => { setMessage(t); if (sent) setSent(false) }}
              multiline
              maxLength={2000}
              placeholder={kind === 'problem' ? 'چه شد؟ کجای اپ بودید؟' : 'هر چیزی که دوست دارید بگویید…'}
              inputStyle={styles.multiline}
              textAlignVertical="top"
              hint="با ایمیل حسابتان فرستاده می‌شود. جواب ما همین‌جا نشان داده می‌شود."
            />
            {error ? <ParentNote text={error} tone="error" /> : null}
            {sent ? <ParentNote text="پیامتان رسید — ممنونیم!" tone="success" /> : null}
            <ParentButton label="فرستادن" onPress={send} busy={busy} disabled={!message.trim()} />
          </ParentCard>

          <ParentSection label="پیام‌های من" />
          {items === null ? null : items.length === 0 ? (
            <Text style={styles.empty}>هنوز پیامی نفرستاده‌اید.</Text>
          ) : items.map(i => {
            const fresh = !!i.reply && !i.reply_seen_at
            return (
              <ParentCard key={i.id} style={fresh ? styles.fresh : undefined}>
                <View style={styles.metaRow}>
                  <Text style={styles.kind}>{KIND_LABEL[i.kind] ?? 'پیام'}</Text>
                  <Text style={styles.meta}>{date(i.created_at)}</Text>
                  <Text style={styles.status}>{STATUS_LABEL[i.status] ?? i.status}</Text>
                </View>
                <Text style={styles.body}>{i.message}</Text>
                {i.reply ? (
                  <View style={styles.reply}>
                    <Text style={styles.replyTitle}>
                      {`جواب تیم کودک‌بوک${i.replied_at ? `، ${date(i.replied_at)}` : ''}${fresh ? '، تازه' : ''}`}
                    </Text>
                    <Text style={styles.body}>{i.reply}</Text>
                  </View>
                ) : null}
              </ParentCard>
            )
          })}
          {items && items.length > 0 ? (
            <Text style={styles.count}>{`${toPersianDigits(String(items.length))} پیام`}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ParentPage>
  )
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: parentUI.page },
  content: { padding: spacing.md, gap: spacing.md },
  cardTitle: { fontFamily: fonts.bold, fontSize: textSize.small, color: parentUI.text, textAlign: textStart },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  multiline: { minHeight: 132, paddingTop: spacing.sm },
  empty: { fontFamily: fonts.regular, fontSize: textSize.caption, color: parentUI.muted, textAlign: textStart },
  fresh: { borderColor: '#F59E0B', borderWidth: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kind: { fontFamily: fonts.bold, fontSize: textSize.caption, color: parentUI.text },
  meta: { fontFamily: fonts.regular, fontSize: textSize.caption, color: parentUI.muted, flex: 1, textAlign: textStart },
  status: {
    fontFamily: fonts.bold, fontSize: textSize.micro, color: parentUI.accentText,
    backgroundColor: parentUI.accentSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  body: { fontFamily: fonts.regular, fontSize: textSize.small, color: parentUI.text, textAlign: textStart, lineHeight: 26 },
  reply: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: radii.sm, padding: spacing.sm, gap: 4 },
  replyTitle: { fontFamily: fonts.bold, fontSize: textSize.caption, color: '#065F46', textAlign: textStart },
  count: { fontFamily: fonts.regular, fontSize: textSize.micro, color: ui.textMuted, textAlign: 'center' },
})
