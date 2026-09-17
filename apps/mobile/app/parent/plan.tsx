import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PLAN_FEATURES, toPersianDigits } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { API_BASE } from '@/lib/config'
import { colors, fonts } from '@/lib/theme'

/* Checkout is web-only (product decision, 2026-09-17): mobile has no Stripe/
 * Play Billing integration and isn't getting one — "we will open website for
 * it." API_BASE and the web app are the same origin (see lib/config.ts's own
 * comment), so this is just a same-domain deep link, not a second configured
 * URL to keep in sync. Opens the system browser (Linking.openURL), not an
 * in-app webview, so the parent lands in a real, already-familiar browser
 * tab for anything payment-related — never inside the app's own chrome. */
function openWebCheckout() {
  Linking.openURL(`${API_BASE}/parent/plan`)
}

interface PlanRow {
  id: string
  key: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  interval: string
  features: Record<string, string>
}

const INTERVAL_LABEL: Record<string, string> = { month: 'ماه', year: 'سال', none: '' }

function priceLabel(p: PlanRow): string {
  if (p.price_cents === 0) return 'رایگان'
  const amount = (p.price_cents / 100).toLocaleString('fa-IR')
  const per = INTERVAL_LABEL[p.interval] ? ` / ${INTERVAL_LABEL[p.interval]}` : ''
  return `${amount} ${p.currency}${per}`
}

/** Plan comparison (web: /parent/plan). Upgrade opens the web app's own
 *  checkout in the system browser — see openWebCheckout() above. */
export default function PlanPage() {
  const insets = useSafeAreaInsets()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [current, setCurrent] = useState('free')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [plansRes, meRes] = await Promise.all([
        api.get<PlanRow[]>('/api/plans'),
        api.get<{ plan: string }>('/api/auth/me'),
      ])
      if (plansRes.data) setPlans(plansRes.data)
      else setError(plansRes.error)
      if (meRes.data?.plan) setCurrent(meRes.data.plan)
    }
    load()
  }, [])

  if (!plans) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.onPrimary} />}
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
        <View>
          <Text style={styles.title}>پلن‌ها و اشتراک</Text>
          <Text style={styles.subtitle}>امکانات هر پلن را مقایسه کنید</Text>
        </View>
      </View>

      {plans.map((plan) => {
        const isCurrent = plan.key === current
        const isPremium = plan.price_cents > 0
        return (
          <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCurrent]}>
            <View style={[styles.planHead, isPremium ? styles.planHeadPremium : styles.planHeadFree]}>
              <View style={styles.planTitleRow}>
                <Text style={[styles.planName, isPremium && { color: colors.onPrimary }]}>{plan.name}</Text>
                {isCurrent && (
                  <View style={styles.currentPill}><Text style={styles.currentPillText}>پلن فعلی</Text></View>
                )}
              </View>
              <Text style={[styles.planPrice, isPremium && { color: colors.onPrimary }]}>{priceLabel(plan)}</Text>
              {plan.description && (
                <Text style={[styles.planDesc, isPremium && { color: colors.onPrimary }]}>{plan.description}</Text>
              )}
            </View>

            <View style={styles.featureList}>
              {PLAN_FEATURES.map((def) => {
                const value = plan.features[def.key] ?? def.default
                return (
                  <View key={def.key} style={styles.featureRow}>
                    <Text style={styles.featureLabel}>{def.label}</Text>
                    {def.type === 'number' ? (
                      <Text style={styles.featureNumber}>{toPersianDigits(value)}</Text>
                    ) : value === 'true' ? (
                      <Text style={styles.featureYes}>✓</Text>
                    ) : (
                      <Text style={styles.featureNo}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>

            <View style={{ padding: 14 }}>
              {isCurrent ? (
                <View style={styles.planButtonDisabled}><Text style={styles.planButtonDisabledText}>پلن فعلی شما</Text></View>
              ) : isPremium ? (
                <Pressable onPress={openWebCheckout} style={styles.planButtonUpgrade}>
                  <Text style={styles.planButtonUpgradeText}>ارتقا در سایت 🌐</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )
      })}

      <Text style={styles.footNote}>
        پرداخت از داخل اپ انجام نمی‌شود — دکمه بالا سایت کودک‌بوک را در مرورگر باز می‌کند تا ارتقا را آنجا کامل کنید.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 24, color: colors.muted },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted, marginTop: 2 },
  planCard: { backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  planCurrent: { borderColor: '#fbbf24' },
  planHead: { padding: 16, gap: 4 },
  planHeadFree: { backgroundColor: '#f1f5f9' },
  planHeadPremium: { backgroundColor: colors.primary },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  currentPill: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  currentPillText: { fontSize: 11, fontFamily: fonts.bold, color: '#b45309' },
  planPrice: { fontSize: 24, fontFamily: fonts.bold, color: colors.text },
  planDesc: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
  featureList: { paddingHorizontal: 16 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  featureLabel: { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.text },
  featureNumber: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  featureYes: { fontSize: 16, fontFamily: fonts.bold, color: colors.success },
  featureNo: { fontSize: 16, color: '#cbd5e1' },
  planButtonDisabled: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  planButtonDisabledText: { fontSize: 14, fontFamily: fonts.bold, color: colors.muted },
  planButtonUpgrade: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  planButtonUpgradeText: { fontSize: 14, fontFamily: fonts.bold, color: colors.onPrimary },
  footNote: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', paddingHorizontal: 10 },
  error: { color: colors.danger, fontFamily: fonts.regular },
})
