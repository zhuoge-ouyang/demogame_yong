import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_history_v1'
const MAX_RECORDS = 50

export interface HistoryRecord {
  id: string
  title: string
  timestamp: number
  data: {
    world: any
    continents: any
    landing: any
  }
}

export const useHistoryStore = defineStore('history', () => {
  const records = ref<HistoryRecord[]>([])

  /**
   * 保存快照，标题格式：时间 + 世界观首句（最多20字）
   */
  function saveSnapshot(
    world: any,
    continents: any,
    landing: any,
    firstSentence: string
  ) {
    const now = new Date()
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const excerpt = firstSentence
      ? firstSentence.replace(/[\r\n]+/g, ' ').trim().slice(0, 20)
      : '（暂无内容）'
    const title = `${timeStr} · ${excerpt}`

    const record: HistoryRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      timestamp: Date.now(),
      data: { world, continents, landing }
    }

    records.value.unshift(record)
    if (records.value.length > MAX_RECORDS) {
      records.value = records.value.slice(0, MAX_RECORDS)
    }
    persist()
  }

  function deleteRecord(id: string) {
    records.value = records.value.filter(r => r.id !== id)
    persist()
  }

  function persist() {
    try {
      const data = JSON.stringify(records.value)
      localStorage.setItem(STORAGE_KEY, data)
      saveData('history', JSON.parse(data)).catch(err => {
        console.warn('历史记录服务器保存失败:', err)
      })
    } catch (e) {
      console.error('历史记录保存失败:', e)
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        records.value = JSON.parse(raw) as HistoryRecord[]
      }
    } catch (e) {
      console.error('历史记录读取失败:', e)
    }
  }

  /** 从服务器初始化历史记录 */
  async function initializeFromServer() {
    try {
      const serverData = await fetchData<HistoryRecord[]>('history')
      if (serverData) {
        records.value = serverData
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
      } else {
        loadFromStorage()
        if (records.value.length > 0) {
          await saveData('history', records.value)
        }
      }
    } catch (e) {
      console.warn('从服务器初始化历史记录失败，使用本地数据:', e)
      loadFromStorage()
    }
  }

  /** 从服务器同步历史记录（手动拉取） */
  async function syncFromServer(): Promise<boolean> {
    let loaded = false
    try {
      const serverData = await fetchData<HistoryRecord[]>('history')
      if (serverData) {
        records.value = serverData
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
        loaded = true
      } else {
        console.warn('[history.syncFromServer] 服务器未返回数据（可能会话已过期）')
      }
    } catch (e) {
      console.warn('[history.syncFromServer] 同步失败:', e)
    }
    return loaded
  }

  return {
    records,
    saveSnapshot,
    deleteRecord,
    loadFromStorage,
    initializeFromServer,
    syncFromServer
  }
})
