import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { WorldState, WorldTreeSystemData } from '@/types/world'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultWorldState } from '@/constants/defaults'
import { useAppStore } from './app'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_world_v1'

export const useWorldStore = defineStore('world', () => {
  const state = reactive<WorldState>(defaultWorldState())
  const appStore = useAppStore()

  // 计算完成度
  const completionPercentage = computed(() => {
    let filled = 0
    let total = 0

    // 三界结构
    const realms = [state.realmStructure.upper, state.realmStructure.mortal, state.realmStructure.abyss]
    for (const r of realms) {
      for (const v of [r.past, r.present, r.future]) {
        total++
        if (v.trim()) filled++
      }
    }
    total++
    if (state.realmStructure.summary.trim()) filled++

    // 主线
    for (const s of state.mainStoryline.stages) {
      for (const v of [s.goal, s.events, s.resolution]) {
        total++
        if (v.trim()) filled++
      }
    }
    total++
    if (state.mainStoryline.overview.trim()) filled++

    // 玩家身份
    for (const v of [state.playerIdentity.origin, state.playerIdentity.initialPerception, state.playerIdentity.revelationArc, state.playerIdentity.gameplayIntegration]) {
      total++
      if (v.trim()) filled++
    }

    // 英雄 - 看name、backstory、joinStage、storyRole
    for (const h of state.heroSystem) {
      total += 4
      if (h.name.trim()) filled++
      if (h.backstory.trim()) filled++
      if (h.joinStage.trim()) filled++
      if (h.storyRole.trim()) filled++
    }

    // 城堡女神
    for (const v of [state.castleGoddess.castle.description, state.castleGoddess.castle.role, state.castleGoddess.goddess.name, state.castleGoddess.goddess.personality, state.castleGoddess.goddess.truthMatrix]) {
      total++
      if (v.trim()) filled++
    }

    // 世界树系统
    for (const v of [state.worldTreeSystem.growthMechanism, state.worldTreeSystem.resourceContribution, state.worldTreeSystem.unlockedFeatures, state.worldTreeSystem.fourthForce, state.worldTreeSystem.runeConnection]) {
      total++
      if (v.trim()) filled++
    }

    return total > 0 ? Math.round((filled / total) * 100) : 0
  })

  // 供AI上下文注入的摘要
  const realmSummaryText = computed(() => {
    const parts: string[] = []
    if (state.realmStructure.summary) parts.push(`【三界概述】${state.realmStructure.summary}`)
    const realmNames = { upper: '上界/神殿', mortal: '凡界', abyss: '深渊' } as const
    for (const [key, name] of Object.entries(realmNames)) {
      const r = state.realmStructure[key as keyof typeof realmNames]
      if (r.present) parts.push(`【${name}·现状】${r.present}`)
    }
    if (state.mainStoryline.overview) parts.push(`【主线概述】${state.mainStoryline.overview}`)
    if (state.playerIdentity.origin) parts.push(`【玩家身份】${state.playerIdentity.origin}`)
    return parts.join('\n\n')
  })

  // 初始化完成前禁止自动保存（防止旧缓存覆盖服务器数据）
  let _initialized = false

  // 自动保存（三写：localStorage + world服务器 + world-avatar服务器）
  const debouncedSave = useDebounceFn(() => {
    if (!_initialized) return
    try {
      const data = JSON.stringify(state)
      // 本地缓存（同步，快速）
      localStorage.setItem(STORAGE_KEY, data)
      // 服务器保存（异步，共享）
      const parsed = JSON.parse(data)
      saveData('world', parsed).catch(err => {
        console.warn('服务器保存失败:', err)
      })
      // 同步 avatar 版本（确保长版本背景故事不丢失）
      saveData('world-avatar', parsed).catch(err => {
        console.warn('avatar保存失败:', err)
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
        const data = JSON.parse(raw) as Partial<WorldState>
        Object.assign(state, defaultWorldState(), data)
      }
    } catch (e) {
      console.error('读取失败:', e)
    }
  }

  function loadFromJSON(data: WorldState) {
    try {
      const defaults = defaultWorldState()
      // 向后兼容：旧数据可能没有 _meta
      if (!data._meta || typeof data._meta !== 'object') {
        (data as any)._meta = defaults._meta
      }
      // heroSystem 必须是数组
      if (!Array.isArray(data.heroSystem)) {
        console.warn('[world.loadFromJSON] heroSystem 不是数组，使用默认值')
        ;(data as any).heroSystem = defaults.heroSystem
      }
      // realmStructure 检查
      if (!data.realmStructure || typeof data.realmStructure !== 'object') {
        console.warn('[world.loadFromJSON] realmStructure 格式异常，使用默认值')
        ;(data as any).realmStructure = defaults.realmStructure
      } else {
        for (const rk of ['upper', 'mortal', 'abyss'] as const) {
          if (!data.realmStructure[rk] || typeof data.realmStructure[rk] !== 'object') {
            console.warn(`[world.loadFromJSON] realmStructure.${rk} 格式异常，使用默认值`)
            ;(data.realmStructure as any)[rk] = defaults.realmStructure[rk]
          }
        }
      }
      // mainStoryline 检查
      if (!data.mainStoryline || typeof data.mainStoryline !== 'object') {
        console.warn('[world.loadFromJSON] mainStoryline 格式异常，使用默认值')
        ;(data as any).mainStoryline = defaults.mainStoryline
      } else if (!Array.isArray(data.mainStoryline.stages)) {
        console.warn('[world.loadFromJSON] mainStoryline.stages 不是数组，使用默认值')
        ;(data.mainStoryline as any).stages = defaults.mainStoryline.stages
      }
      // playerIdentity 检查
      if (!data.playerIdentity || typeof data.playerIdentity !== 'object') {
        console.warn('[world.loadFromJSON] playerIdentity 格式异常，使用默认值')
        ;(data as any).playerIdentity = defaults.playerIdentity
      }
      // castleGoddess 检查
      if (!data.castleGoddess || typeof data.castleGoddess !== 'object') {
        console.warn('[world.loadFromJSON] castleGoddess 格式异常，使用默认值')
        ;(data as any).castleGoddess = defaults.castleGoddess
      } else {
        if (!data.castleGoddess.castle || typeof data.castleGoddess.castle !== 'object') {
          ;(data.castleGoddess as any).castle = defaults.castleGoddess.castle
        }
        if (!data.castleGoddess.goddess || typeof data.castleGoddess.goddess !== 'object') {
          ;(data.castleGoddess as any).goddess = defaults.castleGoddess.goddess
        }
      }
      // worldTreeSystem 检查
      if (!data.worldTreeSystem || typeof data.worldTreeSystem !== 'object') {
        console.warn('[world.loadFromJSON] worldTreeSystem 格式异常，使用默认值')
        ;(data as any).worldTreeSystem = defaults.worldTreeSystem
      }
      Object.assign(state, defaults, data)
    } catch (e) {
      console.error('[world.loadFromJSON] 加载失败:', e)
      throw e
    }
  }

  function getExportData(): WorldState {
    return JSON.parse(JSON.stringify(state))
  }

  /** 立即保存（跳过防抖，用于页面隐藏/卸载时） */
  function saveNow() {
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      const parsed = JSON.parse(data)
      // 异步保存到服务器（不等待）
      saveData('world', parsed).catch(err => {
        console.warn('服务器立即保存失败:', err)
      })
      saveData('world-avatar', parsed).catch(err => {
        console.warn('avatar立即保存失败:', err)
      })
      appStore.updateSaveTimestamp()
    } catch (e) {
      console.error('立即保存失败:', e)
    }
  }

  /** 重置所有世界观数据到默认空状态 */
  function resetAll() {
    Object.assign(state, defaultWorldState())
    saveNow()
  }

  /** 从服务器初始化数据（服务器优先，localStorage 降级） */
  async function initializeFromServer() {
    try {
      const serverData = await fetchData<WorldState>('world')
      if (serverData) {
        // 服务器有数据，使用服务器数据并更新本地缓存
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
      } else {
        // 服务器无数据，从 localStorage 读取（兼容旧数据）
        loadFromStorage()
        // 将本地数据同步到服务器
        const exportData = getExportData()
        await saveData('world', exportData)
      }
      // 从 avatar 版本校准英雄背景故事（avatar 保留 AI 生成的长版本，防止被自动保存覆盖）
      await calibrateBackstoriesFromAvatar()
    } catch (e) {
      console.warn('从服务器初始化失败，使用本地数据:', e)
      loadFromStorage()
    } finally {
      _initialized = true
    }
  }

  /**
   * 从 world-avatar.json 校准英雄背景故事
   * avatar 文件保留 AI 生成的长版本故事，当 world.json 的 backstory 比 avatar 短时自动恢复
   * 这防止了自动保存机制将长版本覆盖为短版本的问题
   */
  async function calibrateBackstoriesFromAvatar() {
    try {
      const avatarData = await fetchData<WorldState>('world-avatar')
      if (!avatarData?.heroSystem || !Array.isArray(avatarData.heroSystem)) return

      let patched = false
      for (let i = 0; i < state.heroSystem.length && i < avatarData.heroSystem.length; i++) {
        const avatarBs = avatarData.heroSystem[i]?.backstory || ''
        const currentBs = state.heroSystem[i]?.backstory || ''
        if (avatarBs.length > currentBs.length) {
          state.heroSystem[i].backstory = avatarBs
          patched = true
          console.log(`[backstory-calibrate] ${state.heroSystem[i].element}·${state.heroSystem[i].name}: ${currentBs.length} → ${avatarBs.length} chars (restored from avatar)`)
        }
      }

      if (patched) {
        // 同步修正后的数据到服务器和本地缓存
        const data = JSON.stringify(state)
        localStorage.setItem(STORAGE_KEY, data)
        await saveData('world', JSON.parse(data))
        console.log('[backstory-calibrate] 已同步修正后的背景故事到服务器')
      }
    } catch (e) {
      console.warn('[backstory-calibrate] 从 avatar 校准背景故事失败:', e)
    }
  }

  /** 将指定字段标记为定稿 */
  function finalizeField(moduleName: keyof WorldState['_meta'], fieldPath: string) {
    if (!state._meta[moduleName]) state._meta[moduleName] = {}
    state._meta[moduleName][fieldPath] = {
      ...(state._meta[moduleName][fieldPath] || createDefaultFieldMeta()),
      status: 'finalized',
      finalizedAt: Date.now()
    }
  }

  /** 解除定稿 */
  function unfinalizeField(moduleName: keyof WorldState['_meta'], fieldPath: string) {
    if (state._meta[moduleName]?.[fieldPath]) {
      state._meta[moduleName][fieldPath].status = 'draft'
      state._meta[moduleName][fieldPath].finalizedAt = undefined
    }
  }

  /** 批量定稿整个模块 */
  function finalizeModule(moduleName: keyof WorldState['_meta'], fieldPaths: string[]) {
    for (const fp of fieldPaths) {
      finalizeField(moduleName, fp)
    }
  }

  /** 查询字段是否已定稿 */
  function isFieldFinalized(moduleName: keyof WorldState['_meta'], fieldPath: string): boolean {
    return state._meta[moduleName]?.[fieldPath]?.status === 'finalized'
  }

  /** 获取字段元数据 */
  function getFieldMeta(moduleName: keyof WorldState['_meta'], fieldPath: string): FieldMeta {
    return state._meta[moduleName]?.[fieldPath] || createDefaultFieldMeta()
  }

  /** 更新字段编辑元数据 */
  function updateFieldEditMeta(moduleName: keyof WorldState['_meta'], fieldPath: string, source: 'user' | 'ai') {
    if (!state._meta[moduleName]) state._meta[moduleName] = {}
    const existing = state._meta[moduleName][fieldPath] || createDefaultFieldMeta()
    state._meta[moduleName][fieldPath] = {
      ...existing,
      lastEditedAt: Date.now(),
      lastEditSource: source
    }
  }

  return {
    state,
    completionPercentage,
    realmSummaryText,
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
