import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import type { Child } from '@koodakbook/shared'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { setActiveChildId, clearActiveChildId } from '@/lib/activeChild'
import { mediaUrl } from '@/lib/media'
import { colors, fonts } from '@/lib/theme'

export default function Children() {
  const [children, setChildren] = useState<Child[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<Child[]>('/api/children').then((res) => {
      if (res.data) setChildren(res.data)
      else setError(res.error)
    })
  }, [])

  async function pick(child: Child) {
    await setActiveChildId(child.id)
    router.replace('/home')
  }

  async function logout() {
    await api.post('/api/auth/logout', {})
    await clearToken()
    await clearActiveChildId()
    router.replace('/login')
  }

  if (!children) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>کی داره می‌خونه؟ 👋</Text>
      <FlatList
        data={children}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            هنوز کودکی ثبت نشده — اول در وب‌سایت یک پروفایل کودک بساز
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => pick(item)}>
            {mediaUrl(item.avatar_url) ? (
              <Image source={{ uri: mediaUrl(item.avatar_url)! }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={{ fontSize: 34 }}>🧒</Text>
              </View>
            )}
            <Text style={styles.name}>{item.name}</Text>
          </Pressable>
        )}
      />
      <Pressable onPress={logout} hitSlop={8}>
        <Text style={styles.logout}>خروج از حساب</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 80, paddingBottom: 40, paddingHorizontal: 24, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 26, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  list: { gap: 12, paddingVertical: 8 },
  empty: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 24, marginTop: 40 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 18, padding: 14,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontFamily: fonts.medium, color: colors.text },
  error: { color: colors.danger, fontFamily: fonts.regular },
  logout: { color: colors.muted, fontFamily: fonts.regular, textAlign: 'center', fontSize: 14 },
})
