'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'

export default function SettingsPage() {
  const router = useRouter()

  async function handleLogout() {
    await api.post('/api/auth/logout', {})
    clearToken()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-center gap-4">
        <Link href="/parent/dashboard" className="text-gray-400 text-2xl hover:text-gray-600">←</Link>
        <h1 className="font-bold text-xl text-gray-800">تنظیمات</h1>
      </div>

      <div className="px-4 pt-5 space-y-3">
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          <Link href="/onboarding" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
            <span className="font-medium text-gray-800">ویرایش پروفایل کودک</span>
            <span className="text-gray-400">←</span>
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-red-500">
            <span className="font-medium">خروج از حساب</span>
            <span>🚪</span>
          </button>
        </div>
      </div>
    </div>
  )
}
