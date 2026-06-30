import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { LandingsState, LandingContinentId, BossDesign, LevelNode } from '@/types/landing'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultLandingsState } from '@/constants/defaults'
import { useAppStore } from './app'
import { useAuthStore } from './auth'
import { useEditLogsStore } from './edit-logs'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_landing_v1'
const DIRTY_KEY = 'sjg_landing_dirty'  // 标记本地有未同步到服务器的数据

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
        // ── 关键修复：原地（in-place）更新，不替换嵌套对象/数组引用 ──
        // 原 Object.assign(state[key], defaults[key], src) 会替换 state[key].entryPrompt
        // state[key].completionFeedback、state[key].bosses、state[key].levelNodes 等
        // 若组件提取了这些嵌套引用（如 const c = state[id]），内部引用将失效，UI 不更新
        // 修复：对各嵌套对象/数组做原地更新，其余基本类型字段直接覆盖
        Object.assign(state[key].entryPrompt, defaults[key].entryPrompt, (src as any).entryPrompt || {})
        Object.assign(state[key].completionFeedback, defaults[key].completionFeedback, (src as any).completionFeedback || {})
        state[key].bosses.splice(0, state[key].bosses.length, ...((src as any).bosses || []))
        state[key].levelNodes.splice(0, state[key].levelNodes.length, ...((src as any).levelNodes || []))
        if (!(state[key] as any)._meta) (state[key] as any)._meta = {}
        Object.assign((state[key] as any)._meta, (src as any)._meta || {})
        // 其他基本类型字段直接覆盖
        for (const field of Object.keys(src) as (keyof typeof src)[]) {
          if (['entryPrompt', 'completionFeedback', 'bosses', 'levelNodes', '_meta'].includes(field as string)) continue
          ;(state[key] as any)[field] = (src as any)[field]
        }
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
    if (fieldPath.startsWith('entry.')) return fieldPath.replace(/^entry\./, 'entryPrompt.')
    if (fieldPath.startsWith('completion.')) return fieldPath.replace(/^completion\./, 'completionFeedback.')
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
      bing: '冰',
      huo: '火'
    }
    
    // 解析字段路径
    const parts = fieldPath.split('.')
    
    // 处理 entryPrompt 和 completionFeedback 字段
    if (parts[0] === 'entryPrompt' || parts[0] === 'completionFeedback') {
      const sectionLabels: Record<string, string> = {
        entryPrompt: '进入提示',
        completionFeedback: '通关反馈'
      }
      const fieldLabels: Record<string, string> = {
        narrative: '叙事',
        npcDialogue: 'NPC对话',
        atmosphere: '氛围',
        rewardStory: '奖励故事',
        transitionText: '过渡文本'
      }
      return `${continentNames[continentId]}大陆-${sectionLabels[parts[0]]}-${fieldLabels[parts[1]] || parts[1]}`
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
        openingScene: '开场设计',
        storyConnection: '故事关联',
        storyBeat: '故事节拍',
        keyEncounter: '关键遭遇',
        narrativeReward: '叙事奖励'
      }
      return `${continentNames[continentId]}大陆-${sectionLabels[parts[0]]}${index}-${fieldLabels[parts[2]] || parts[2]}`
    }
    
    return `${continentNames[continentId]}大陆-${fieldPath}`
  }

  /** 对所有字段做全量快照（在数据加载完成后调用） */
  function snapshotAllFields() {
    const continentIds: LandingContinentId[] = ['jin', 'bing', 'huo']
    for (const cid of continentIds) {
      const continentData = state[cid]
      if (!continentData) continue
      
      // 快照 entryPrompt 字段
      for (const key of Object.keys(continentData.entryPrompt)) {
        const val = (continentData.entryPrompt as any)[key]
        if (typeof val === 'string') {
          if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
          _fieldSnapshots[cid][`entryPrompt.${key}`] = val
        }
      }
      
      // 快照 completionFeedback 字段
      for (const key of Object.keys(continentData.completionFeedback)) {
        const val = (continentData.completionFeedback as any)[key]
        if (typeof val === 'string') {
          if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
          _fieldSnapshots[cid][`completionFeedback.${key}`] = val
        }
      }
      
      // 快照 bosses 数组
      continentData.bosses.forEach((boss, index) => {
        for (const [key, val] of Object.entries(boss)) {
          if (typeof val === 'string') {
            if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
            _fieldSnapshots[cid][`bosses.${index}.${key}`] = val
          }
        }
      })
      
      // 快照 levelNodes 数组
      continentData.levelNodes.forEach((node, index) => {
        for (const [key, val] of Object.entries(node)) {
          if (typeof val === 'string') {
            if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
            _fieldSnapshots[cid][`levelNodes.${index}.${key}`] = val
          }
        }
      })
    }
    console.log('[landing] 全量字段快照完成，大陆数:', Object.keys(_fieldSnapshots).length)
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
    syncFromServer,
    finalizeField,
    unfinalizeField,
    finalizeModule,
    isFieldFinalized,
    getFieldMeta,
    updateFieldEditMeta
  }
})
