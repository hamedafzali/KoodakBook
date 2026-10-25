import { useEffect, useState } from 'react'
import { Linking, Platform, StyleSheet, Text } from 'react-native'
import Constants from 'expo-constants'
import { api } from '@/lib/api'
import { API_BASE } from '@/lib/config'
import { fonts, spacing, textSize, textStart } from '@/lib/theme'
import { ParentButton, ParentCard, parentUI } from '@/components/ParentUI'

/* "A newer version is out" — only for the Android build installed from
 * koodakbook.eu.cc/app (outside Google Play, so nothing else would tell the
 * family). Compares this build's app.json `version` with the newest published
 * release (GET /api/app/latest, backend routes/appReleases.ts), so each
 * release must bump app.json's "version" — the release's version_name in the
 * admin panel is the same string. Shown in the parent area only: a child can't
 * install anything, and this must never interrupt play. Silent on any error. */

interface Latest { version_name: string; notes: string | null }

/** -1 / 0 / 1 for dotted numeric versions ("0.10.0" > "0.9.2"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

export default function AppUpdateCard() {
  const [latest, setLatest] = useState<Latest | null>(null)
  const installed = Constants.expoConfig?.version ?? null

  useEffect(() => {
    if (Platform.OS !== 'android' || !installed) return
    let cancelled = false
    api.get<Latest | null>('/api/app/latest').then(res => {
      if (!cancelled && res.data && compareVersions(res.data.version_name, installed) > 0) setLatest(res.data)
    })
    return () => { cancelled = true }
  }, [installed])

  if (!latest) return null
  return (
    <ParentCard>
      <Text style={styles.title} accessibilityRole="header">نسخه‌ی تازه‌ی کودک‌بوک آماده است</Text>
      <Text style={styles.body}>
        {`نسخه‌ی ${latest.version_name} (نسخه‌ی شما: ${installed}).`}
        {latest.notes ? ` ${latest.notes}` : ''}
      </Text>
      <ParentButton
        label="دریافت نسخه‌ی تازه"
        accessibilityHint="صفحه‌ی دانلود در مرورگر باز می‌شود"
        onPress={() => { Linking.openURL(`${API_BASE}/app`) }}
      />
    </ParentCard>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: textSize.small, color: parentUI.text, textAlign: textStart },
  body: { fontFamily: fonts.regular, fontSize: textSize.caption, color: parentUI.muted, textAlign: textStart, marginBottom: spacing.xs },
})
