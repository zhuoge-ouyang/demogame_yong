import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const API_BASE = '/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const username = ref('')
  const role = ref<'admin' | 'client' | ''>('')
  const isChecking = ref(true) // 初始化检查中
  
  const isAdmin = computed(() => role.value === 'admin')
  const isClient = computed(() => role.value === 'client')

  async function login(user: string, pass: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
        credentials: 'same-origin'
      })
      const data = await res.json()
      if (data.success) {
        isAuthenticated.value = true
        username.value = data.username
        role.value = data.role
        return { success: true }
      }
      return { success: false, message: data.message || '登录失败' }
    } catch (e) {
      return { success: false, message: '网络错误' }
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'same-origin' })
    } catch (e) {
      // ignore
    }
    isAuthenticated.value = false
    username.value = ''
    role.value = ''
  }
  
  async function checkAuth() {
    try {
      const res = await fetch(`${API_BASE}/check`, { credentials: 'same-origin' })
      const data = await res.json()
      isAuthenticated.value = data.authenticated
      username.value = data.username || ''
      role.value = data.role || ''
    } catch (e) {
      isAuthenticated.value = false
    } finally {
      isChecking.value = false
    }
  }

  return { isAuthenticated, username, role, isAdmin, isClient, isChecking, login, logout, checkAuth }
})
