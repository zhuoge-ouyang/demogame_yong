import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { LandingsState, LandingContinentId, BossDesign, LevelNode } from '@/types/landing'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultLandingsState } from '@/constants/defaults'
import { useAppStore } from './app'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_landing_v1'

export const useLandingStore = defineStore('landing', () => {
  const state = reactive<LandingsState>(defaultLandingsState())
  const appStore = useAppStore()

  function getContinentCompletion(id: LandingContinentId): number {
    const c = state[id]
    if (!c) return 0
    let filled = 0
    let total = 0
    // entryPrompt
    for (const v of Object.values(c.entryPrompt)) { total++; if ((v as string).trim()) filled++ }
    // completionFeedback
    for (const v of Object.values(c.completionFeedback)) { total++; if ((v as string).trim()) filled++ }
    // bosses
    for (const b of c.bosses) {
      total += 3
      if (b.name.trim()) filled++
      if (b.motivation.trim()) filled++
      if (b.signatureLine.trim()) filled++
    }
    // levelNodes
    for (const n of c.levelNodes) {
      total += 2
      if (n.storyBeat.trim()) filled++
      if (n.keyEncounter.trim()) filled++
    }
    return total > 0 ? Math.round((filled / total) * 100) : 0
  }

  const overallCompletion = computed(() => {
    const ids: LandingContinentId[] = ['jin', 'bing', 'huo']
    const total = ids.reduce((sum, id) => sum + getContinentCompletion(id), 0)
    return Math.round(total / ids.length)
  })

  function addBoss(continentId: LandingContinentId) {
    state[continentId].bosses.push({
      name: '', identity: '', motivation: '', signatureLine: '', openingScene: '', storyConnection: ''
    })
  }

  function removeBoss(continentId: LandingContinentId, index: number) {
    state[continentId].bosses.splice(index, 1)
  }

  const debouncedSave = useDebounceFn(() => {
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      saveData('landing', JSON.parse(data)).catch(err => {
        console.warn('服务器保存失败:', err)
      })
      appStore.updateSaveTimestamp()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }, 1000)

  watch(state, () => debouncedSave(), { deep: true })

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw) as Partial<LandingsState>
        const defaults = defaultLandingsState()
        for (const key of Object.keys(defaults) as LandingContinentId[]) {
          if (data[key]) {
            Object.assign(state[key], defaults[key], data[key])
          }
        }
      }
    } catch (e) {
      console.error('读取失败:', e)
    }
  }

  function loadFromJSON(data: LandingsState) {
    try {
      const defaults = defaultLandingsState()
      for (const key of Object.keys(defaults) as LandingContinentId[]) {
        const src = data[key] || {}
        // 向后兼容：旧数据可能没有 _meta
        if (!(src as any)._meta || typeof (src as any)._meta !== 'object') {
          (src as any)._meta = {}
        }
        // entryPrompt 检查
        if (!(src as any).entryPrompt || typeof (src as any).entryPrompt !== 'object') {
          console.warn(`[landing.loadFromJSON] ${key}.entryPrompt 格式异常，使用默认值`)
          ;(src as any).entryPrompt = defaults[key].entryPrompt
        }
        // completionFeedback 检查
        if (!(src as any).completionFeedback || typeof (src as any).completionFeedback !== 'object') {
          console.warn(`[landing.loadFromJSON] ${key}.completionFeedback 格式异常，使用默认值`)
          ;(src as any).completionFeedback = defaults[key].completionFeedback
        }
        // bosses 检查
        if (!Array.isArray((src as any).bosses)) {
          console.warn(`[landing.loadFromJSON] ${key}.bosses 不是数组，使用默认值`)
          ;(src as any).bosses = defaults[key].bosses
        }
        // levelNodes 检查
        if (!Array.isArray((src as any).levelNodes)) {
          console.warn(`[landing.loadFromJSON] ${key}.levelNodes 不是数组，使用默认值`)
          ;(src as any).levelNodes = defaults[key].levelNodes
        }
        Object.assign(state[key], defaults[key], src)
      }
    } catch (e) {
      console.error('[landing.loadFromJSON] 加载失败:', e)
      throw e
    }
  }

  function getExportData(): LandingsState {
    return JSON.parse(JSON.stringify(state))
  }

  /** 立即保存（跳过防抖，用于页面隐藏/卸载时） */
  function saveNow() {
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      saveData('landing', JSON.parse(data)).catch(err => {
        console.warn('服务器立即保存失败:', err)
      })
      appStore.updateSaveTimestamp()
    } catch (e) {
      console.error('立即保存失败:', e)
    }
  }

  /** 重置所有关卡数据到默认空状态 */
  function resetAll() {
    loadFromJSON(defaultLandingsState())
    saveNow()
  }

  /** 从服务器初始化数据 */
  async function initializeFromServer() {
    try {
      const serverData = await fetchData<LandingsState>('landing')
      if (serverData) {
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
      } else {
        loadFromStorage()
        const exportData = getExportData()
        await saveData('landing', exportData)
      }
    } catch (e) {
      console.warn('从服务器初始化失败，使用本地数据:', e)
      loadFromStorage()
    }
  }

  /** 将指定字段标记为定稿 */
  function finalizeField(continentId: LandingContinentId, fieldPath: string) {
    if (!state[continentId]._meta) state[continentId]._meta = {}
    state[continentId]._meta[fieldPath] = {
      ...(state[continentId]._meta[fieldPath] || createDefaultFieldMeta()),
      status: 'finalized',
      finalizedAt: Date.now()
    }
  }

  /** 解除定稿 */
  function unfinalizeField(continentId: LandingContinentId, fieldPath: string) {
    if (state[continentId]._meta?.[fieldPath]) {
      state[continentId]._meta[fieldPath].status = 'draft'
      state[continentId]._meta[fieldPath].finalizedAt = undefined
    }
  }

  /** 批量定稿 */
  function finalizeModule(continentId: LandingContinentId, fieldPaths: string[]) {
    for (const fp of fieldPaths) {
      finalizeField(continentId, fp)
    }
  }

  /** 查询字段是否已定稿 */
  function isFieldFinalized(continentId: LandingContinentId, fieldPath: string): boolean {
    return state[continentId]._meta?.[fieldPath]?.status === 'finalized'
  }

  /** 获取字段元数据 */
  function getFieldMeta(continentId: LandingContinentId, fieldPath: string): FieldMeta {
    return state[continentId]._meta?.[fieldPath] || createDefaultFieldMeta()
  }

  /** 更新字段编辑元数据 */
  function updateFieldEditMeta(continentId: LandingContinentId, fieldPath: string, source: 'user' | 'ai') {
    if (!state[continentId]._meta) state[continentId]._meta = {}
    const existing = state[continentId]._meta[fieldPath] || createDefaultFieldMeta()
    state[continentId]._meta[fieldPath] = {
      ...existing,
      lastEditedAt: Date.now(),
      lastEditSource: source
    }
  }

  return {
    state,
    overallCompletion,
    getContinentCompletion,
    addBoss,
    removeBoss,
    loadFromStorage,
    loadFromJSON,
    getExportData,
    saveNow,
    resetAll,
    initializeFromServer,
    finalizeField,
    unfinalizeField,
    finalizeModule,
    isFieldFinalized,
    getFieldMeta,
    updateFieldEditMeta
  }
})
