import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { ContinentsState, ContinentId, ContinentAspects } from '@/types/continent'
import { ASPECT_KEYS } from '@/types/continent'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultContinentsState } from '@/constants/defaults'
import { useAppStore } from './app'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_continents_v1'

export const useContinentsStore = defineStore('continents', () => {
  const state = reactive<ContinentsState>(defaultContinentsState())
  const appStore = useAppStore()

  function getContinentCompletion(id: ContinentId): number {
    const aspects = state[id]?.aspects
    if (!aspects) return 0
    let filled = 0
    for (const key of ASPECT_KEYS) {
      if (aspects[key].trim()) filled++
    }
    return Math.round((filled / ASPECT_KEYS.length) * 100)
  }

  const overallCompletion = computed(() => {
    const ids = Object.keys(state) as ContinentId[]
    if (ids.length === 0) return 0
    const total = ids.reduce((sum, id) => sum + getContinentCompletion(id), 0)
    return Math.round(total / ids.length)
  })

  function getContinentSummary(id: ContinentId): string {
    const c = state[id]
    if (!c) return ''
    const parts: string[] = []
    if (c.aspects.mainPlot) parts.push(`【主线剧情】${c.aspects.mainPlot}`)
    if (c.aspects.coreConflict) parts.push(`【核心冲突】${c.aspects.coreConflict}`)
    if (c.aspects.playerGoal) parts.push(`【玩家目标】${c.aspects.playerGoal}`)
    if (c.aspects.themeExpression) parts.push(`【主题表达】${c.aspects.themeExpression}`)
    return parts.join('\n\n')
  }

  function updateAspect(continentId: ContinentId, key: keyof ContinentAspects, value: string) {
    if (state[continentId]) {
      state[continentId].aspects[key] = value
    }
  }

  const debouncedSave = useDebounceFn(() => {
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      saveData('continents', JSON.parse(data)).catch(err => {
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
        const data = JSON.parse(raw) as Partial<ContinentsState>
        const defaults = defaultContinentsState()
        for (const key of Object.keys(defaults) as ContinentId[]) {
          if (data[key]) {
            Object.assign(state[key], defaults[key], data[key])
          }
        }
      }
    } catch (e) {
      console.error('读取失败:', e)
    }
  }

  function loadFromJSON(data: ContinentsState) {
    try {
      const defaults = defaultContinentsState()
      for (const key of Object.keys(defaults) as ContinentId[]) {
        const src = data[key] || {}
        // 向后兼容：旧数据可能没有 _meta
        if (!(src as any)._meta || typeof (src as any)._meta !== 'object') {
          (src as any)._meta = {}
        }
        // aspects 字段检查
        if (!(src as any).aspects || typeof (src as any).aspects !== 'object') {
          console.warn(`[continents.loadFromJSON] ${key}.aspects 格式异常，使用默认值`)
          ;(src as any).aspects = defaults[key].aspects
        }
        Object.assign(state[key], defaults[key], src)
      }
    } catch (e) {
      console.error('[continents.loadFromJSON] 加载失败:', e)
      throw e
    }
  }

  function getExportData(): ContinentsState {
    return JSON.parse(JSON.stringify(state))
  }

  /** 立即保存（跳过防抖，用于页面隐藏/卸载时） */
  function saveNow() {
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      saveData('continents', JSON.parse(data)).catch(err => {
        console.warn('服务器立即保存失败:', err)
      })
      appStore.updateSaveTimestamp()
    } catch (e) {
      console.error('立即保存失败:', e)
    }
  }

  /** 重置所有大陆数据到默认空状态 */
  function resetAll() {
    loadFromJSON(defaultContinentsState())
    saveNow()
  }

  /** 从服务器初始化数据 */
  async function initializeFromServer() {
    try {
      const serverData = await fetchData<ContinentsState>('continents')
      if (serverData) {
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
      } else {
        loadFromStorage()
        const exportData = getExportData()
        await saveData('continents', exportData)
      }
    } catch (e) {
      console.warn('从服务器初始化失败，使用本地数据:', e)
      loadFromStorage()
    }
  }

  /** 将指定大陆字段标记为定稿 */
  function finalizeField(continentId: ContinentId, fieldPath: string) {
    if (!state[continentId]._meta) state[continentId]._meta = {}
    state[continentId]._meta[fieldPath] = {
      ...(state[continentId]._meta[fieldPath] || createDefaultFieldMeta()),
      status: 'finalized',
      finalizedAt: Date.now()
    }
  }

  /** 解除定稿 */
  function unfinalizeField(continentId: ContinentId, fieldPath: string) {
    if (state[continentId]._meta?.[fieldPath]) {
      state[continentId]._meta[fieldPath].status = 'draft'
      state[continentId]._meta[fieldPath].finalizedAt = undefined
    }
  }

  /** 批量定稿整个大陆 */
  function finalizeModule(continentId: ContinentId, fieldPaths: string[]) {
    for (const fp of fieldPaths) {
      finalizeField(continentId, fp)
    }
  }

  /** 查询字段是否已定稿 */
  function isFieldFinalized(continentId: ContinentId, fieldPath: string): boolean {
    return state[continentId]._meta?.[fieldPath]?.status === 'finalized'
  }

  /** 获取字段元数据 */
  function getFieldMeta(continentId: ContinentId, fieldPath: string): FieldMeta {
    return state[continentId]._meta?.[fieldPath] || createDefaultFieldMeta()
  }

  /** 更新字段编辑元数据 */
  function updateFieldEditMeta(continentId: ContinentId, fieldPath: string, source: 'user' | 'ai') {
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
    getContinentSummary,
    updateAspect,
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
