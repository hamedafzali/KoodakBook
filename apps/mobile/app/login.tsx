import { useState } from 'react'
import { toPersianDigits } from '@koodakbook/shared'
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { AppCharacter } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { authErrorMessage, setToken } from '@/lib/auth'
import { setActiveChildId } from '@/lib/activeChild'
import { getDeviceToken, setDeviceToken } from '@/lib/deviceToken'
import ScreenBackground from '@/components/ScreenBackground'
import { AuthField, AuthHero, AuthNote, AuthSheet, AuthTitle } from '@/components/AuthScene'
import { ClayButton, ClayCard, TextButton } from '@/components/Clay'
import FriendAvatar from '@/components/FriendAvatar'
import { Icon, type IconName } from '@/components/Icon'
import LoadState from '@/components/LoadState'
import { ParentLock } from '@/components/Illustrations'
import { auth, clay, colors, fonts, radii, ramps, spacing, textSize, ui } from '@/lib/theme'

type Mode = 'parent' | 'kid'

/* Kid login (mig 059), mirrors web's app/(auth)/kid/page.tsx: type your name,
 * then — if a parent set one up — tap your 3-character picture password
 * instead of typing anything else. On an already-bound device that's the
 * whole flow; on a new device, a one-time parent PIN check binds it so
 * future logins here skip straight to the picture step. No picture password
 * set → the original one-tap flow. */
type KidStep = 'name' | 'picture' | 'parent_pin'

export default function Login() {
  const { expired } = useLocalSearchParams<{ expired?: string }>()
  const [mode, setMode] = useState<Mode>('parent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [kidStep, setKidStep] = useState<KidStep>('name')
  const [child, setChild] = useState<{ id: string; name: string } | null>(null)
  const [characters, setCharacters] = useState<AppCharacter[] | null>(null)
  // The picture grid's own load: a failed /api/characters used to leave an
  // empty grid the child could never get past.
  const [charsError, setCharsError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [pin, setPin] = useState('')

  async function loginParent() {
    setBusy(true); setError(null)
    const res = await api.post<{ token: string; user_id: string }>('/api/auth/login', { email: email.trim(), password })
    setBusy(false)
    // No token is sent on login, so a 401 can only mean the credentials.
    if (!res.data) { setError(authErrorMessage(res, 'ورود ناموفق بود. دوباره تلاش کنید', { 401: 'ایمیل یا رمز عبور اشتباه است' })); return }
    await setToken(res.data.token)
    router.replace('/children')
  }

  async function finishKidLogin(token: string, childId: string, deviceToken?: string) {
    await setToken(token)
    await setActiveChildId(childId)
    if (deviceToken) await setDeviceToken(childId, deviceToken)
    router.replace('/home')
  }

  function resetKidFlow() {
    setKidStep('name'); setChild(null); setPicked([]); setPin(''); setError(null)
    setCharacters(null); setCharsError(null)
  }

  async function loadCharacters() {
    setCharsError(null)
    const chars = await api.get<AppCharacter[]>('/api/characters')
    if (chars.data?.length) setCharacters(chars.data)
    else setCharsError(chars.error || 'اتصال برقرار نشد. دوباره تلاش کن')
  }

  async function submitUsername() {
    setBusy(true); setError(null)
    const res = await api.post<{ token?: string; child_id: string; child_name: string; needs_picture_password?: boolean }>(
      '/api/auth/child-login', { username: username.trim().toLowerCase() })
    setBusy(false)
    if (!res.data) { setError(authErrorMessage(res, 'ورود ناموفق بود. دوباره امتحان کن')); return }

    if (res.data.needs_picture_password) {
      setChild({ id: res.data.child_id, name: res.data.child_name })
      setKidStep('picture')
      await loadCharacters()
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id)
  }

  async function tapCharacter(slug: string) {
    if (!child || busy) return
    const next = [...picked, slug]
    setPicked(next)
    if (next.length < 3) return

    setBusy(true); setError(null)
    const deviceToken = await getDeviceToken(child.id)
    const res = await api.post<{ ok: boolean; locked?: boolean; needs_parent_pin?: boolean; token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/verify-picture',
      { child_id: child.id, slugs: next, device_token: deviceToken ?? undefined }
    )
    setBusy(false)
    if (!res.data) { setError(authErrorMessage(res, 'یک مشکلی پیش آمد — دوباره امتحان کن')); setPicked([]); return }

    if (!res.data.ok) {
      setPicked([])
      setError(res.data.locked
        ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن'
        : 'ترتیب درست نبود. دوباره امتحان کن')
      return
    }
    if (res.data.needs_parent_pin) {
      setPicked([])
      setKidStep('parent_pin')
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id)
  }

  async function submitParentPin() {
    if (!child) return
    setBusy(true); setError(null)
    const res = await api.post<{ ok: boolean; locked?: boolean; token?: string; device_token?: string; child_id: string; child_name: string }>(
      '/api/auth/child-login/bind-device', { child_id: child.id, pin }
    )
    setBusy(false)
    if (!res.data) { setError(authErrorMessage(res, 'یک مشکلی پیش آمد — دوباره امتحان کن')); return }
    if (!res.data.ok) {
      setPin('')
      setError(res.data.locked ? 'تلاش‌های زیاد. چند دقیقه دیگر دوباره امتحان کن' : 'پین اشتباه است')
      return
    }
    await finishKidLogin(res.data.token!, res.data.child_id, res.data.device_token)
  }

  const title = mode === 'parent'
    ? 'ورود به کودک‌بوک'
    : kidStep === 'picture' ? `سلام ${child?.name ?? ''}!`
    : kidStep === 'parent_pin' ? 'یک بار با کمک بزرگ‌ترها'
    : 'سلام! بیا وارد شویم'
  const lead = mode === 'parent'
    ? 'حساب والدین: با ایمیل و رمز عبور'
    : kidStep === 'picture' ? '۳ دوستت را به ترتیب لمس کن'
    : kidStep === 'parent_pin' ? undefined
    : 'اسمی که مامان یا بابا برایت ساخته را بنویس'

  return (
    <ScreenBackground variant="warm">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <AuthHero character="simorgh" emotion={mode === 'kid' ? 'encouraging' : 'happy'} motif="sun" />
      <AuthSheet>
      <AuthTitle title={title} lead={lead} />
      {expired === '1' && <AuthNote text="نشست شما تمام شد — دوباره وارد شوید" tone="info" />}

      {/* Who is signing in. A tab bar, not two buttons: the choice swaps the
          form below. */}
      <View style={styles.tabs} accessibilityRole="tablist">
        <ModeTab label="والدین" icon="users" active={mode === 'parent'} onPress={() => { setMode('parent'); setError(null) }} />
        <ModeTab label="بچه‌ها" icon="star" active={mode === 'kid'} onPress={() => { setMode('kid'); resetKidFlow() }} />
      </View>

      {mode === 'parent' && (
        <>
          <AuthField
            label="ایمیل"
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null) }}
            error={error}
          />
          <AuthField
            label="رمز عبور"
            placeholder="رمز عبور"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={() => { if (!busy) void loginParent() }}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null) }}
            error={error}
          />

          {error && <AuthNote text={error} />}

          <ClayButton ramp={ramps.brand} label="ورود" busy={busy} onPress={loginParent} />

          <TextButton
            label="حساب ندارید؟ ثبت‌نام رایگان"
            accessibilityRole="link"
            color={auth.signup.accentDeep}
            onPress={() => router.replace('/signup')}
          />
        </>
      )}

      {mode === 'kid' && kidStep === 'name' && (
        <>
          <AuthField
            label="نام کاربری"
            placeholder="username"
            align="center"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => { if (!busy && username.trim()) void submitUsername() }}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(null) }}
            error={error}
          />

          {error && <AuthNote text={error} />}

          <ClayButton ramp={ramps.brand} label="ورود" busy={busy} disabled={!username.trim()} onPress={submitUsername} />
        </>
      )}

      {mode === 'kid' && kidStep === 'picture' && (
        <>
          {/* The progress a sighted child sees (how many dots are filled),
              read out as a count; never which friends were tapped. */}
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`${toPersianDigits(picked.length)} از ۳`}
          >
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, i < picked.length && styles.dotFilled]} />
            ))}
          </View>

          {error && <AuthNote text={error} />}

          {characters ? (
            <View style={styles.charGrid}>
              {characters.map(c => (
                <ClayCard
                  key={c.slug}
                  ramp={ramps.review}
                  tone="soft"
                  edge={clay.edgeSm}
                  radius={radii.md}
                  disabled={busy}
                  onPress={() => { void tapCharacter(c.slug) }}
                  accessibilityLabel={c.name_persian}
                  faceStyle={styles.charFace}
                >
                  <FriendAvatar character={c} size={60} />
                </ClayCard>
              ))}
            </View>
          ) : (
            <LoadState error={charsError} onRetry={() => { void loadCharacters() }} />
          )}

          <TextButton label="اسم دیگری وارد کنم" onPress={resetKidFlow} />
        </>
      )}

      {mode === 'kid' && kidStep === 'parent_pin' && (
        <>
          <View style={styles.lockRow}>
            <ParentLock size={64} />
            <Text style={styles.hint}>
              این دستگاه جدید است — برای اولین ورود {child?.name} روی این دستگاه، از مامان یا بابا بخواه پین را وارد کند
            </Text>
          </View>
          <AuthField
            label="پین والدین"
            placeholder="••••"
            align="center"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            value={pin}
            onChangeText={t => { setPin(t.replace(/\D/g, '').slice(0, 4)); setError(null) }}
            error={error}
          />

          {error && <AuthNote text={error} />}

          <ClayButton
            ramp={ramps.brand} label="تأیید" busy={busy} disabled={pin.length < 4}
            onPress={submitParentPin}
          />

          <TextButton label="بازگشت" onPress={resetKidFlow} />
        </>
      )}
      </AuthSheet>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  )
}

/** One segment of the parent/kid switch: 44pt, icon + word, the active one
 *  on the brand's bright face with its ink (never colour alone: the icon and
 *  weight change too, and the state is reported as selected). */
function ModeTab({ label, icon, active, onPress }: { label: string; icon: IconName; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && !active && styles.tabPressed]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Icon name={icon} color={active ? ramps.brand.ink : ui.textMuted} size={18} filled={active && icon === 'star'} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  tabs: {
    flexDirection: 'row', backgroundColor: ramps.brand.soft, borderRadius: radii.pill,
    padding: spacing.xs, gap: spacing.xs, borderWidth: 2, borderColor: ui.divider,
  },
  tab: {
    flex: 1, flexDirection: 'row', gap: spacing.xs + 2, minHeight: ui.hit,
    alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, paddingHorizontal: spacing.sm,
  },
  tabActive: { backgroundColor: ramps.brand.bright, borderBottomWidth: 3, borderBottomColor: ramps.brand.deep },
  tabPressed: { opacity: 0.7 },
  tabText: { color: ui.textMuted, fontFamily: fonts.medium, fontSize: textSize.small },
  tabTextActive: { color: ramps.brand.ink, fontFamily: fonts.bold },
  hint: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: textSize.caption + 1, lineHeight: 24 },
  lockRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4,
    backgroundColor: ramps.brand.soft, borderRadius: radii.md, padding: spacing.sm + 4,
  },
  dots: { flexDirection: 'row', gap: spacing.sm + 2, justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: radii.pill, backgroundColor: colors.card, borderWidth: 2, borderColor: ui.track },
  dotFilled: { backgroundColor: ramps.brand.bright, borderColor: ramps.brand.deep },
  charGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 4, justifyContent: 'center' },
  charFace: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
})
