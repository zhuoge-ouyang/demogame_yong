import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { ContinentsState, ContinentId, ContinentAspects } from '@/types/continent'
import { ASPECT_LABELS, STORY_GAMEPLAY_CONTINENT_IDS, getContinentAspectKeys } from '@/types/continent'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultContinentsState } from '@/constants/defaults'
import { useAppStore } from './app'
import { useAuthStore } from './auth'
import { useEditLogsStore } from './edit-logs'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_continents_v1'
const DIRTY_KEY = 'sjg_continents_dirty'  // 标记本地有未同步到服务器的数据

function compactTextLength(value: unknown): number {
  return typeof value === 'string' ? [...value.replace(/\s/g, '')].length : 0
}

const PHASE2_FIELD_MIN_LENGTHS: Partial<Record<keyof ContinentAspects, number>> = {
  mainPlot: 500,
  coreConflict: 140,
  playerGoal: 180,
  experiencePositioning: 180,
  inGameExpression: 300,
  themeExpression: 150,
  playerProgressionChanges: 260
}

const PHASE2_CHAPTER_ALIGNMENT_MARKERS: [ContinentId, keyof ContinentAspects, string][] = [
  ['jin', 'mainPlot', '方舟堡在艾蕾尼娅指引下随奥里克返回金耀大陆'],
  ['jin', 'playerGoal', '回乡侦查与救援'],
  ['mu', 'mainPlot', '方舟堡苏醒章'],
  ['mu', 'playerGoal', '第一次苏醒与外围防御'],
  ['bing', 'mainPlot', '融冰救境'],
  ['bing', 'playerGoal', '孤立守护转为正式同盟'],
  ['huo', 'mainPlot', '不死鸟失控'],
  ['huo', 'playerGoal', '控制不死鸟兽形'],
  ['tu', 'mainPlot', '佩特拉·磐心'],
  ['feng', 'mainPlot', '泽菲尔·逐风'],
  ['lei', 'mainPlot', '托尔加·雷铸'],
  ['guang', 'mainPlot', '卢西恩·晓誓'],
  ['an', 'mainPlot', '诺克丝·影棘']
]

function hasPhase1AlignedOpeningState(data: ContinentsState | null | undefined): boolean {
  if (!data) return false
  return PHASE2_CHAPTER_ALIGNMENT_MARKERS.every(([continentId, field, marker]) => (
    typeof data[continentId]?.aspects?.[field] === 'string'
      && data[continentId].aspects[field].includes(marker)
  ))
}

function countStalePhase2Fields(data: ContinentsState | null | undefined): number {
  if (!data) return 0
  const defaults = defaultContinentsState()
  let staleCount = 0
  for (const id of Object.keys(defaults) as ContinentId[]) {
    const aspects = data[id]?.aspects
    for (const [field, minLength] of Object.entries(PHASE2_FIELD_MIN_LENGTHS)) {
      if (compactTextLength(aspects?.[field as keyof ContinentAspects]) < minLength) {
        staleCount++
      }
    }
  }
  return staleCount
}

function hasThinPhase2Package(data: ContinentsState | null | undefined): boolean {
  if (!data) return false
  const defaults = defaultContinentsState()
  return (Object.keys(defaults) as ContinentId[]).some(id => {
    const aspects = data[id]?.aspects
    const total = (Object.keys(PHASE2_FIELD_MIN_LENGTHS) as (keyof ContinentAspects)[])
      .reduce((sum, field) => sum + compactTextLength(aspects?.[field]), 0)
    return total < 1900
  })
}

function hasCompleteStoryGameplayConcepts(data: ContinentsState | null | undefined): boolean {
  if (!data) return false
  return STORY_GAMEPLAY_CONTINENT_IDS.every(id => (
    compactTextLength(data[id]?.aspects?.storyGameplayConcept) >= 320
  ))
}

function isExpandedPhase2State(data: ContinentsState | null | undefined): boolean {
  return countStalePhase2Fields(data) === 0
    && !hasThinPhase2Package(data)
    && hasCompleteStoryGameplayConcepts(data)
}

function isStalePhase2State(data: ContinentsState | null | undefined): boolean {
  return countStalePhase2Fields(data) >= 9
    || hasThinPhase2Package(data)
    || !hasCompleteStoryGameplayConcepts(data)
}

function latestPhase2EditAt(data: ContinentsState | null | undefined): number {
  if (!data) return 0
  let latest = 0
  const defaults = defaultContinentsState()
  for (const id of Object.keys(defaults) as ContinentId[]) {
    const meta = data[id]?._meta
    if (!meta || typeof meta !== 'object') continue
    for (const value of Object.values(meta)) {
      const editedAt = Number((value as FieldMeta | undefined)?.lastEditedAt)
      if (Number.isFinite(editedAt) && editedAt > latest) latest = editedAt
    }
  }
  return latest
}

function hasNewerPhase2Edits(
  candidate: ContinentsState | null | undefined,
  baseline: ContinentsState | null | undefined
): boolean {
  return latestPhase2EditAt(candidate) > latestPhase2EditAt(baseline)
}

function parseStoredContinents(raw: string | null): ContinentsState | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ContinentsState
  } catch {
    return null
  }
}

export const useContinentsStore = defineStore('continents', () => {
  const state = reactive<ContinentsState>(defaultContinentsState())
  const appStore = useAppStore()

  function getContinentCompletion(id: ContinentId): number {
    const aspects = state[id]?.aspects
    if (!aspects) return 0
    let filled = 0
    const aspectKeys = getContinentAspectKeys(id)
    for (const key of aspectKeys) {
      if (aspects[key].trim()) filled++
    }
    return Math.round((filled / aspectKeys.length) * 100)
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
    if (c.aspects.storyGameplayConcept) parts.push(`【结合剧情的玩法构想】${c.aspects.storyGameplayConcept}`)
    if (c.aspects.themeExpression) parts.push(`【主题表达】${c.aspects.themeExpression}`)
    return parts.join('\n\n')
  }

  function updateAspect(continentId: ContinentId, key: keyof ContinentAspects, value: string) {
    if (state[continentId]) {
      state[continentId].aspects[key] = value
    }
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
      saveData('continents', JSON.parse(data)).then(() => {
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
        const data = JSON.parse(raw) as Partial<ContinentsState>
        const defaults = defaultContinentsState()
        for (const key of Object.keys(defaults) as ContinentId[]) {
          if (data[key]) {
            const src = data[key]!
            Object.assign(state[key], defaults[key], src)
            Object.assign(state[key].aspects, defaults[key].aspects, src.aspects || {})
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

        // ── 关键修复：原地（in-place）更新，不替换嵌套对象引用 ──
        // 原 Object.assign(state[key], defaults[key], src) 会替换 state[key].aspects
        // 若组件提取了 const aspects = state[id].aspects，该引用将失效，UI 不更新
        // 修复：对 aspects/_meta 做原地更新，其余基本类型字段直接覆盖
        Object.assign(state[key].aspects, defaults[key].aspects, (src as any).aspects || {})
        if (!(state[key] as any)._meta) (state[key] as any)._meta = {}
        Object.assign((state[key] as any)._meta, (src as any)._meta || {})
        // 其他基本类型字段直接覆盖
        for (const field of Object.keys(src) as (keyof typeof src)[]) {
          if (field === 'aspects' || field === '_meta') continue
          ;(state[key] as any)[field] = (src as any)[field]
        }
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
  async function saveNow() {
    if (!_initialized) {
      console.warn('[continents.saveNow] 未初始化，跳过保存')
      return
    }
    // 注意：不检查 _syncing，手动保存不应被后台同步阻止
    if (_syncing) {
      console.warn('[continents.saveNow] 后台同步中，但仍强制执行手动保存')
    }
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      localStorage.setItem(DIRTY_KEY, Date.now().toString())  // 标记本地有未同步数据
      const parsed = JSON.parse(data)
      // 异步保存到服务器（等待完成以便后续提交日志）
      const saved = await saveData('continents', parsed)
      if (!saved) {
        throw new Error('服务器保存 continents 失败')
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
                moduleName: 'continents',
                fieldPath: `${continentId}.${fieldPath}`,
                fieldLabel: getFieldLabel(continentId as ContinentId, fieldPath),
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
          console.log(`[continents] 已提交 ${logCount} 条编辑日志`)
        }
      } catch (e) {
        console.warn('[continents] 日志提交失败:', e)
      }
    } catch (e) {
      console.error('立即保存失败:', e)
      throw e  // 重新抛出，让调用者知道保存失败
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
      const dirtyTs = localStorage.getItem(DIRTY_KEY)
      const localRaw = localStorage.getItem(STORAGE_KEY)
      const localData = parseStoredContinents(localRaw)

      if (dirtyTs && localRaw) {
        const shouldPreferServerPhase2 = isExpandedPhase2State(serverData)
          && !hasNewerPhase2Edits(localData, serverData)
          && (isStalePhase2State(localData)
            || (hasPhase1AlignedOpeningState(serverData) && !hasPhase1AlignedOpeningState(localData)))
        if (shouldPreferServerPhase2) {
          console.log('[continents.initializeFromServer] 检测到本地旧版第二阶段缓存，已优先使用服务器定稿版')
          loadFromJSON(serverData as ContinentsState)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
        } else {
          // 本地有未同步的数据，优先使用本地数据
          console.log('[continents.initializeFromServer] 检测到本地未同步数据，优先使用本地缓存')
          loadFromStorage()
          const exportData = getExportData()
          await saveData('continents', exportData)
        }
        localStorage.removeItem(DIRTY_KEY)
      } else if (serverData) {
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
      const serverData = await fetchData<ContinentsState>('continents')
      if (serverData) {
        const localData = getExportData()
        if (hasNewerPhase2Edits(localData, serverData)) {
          console.log('[continents.syncFromServer] 当前本地大陆稿更新，已保留本地并推送到服务器')
          await saveData('continents', localData)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localData))
          localStorage.removeItem(DIRTY_KEY)
          loaded = true
          return loaded
        }
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
        loaded = true
        console.log('[continents.syncFromServer] 已从服务器加载最新数据')
      } else {
        console.warn('[continents.syncFromServer] 服务器未返回数据（可能会话已过期），保持当前状态')
      }
    } catch (e) {
      console.warn('[continents.syncFromServer] 同步失败:', e)
    } finally {
      // 注意：不要在这里调用 snapshotAllFields！
      // 否则会覆盖用户编辑前的快照，导致保存时无法检测差异
      // 超时时间 1200ms > 防抖时间 1000ms，确保 loadFromJSON 触发的防抖保存
      // 在 _syncing 仍为 true 时执行并提前返回，避免触发不必要的服务器保存和脏标记
      setTimeout(() => { _syncing = false }, 1200)
    }
    return loaded
  }

  /** 将指定大陆字段标记为定稿 */
  function finalizeField(continentId: ContinentId, fieldPath: string) {
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
  function unfinalizeField(continentId: ContinentId, fieldPath: string) {
    if (state[continentId]._meta?.[fieldPath]) {
      state[continentId]._meta[fieldPath].status = 'draft'
      state[continentId]._meta[fieldPath].finalizedAt = undefined
      state[continentId]._meta[fieldPath].finalizedBy = undefined
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
    const authStore = useAuthStore()
    if (!state[continentId]._meta) state[continentId]._meta = {}
    const existing = state[continentId]._meta[fieldPath] || createDefaultFieldMeta()

    const updates: Partial<FieldMeta> = {
      ...existing,
      lastEditedAt: Date.now(),
      lastEditSource: source,
      lastEditBy: authStore.username
    }

    if (authStore.username === 'yongge' && !existing.baseContent) {
      const baselineContent = _fieldSnapshots[continentId]?.[fieldPath] ?? getFieldContent(continentId, fieldPath)
      if (baselineContent !== undefined) {
        updates.baseContent = baselineContent
      }
    }

    if (authStore.username === 'ouyang' || authStore.username !== 'yongge') {
      updates.baseContent = undefined
    }

    state[continentId]._meta[fieldPath] = updates as FieldMeta
  }

  /** 根据大陆ID和字段路径获取字段当前值 */
  function getFieldContent(continentId: string, fieldPath: string): string | undefined {
    try {
      const continentData = (state as any)[continentId]
      if (!continentData?.aspects) return undefined
      return continentData.aspects[fieldPath]
    } catch {
      return undefined
    }
  }

  /** 获取字段标签 */
  function getFieldLabel(continentId: ContinentId, fieldPath: string): string {
    const continentNames: Record<ContinentId, string> = {
      jin: '金',
      mu: '木',
      bing: '冰',
      huo: '火',
      tu: '土',
      feng: '风',
      lei: '雷',
      guang: '光',
      an: '暗'
    }
    const aspectLabel = ASPECT_LABELS[fieldPath as keyof typeof ASPECT_LABELS]
    return `${continentNames[continentId]}大陆-${aspectLabel || fieldPath}`
  }

  /** 递归快照对象的所有字符串字段 */
  function snapshotObject(continentId: string, obj: any, prefix: string) {
    if (!obj || typeof obj !== 'object') return
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      const val = obj[key]
      if (typeof val === 'string') {
        if (!_fieldSnapshots[continentId]) _fieldSnapshots[continentId] = {}
        _fieldSnapshots[continentId][path] = val
      } else if (val && typeof val === 'object' && !Array.isArray(val) && key !== '_meta') {
        snapshotObject(continentId, val, path)
      }
    }
  }

  /** 对所有字段做全量快照（在数据加载完成后调用） */
  function snapshotAllFields() {
    const continentIds = Object.keys(state) as ContinentId[]
    for (const cid of continentIds) {
      const continentData = state[cid]
      if (!continentData?.aspects) continue
      for (const key of getContinentAspectKeys(cid)) {
        const val = continentData.aspects[key]
        if (typeof val === 'string') {
          if (!_fieldSnapshots[cid]) _fieldSnapshots[cid] = {}
          _fieldSnapshots[cid][key] = val
        }
      }
    }
    console.log('[continents] 全量字段快照完成，大陆数:', Object.keys(_fieldSnapshots).length)
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
    syncFromServer,
    finalizeField,
    unfinalizeField,
    finalizeModule,
    isFieldFinalized,
    getFieldMeta,
    updateFieldEditMeta
  }
})
