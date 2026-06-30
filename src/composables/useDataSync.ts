import { ref } from 'vue'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { useHistoryStore } from '@/stores/history'

/**
 * 数据同步 composable
 * 原轮询机制已移除，改为手动拉取（syncNow）
 * 使用场景：多用户协作时，一方保存后另一方点击"拉取最新"按钮主动同步
 */
export function useDataSync() {
  const syncing = ref(false)

  /**
   * 手动拉取最新数据（从服务器同步到本地）
   * @returns true 表示至少有一个存储模块真正加载到了服务器数据，false 表示全部失败（可能会话过期）
   */
  async function syncNow(): Promise<boolean> {
    if (syncing.value) return false
    syncing.value = true
    try {
      const worldStore = useWorldStore()
      const continentsStore = useContinentsStore()
      const landingStore = useLandingStore()
      const historyStore = useHistoryStore()

      const results = await Promise.all([
        worldStore.syncFromServer(),
        continentsStore.syncFromServer(),
        landingStore.syncFromServer(),
        historyStore.syncFromServer(),
      ])

      // 只要主数据模块（world/continents/landing）任意一个加载成功，就视为同步成功
      const mainDataLoaded = results[0] || results[1] || results[2]
      if (!mainDataLoaded) {
        console.warn('[DataSync] 主数据模块均未返回有效数据，可能会话已过期或服务器异常')
        return false
      }

      console.log('[DataSync] 手动拉取完成')
      return true
    } catch (e) {
      console.warn('[DataSync] 手动拉取失败:', e)
      return false
    } finally {
      syncing.value = false
    }
  }

  // 保留 start/stop 空实现，避免 App.vue 引用报错（可安全移除）
  function start() {}
  function stop() {}

  return { syncing, syncNow, start, stop }
}
