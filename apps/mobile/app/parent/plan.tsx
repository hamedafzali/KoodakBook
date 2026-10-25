import { useCallback, useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PLAN_FEATURES, toPersianDigits } from '@koodakbook/shared'
import ParentLoadState, { PARENT_FALLBACK_ERROR } from '@/components/ParentLoadState'
import { Icon } from '@/components/Icon'
import { ParentButton, ParentHeader, ParentPage, parentUI } from '@/components/ParentUI'
import { api } from '@/lib/api'
import { isParentUnlocked } from '@/lib/parentGate'
import { API_BASE } from '@/lib/config'
import { fonts, radii, spacing, textSize, textStart, ui } from '@/lib/theme'

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
  const [reloadKey, setReloadKey] = useState(0)
  const allowed = isParentUnlocked()

  // A deep link straight here must face the PIN like the hub does.
  useFocusEffect(useCallback(() => {
    if (!isParentUnlocked()) router.replace('/parent')
  }, []))

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    async function load() {
      const [plansRes, meRes] = await Promise.all([
        api.get<PlanRow[]>('/api/plans'),
        api.get<{ plan: string }>('/api/auth/me'),
      ])
      if (cancelled) return
      // Without /me the "current plan" badge would silently say free.
      if (!plansRes.data || !meRes.data) { setError(plansRes.error || meRes.error || PARENT_FALLBACK_ERROR); return }
      if (meRes.data.plan) setCurrent(meRes.data.plan)
      setPlans(plansRes.data)
    }
    load()
    return () => { cancelled = true }
  }, [allowed, reloadKey])

  if (!allowed) return <View style={styles.center} />
  if (!plans) {
    return (
      <ParentLoadState
        title="پلن‌ها و اشتراک" subtitle="امکانات هر پلن را مقایسه کنید" error={error}
        onRetry={() => { setError(null); setReloadKey((k) => k + 1) }}
      />
    )
  }

  return (
    <ParentPage>
      <ParentHeader title="پلن‌ها و اشتراک" subtitle="امکانات هر پلن را مقایسه کنید" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >

      {plans.map((plan) => {
        const isCurrent = plan.key === current
        const isPremium = plan.price_cents > 0
        return (
          <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCurrent]}>
            <View style={[styles.planHead, isPremium ? styles.planHeadPremium : styles.planHeadFree]}>
              <View style={styles.planTitleRow}>
                <Text style={styles.planName} accessibilityRole="header">{plan.name}</Text>
                {isCurrent && (
                  <View style={styles.currentPill}>
                    <Icon name="check" color={parentUI.accentText} size={12} strokeWidth={2.8} />
                    <Text style={styles.currentPillText}>پلن فعلی</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>{priceLabel(plan)}</Text>
              {plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
            </View>

            <View style={styles.featureList}>
              {PLAN_FEATURES.map((def) => {
                const value = plan.features[def.key] ?? def.default
                const spoken = def.type === 'number' ? toPersianDigits(value) : value === 'true' ? 'دارد' : 'ندارد'
                return (
                  <View key={def.key} style={styles.featureRow} accessible accessibilityLabel={`${def.label}: ${spoken}`}>
                    <Text style={styles.featureLabel}>{def.label}</Text>
                    {def.type === 'number' ? (
                      <Text style={styles.featureNumber}>{toPersianDigits(value)}</Text>
                    ) : value === 'true' ? (
                      <Icon name="check" color={ui.success} size={18} strokeWidth={2.6} />
                    ) : (
                      <Text style={styles.featureNo}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>

            {isCurrent || isPremium ? (
              <View style={styles.planFoot}>
                {isCurrent ? (
                  <View style={styles.planButtonDisabled}><Text style={styles.planButtonDisabledText}>پلن فعلی شما</Text></View>
                ) : (
                  <ParentButton
                    label="ارتقا در سایت ↗"
                    accessibilityLabel="ارتقا در سایت کودک‌بوک"
                    accessibilityHint="در مرورگر باز می‌شود"
                    onPress={openWebCheckout}
                  />
                )}
              </View>
            ) : null}
          </View>
        )
      })}

      <Text style={styles.footNote}>
        پرداخت از داخل اپ انجام نمی‌شود — دکمه بالا سایت کودک‌بوک را در مرورگر باز می‌کند تا ارتقا را آنجا کامل کنید.
      </Text>
      </ScrollView>
    </ParentPage>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: parentUI.page },
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.md - 2 },
  planCard: {
    backgroundColor: parentUI.surface, borderRadius: parentUI.radius, overflow: 'hidden',
    borderWidth: 2, borderColor: parentUI.line,
  },
  planCurrent: { borderColor: parentUI.accent },
  planHead: { padding: spacing.md, gap: spacing.xs },
  planHeadFree: { backgroundColor: parentUI.field },
  planHeadPremium: { backgroundColor: parentUI.accentSoft },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  planName: { flexShrink: 1, fontSize: textSize.body, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  currentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: parentUI.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 3,
  },
  currentPillText: { fontSize: textSize.micro, fontFamily: fonts.bold, color: parentUI.accentText },
  planPrice: { fontSize: textSize.h2, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  planDesc: { fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.muted, textAlign: textStart },
  featureList: { paddingHorizontal: spacing.md },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    minHeight: 44, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: parentUI.line,
  },
  featureLabel: { flex: 1, fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.text, textAlign: textStart },
  featureNumber: { fontSize: textSize.caption + 1, fontFamily: fonts.bold, color: parentUI.text },
  featureNo: { fontSize: textSize.body, color: ui.faint },
  planFoot: { padding: spacing.md - 2 },
  planButtonDisabled: {
    backgroundColor: parentUI.field, borderRadius: parentUI.controlRadius, minHeight: 48,
    alignItems: 'center', justifyContent: 'center',
  },
  planButtonDisabledText: { fontSize: textSize.caption + 1, fontFamily: fonts.bold, color: parentUI.muted },
  footNote: {
    fontSize: textSize.caption - 1, fontFamily: fonts.regular, color: parentUI.muted,
    textAlign: 'center', paddingHorizontal: spacing.sm + 2, lineHeight: 20,
  },
})
