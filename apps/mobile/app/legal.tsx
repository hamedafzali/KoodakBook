import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LEGAL_PRIVACY, LEGAL_TERMS } from '@koodakbook/shared'
import { Icon, type IconName } from '@/components/Icon'
import { ParentCard, ParentHeader, ParentPage, parentUI } from '@/components/ParentUI'
import { fonts, radii, spacing, textSize, textStart } from '@/lib/theme'

/**
 * Privacy + terms (web: /privacy, /terms). Content shared from
 * @koodakbook/shared. An adult document, so it is in the parent register
 * (components/ParentUI.tsx) -- but without the «والدین» lock badge: it also
 * opens from signup, before any account or PIN exists. Back lands on the auth
 * gate ('/') when there is no history, which routes a signed-in family Home
 * and anyone else to login.
 */
export default function Legal() {
  const insets = useSafeAreaInsets()
  return (
    <ParentPage>
      <ParentHeader title="قوانین و حریم خصوصی" secure={false} fallback="/" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
      >

      <Text style={styles.intro}>
        کودک‌بوک برای کودکان ساخته شده و ما این را یک مسئولیت می‌دانیم، نه یک بند حقوقی.
      </Text>

      <SectionTitle icon="lock" label="حریم خصوصی" />
      {LEGAL_PRIVACY.map((s) => (
        <ParentCard key={s.h} style={styles.block}>
          <Text style={styles.blockHead} accessibilityRole="header">{s.h}</Text>
          {s.body.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </ParentCard>
      ))}

      <SectionTitle icon="book" label="شرایط استفاده" />
      {LEGAL_TERMS.map((s) => (
        <ParentCard key={s.h} style={styles.block}>
          <Text style={styles.blockHead} accessibilityRole="header">{s.h}</Text>
          <Text style={styles.bodyText}>{s.t}</Text>
        </ParentCard>
      ))}

      <Text style={styles.version}>KoodakBook v0.1.0</Text>
      </ScrollView>
    </ParentPage>
  )
}

function SectionTitle({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionIcon}><Icon name={icon} color={parentUI.accentText} size={18} /></View>
      <Text style={styles.sectionTitle} accessibilityRole="header">{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md + 4, gap: spacing.sm + 4 },
  intro: { fontSize: textSize.caption + 1, fontFamily: fonts.regular, color: parentUI.muted, lineHeight: 24, textAlign: textStart },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm + 4 },
  sectionIcon: {
    width: 32, height: 32, borderRadius: radii.pill, backgroundColor: parentUI.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: textSize.body, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  block: { gap: spacing.xs + 2 },
  blockHead: { fontSize: textSize.small, fontFamily: fonts.bold, color: parentUI.text, textAlign: textStart },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: parentUI.accent, marginTop: 9 },
  bulletText: { flex: 1, fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.text, lineHeight: 22, textAlign: textStart },
  bodyText: { fontSize: textSize.caption, fontFamily: fonts.regular, color: parentUI.text, lineHeight: 22, textAlign: textStart },
  version: { textAlign: 'center', fontSize: textSize.micro + 1, fontFamily: fonts.regular, color: parentUI.muted, marginTop: spacing.sm },
})
