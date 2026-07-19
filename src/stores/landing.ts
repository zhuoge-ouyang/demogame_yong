import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { LandingsState, LandingContinentId, LandingAct } from '@/types/landing'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultLandingsState } from '@/constants/defaults'
import { ALL_LANDING_CONTINENT_IDS, LANDING_CONTINENT_IDS } from '@/constants/continents'
import { useAppStore } from './app'
import { useAuthStore } from './auth'
import { useEditLogsStore } from './edit-logs'
import { fetchData, saveData } from '@/services/data-api'

// Phase3 v2 adds storyContent and opponent fields. Keep it isolated from the
// legacy cache so an old dirty draft cannot overwrite the expanded schema.
const STORAGE_KEY = 'sjg_landing_v2'
const DIRTY_KEY = 'sjg_landing_v2_dirty'  // 标记本地有未同步到服务器的数据

export const useLandingStore = defineStore('landing', () => {
  const state = reactive<LandingsState>(defaultLandingsState())
  const appStore = useAppStore()

  function getContinentCompletion(id: LandingContinentId): number {
    const c = state[id]
    if (!c) return 0
    let filled = 0
    let total = 0

    const count = (value: unknown) => {
      total++
      if (typeof value === 'string' && value.trim()) filled++
    }

    count(c.systemDialogue?.opening)
    for (const dialogue of c.systemDialogue?.actNodes || []) count(dialogue)

    for (const b of c.bosses || []) {
      count(b.name)
      count(b.identity)
      count(b.motivation)
      count(b.signatureLine)
    }

    ;(c.levelNodes || []).forEach((n, index) => {
      count(n.storyPurpose)
      count(n.storyContent)
      count(n.entryPrompt)
      count(n.completionFeedback)
      count(n.narrativeReward)
      if ((index + 1) % 3 !== 0) {
        count(n.opponent?.name)
        count(n.opponent?.identity)
        count(n.opponent?.motivation)
        count(n.opponent?.signatureLine)
      }
    })

    return total > 0 ? Math.round((filled / total) * 100) : 0
  }

  const overallCompletion = computed(() => {
    const total = LANDING_CONTINENT_IDS.reduce((sum, id) => sum + getContinentCompletion(id), 0)
    return Math.round(total / LANDING_CONTINENT_IDS.length)
  })

  let _initialized = false
  // 同步中禁止自动保存（防止轮询数据触发保存循环）
  let _syncing = false
  // 字段编辑前快照（用于日志记录 oldContent）
  const _fieldSnapshots: Record<string, Record<string, string>> = {}

  const debouncedSave = useDebounceFn(() => {
    if (!_initialized) return
    if (_syncing) return
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      localStorage.setItem(DIRTY_KEY, Date.now().toString())  // 标记本地有未同步数据
      saveData('landing', JSON.parse(data)).then(() => {
        localStorage.removeItem(DIRTY_KEY)  // 服务器保存成功，清除脏标记
      }).catch(err => {
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
        const data = JSON.parse(raw) as LandingsState
        loadFromJSON(data)
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
        const raw = src as any
        const legacyEntry = raw.entryPrompt || {}
        const rawSystemDialogue = raw.systemDialogue || {}
        const actNodes = Array.isArray(rawSystemDialogue.actNodes)
          ? rawSystemDialogue.actNodes.slice(0, 3)
          : ['', '', '']
        while (actNodes.length < 3) actNodes.push('')

        state[key].systemDialogue.opening = rawSystemDialogue.opening || legacyEntry.npcDialogue || ''
        state[key].systemDialogue.actNodes.splice(0, 3, ...actNodes)

        const sourceBosses = Array.isArray(raw.bosses) ? raw.bosses : []
        const normalizedBosses = defaults[key].bosses.map((fallbackBoss, index) => {
          const boss = sourceBosses[index] || {}
          return {
            name: boss.name || '',
            identity: boss.identity || '',
            motivation: boss.motivation || '',
            signatureLine: boss.signatureLine || '',
            act: (index + 1) as LandingAct,
            areaIndex: ((index + 1) * 3) as 3 | 6 | 9
          }
        })
        state[key].bosses.splice(0, state[key].bosses.length, ...normalizedBosses)

        const sourceNodes = Array.isArray(raw.levelNodes) ? raw.levelNodes : []
        const normalizedNodes = defaults[key].levelNodes.map((fallbackNode, index) => {
          const node = sourceNodes[index] || {}
          const opponent = node.opponent || {}
          return {
            name: node.name || fallbackNode.name,
            act: (Math.floor(index / 3) + 1) as LandingAct,
            storyPurpose: node.storyPurpose || node.storyBeat || '',
            storyContent: node.storyContent || node.story || '',
            entryPrompt: node.entryPrompt || '',
            completionFeedback: node.completionFeedback || '',
            narrativeReward: node.narrativeReward || '',
            opponent: {
              name: opponent.name || '',
              identity: opponent.identity || '',
              motivation: opponent.motivation || '',
              signatureLine: opponent.signatureLine || ''
            },
            gameplayHandoff: node.gameplayHandoff || node.keyEncounter || ''
          }
        })
        state[key].levelNodes.splice(0, state[key].levelNodes.length, ...normalizedNodes)

        if (!(state[key] as any)._meta) (state[key] as any)._meta = {}
        Object.assign((state[key] as any)._meta, raw._meta || {})
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
  async function saveNow() {
    if (!_initialized) {
      console.warn('[landing.saveNow] 未初始化，跳过保存')
      return
    }
    // 注意：不检查 _syncing，手动保存不应被后台同步阻止
    if (_syncing) {
      console.warn('[landing.saveNow] 后台同步中，但仍强制执行手动保存')
    }
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      localStorage.setItem(DIRTY_KEY, Date.now().toString())  // 标记本地有未同步数据
      const parsed = JSON.parse(data)
      // 异步保存到服务器（等待完成以便后续提交日志）
      const saved = await saveData('landing', parsed)
      if (!saved) {
        throw new Error('服务器保存 landing 失败')
      }
      localStorage.removeItem(DIRTY_KEY)  // 服务器保存成功，清除脏标记
      appStore.updateSaveTimestamp()

      // 保存成功后提交日志
      try {
        const editLogsStore = useEditLogsStore()
        let logCount = 0
        for (const [continentId, fields] of Object.entries(_fieldSnapshots)) {
          for (const [fieldPath, oldVal] of Object.entries(fields)) {
            const newVal = getFieldContent(continentId, fieldPath)
            if (newVal !== undefined && newVal !== oldVal) {
              await editLogsStore.addLog({
                moduleName: 'landing',
                fieldPath: `${continentId}.${fieldPath}`,
                fieldLabel: getFieldLabel(continentId as LandingContinentId, fieldPath),
                oldContent: oldVal,
                newContent: newVal
              })
              logCount++
              // 更新快照为当前值
              _fieldSnapshots[continentId][fieldPath] = newVal
            }
          }
        }
        if (logCount > 0) {
          console.log(`[landing] 已提交 ${logCount} 条编辑日志`)
        }
      } catch (e) {
        console.warn('[landing] 日志提交失败:', e)
      }
    } catch (e) {
      console.error('立即保存失败:', e)
      throw e  // 重新抛出，让调用者知道保存失败
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
      const dirtyTs = localStorage.getItem(DIRTY_KEY)
      const localRaw = localStorage.getItem(STORAGE_KEY)

      if (dirtyTs && localRaw) {
        // 本地有未同步的数据，优先使用本地数据
        console.log('[landing.initializeFromServer] 检测到本地未同步数据，优先使用本地缓存')
        loadFromStorage()
        const exportData = getExportData()
        await saveData('landing', exportData)
        localStorage.removeItem(DIRTY_KEY)
      } else if (serverData) {
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
    } finally {
      _initialized = true
      // 数据加载完成后，对所有字段做全量快照
      snapshotAllFields()
    }
  }

  /** 从服务器同步数据（手动拉取，不触发自动保存） */
  async function syncFromServer(): Promise<boolean> {
    _syncing = true
    let loaded = false
    try {
      const serverData = await fetchData<LandingsState>('landing')
      if (serverData) {
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
        loaded = true
        console.log('[landing.syncFromServer] 已从服务器加载最新数据')
      } else {
        console.warn('[landing.syncFromServer] 服务器未返回数据（可能会话已过期），保持当前状态')
      }
    } catch (e) {
      console.warn('[landing.syncFromServer] 同步失败:', e)
    } finally {
      // 注意：不要在这里调用 snapshotAllFields！
      // 否则会覆盖用户编辑前的快照，导致保存时无法检测差异
      // 超时时间 1200ms > 防抖时间 1000ms，确保 loadFromJSON 触发的防抖保存
      // 在 _syncing 仍为 true 时执行并提前返回，避免触发不必要的服务器保存和脏标记
      setTimeout(() => { _syncing = false }, 1200)
    }
    return loaded
  }

  /** 将指定字段标记为定稿 */
  function finalizeField(continentId: LandingContinentId, fieldPath: string) {
    const authStore = useAuthStore()
    if (!state[continentId]._meta) state[continentId]._meta = {}
    state[continentId]._meta[fieldPath] = {
      ...(state[continentId]._meta[fieldPath] || createDefaultFieldMeta()),
      status: 'finalized',
      finalizedAt: Date.now(),
      finalizedBy: authStore.username
    }
  }

  /** 解除定稿 */
  function unfinalizeField(continentId: LandingContinentId, fieldPath: string) {
    if (state[continentId]._meta?.[fieldPath]) {
      state[continentId]._meta[fieldPath].status = 'draft'
      state[continentId]._meta[fieldPath].finalizedAt = undefined
      state[continentId]._meta[fieldPath].finalizedBy = undefined
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
    const authStore = useAuthStore()
    if (!state[continentId]._meta) state[continentId]._meta = {}
    const existing = state[continentId]._meta[fieldPath] || createDefaultFieldMeta()
    const normalizedFieldPath = normalizeLandingFieldPath(fieldPath)

    const updates: Partial<FieldMeta> = {
      ...existing,
      lastEditedAt: Date.now(),
      lastEditSource: source,
      lastEditBy: authStore.username
    }

    if (authStore.username === 'yongge' && !existing.baseContent) {
      const baselineContent = _fieldSnapshots[continentId]?.[fieldPath]
        ?? _fieldSnapshots[continentId]?.[normalizedFieldPath]
        ?? getFieldContent(continentId, fieldPath)
      if (baselineContent !== undefined) {
        updates.baseContent = baselineContent
      }
    }

    if (authStore.username === 'ouyang' || authStore.username !== 'yongge') {
      updates.baseContent = undefined
    }

    state[continentId]._meta[fieldPath] = updates as FieldMeta
  }

  function normalizeLandingFieldPath(fieldPath: string): string {
    return fieldPath
  }

  /** 根据大陆ID和字段路径获取字段当前值 */
  function getFieldContent(continentId: string, fieldPath: string): string | undefined {
    try {
      const parts = normalizeLandingFieldPath(fieldPath).split('.')
      const continentData = (state as any)[continentId]
      if (!continentData) return undefined
      
      // 处理嵌套路径如 'entryPrompt.narrative'
      let val: any = continentData
      for (const part of parts) {
        if (val === undefined || val === null) return undefined
        // 处理数组索引如 'bosses.0.name'
        if (/^\d+$/.test(part)) {
          val = val[parseInt(part)]
        } else {
          val = val[part]
        }
      }
      return typeof val === 'string' ? val : undefined
    } catch {
      return undefined
    }
  }

  /** 获取字段标签 */
  function getFieldLabel(continentId: LandingContinentId, fieldPath: string): string {
    const continentNames: Record<LandingContinentId, string> = {
      jin: '金',
      mu: '森',
      bing: '冰',
      huo: '火'
    }
    
    // 解析字段路径
    const parts = fieldPath.split('.')
    
    if (parts[0] === 'systemDialogue') {
      const fieldLabels: Record<string, string> = {
        opening: '开场对白',
        actNodes: '阶段节点对白'
      }
      const suffix = parts.length > 2 ? `${Number(parts[2]) + 1}` : ''
      return `${continentNames[continentId]}大陆-${fieldLabels[parts[1]] || parts[1]}${suffix}`
    }
    
    // 处理 bosses 和 levelNodes 数组字段
    if ((parts[0] === 'bosses' || parts[0] === 'levelNodes') && parts.length >= 3) {
      const sectionLabels: Record<string, string> = {
        bosses: 'BOSS',
        levelNodes: '关卡节点'
      }
      const index = parseInt(parts[1]) + 1
      const fieldLabels: Record<string, string> = {
        name: '名称',
        identity: '身份',
        motivation: '动机',
        signatureLine: '标志性台词',
        storyPurpose: '叙事任务',
        storyContent: '区域故事',
        entryPrompt: '进入前提示',
        completionFeedback: '结束后反馈',
        narrativeReward: '叙事奖励',
        gameplayHandoff: '玩法衔接备注'
      }
      if (parts[0] === 'levelNodes' && parts[2] === 'opponent' && parts.length >= 4) {
        return `${continentNames[continentId]}大陆-关卡节点${index}-区域对手${fieldLabels[parts[3]] || parts[3]}`
      }
      return `${continentNames[continentId]}大陆-${sectionLabels[parts[0]]}${index}-${fieldLabels[parts[2]] || parts[2]}`
    }
    
    return `${continentNames[continentId]}大陆-${fieldPath}`
  }

  /** 对所有字段做全量快照（在数据加载完成后调用） */
  function snapshotAllFields() {
    for (const cid of ALL_LANDING_CONTINENT_IDS) {
      const continentData = state[cid]
      if (!continentData) continue
      
      if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
      _fieldSnapshots[cid]['systemDialogue.opening'] = continentData.systemDialogue?.opening || ''
      ;(continentData.systemDialogue?.actNodes || []).forEach((dialogue, index) => {
        _fieldSnapshots[cid][`systemDialogue.actNodes.${index}`] = dialogue
      })
      
      // 快照 bosses 数组
      ;(continentData.bosses || []).forEach((boss, index) => {
        for (const [key, val] of Object.entries(boss)) {
          if (typeof val === 'string') {
            if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
            _fieldSnapshots[cid][`bosses.${index}.${key}`] = val
          }
        }
      })
      
      // 快照 levelNodes 数组
      ;(continentData.levelNodes || []).forEach((node, index) => {
        for (const [key, val] of Object.entries(node)) {
          if (typeof val === 'string') {
            if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
            _fieldSnapshots[cid][`levelNodes.${index}.${key}`] = val
          }
        }
        for (const [key, val] of Object.entries(node.opponent || {})) {
          _fieldSnapshots[cid][`levelNodes.${index}.opponent.${key}`] = val
        }
      })
    }
    console.log('[landing] 全量字段快照完成，大陆数:', Object.keys(_fieldSnapshots).length)
  }

  return {
    state,
    overallCompletion,
    getContinentCompletion,
    loadFromStorage,
    loadFromJSON,
    getExportData,
    saveNow,
    resetAll,
    initializeFromServer,
    syncFromServer,
    finalizeField,
    unfinalizeField,
    finalizeModule,
    isFieldFinalized,
    getFieldMeta,
    updateFieldEditMeta
  }
})
