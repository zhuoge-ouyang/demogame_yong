import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * 检测当前用户是否具备"作者/管理员"级别权限
 * 用于控制 AI 设置、Prompt 编辑/查看/复制、模型配置等敏感功能可见性
 *
 * 允许访问的身份：
 * 1) 本地开发（localhost / 127.0.0.1）
 * 2) 已登录的 admin 角色
 * 3) 已登录用户名为 ouyang（作者本人）
 *
 * 其他情况（外网普通 client 访客）不允许看到 Prompt 敏感入口。
 */
export function useLocalAccess() {
  const authStore = useAuthStore()

  const isLocalUser = computed(() => {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (authStore.isAdmin) return true
    if (authStore.username === 'ouyang') return true
    return false
  })

  return { isLocalUser }
}
