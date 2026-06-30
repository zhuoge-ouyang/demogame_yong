import { defineStore } from 'pinia'
import { ref } from 'vue'

interface EditLogEntry {
  id: string
  username: string
  timestamp: number
  moduleName: string
  fieldPath: string
  fieldLabel: string
  oldContent: string
  newContent: string
}

export const useEditLogsStore = defineStore('editLogs', () => {
  const logs = ref<EditLogEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)

  async function fetchLogs(page = 1, pageSize = 50) {
    loading.value = true
    try {
      const res = await fetch(`/api/logs?page=${page}&pageSize=${pageSize}`, {
        credentials: 'same-origin'
      })
      if (res.ok) {
        const data = await res.json()
        if (page === 1) {
          logs.value = data.items
        } else {
          logs.value.push(...data.items)
        }
        total.value = data.total
        currentPage.value = page
      }
    } catch (e) {
      console.warn('[EditLogs] 拉取日志失败:', e)
    } finally {
      loading.value = false
    }
  }

  async function addLog(entry: Omit<EditLogEntry, 'id' | 'username' | 'timestamp'>) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(entry)
      })
    } catch (e) {
      console.warn('[EditLogs] 记录日志失败:', e)
    }
  }

  function loadMore() {
    if (logs.value.length < total.value) {
      fetchLogs(currentPage.value + 1)
    }
  }

  return { logs, total, loading, fetchLogs, addLog, loadMore }
})
