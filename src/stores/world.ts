import { defineStore } from 'pinia'
import { reactive, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { WorldState, WorldTreeSystemData, OpeningBattleData } from '@/types/world'
import type { FieldMeta } from '@/types/content-meta'
import { createDefaultFieldMeta } from '@/types/content-meta'
import { defaultWorldState } from '@/constants/defaults'
import { useAppStore } from './app'
import { useAuthStore } from './auth'
import { useEditLogsStore } from './edit-logs'
import { getFieldLabel } from '@/constants/field-labels'
import { fetchData, saveData } from '@/services/data-api'

const STORAGE_KEY = 'sjg_world_v1'
const DIRTY_KEY = 'sjg_world_dirty'  // 标记本地有未同步到服务器的数据
const JIN_KNIGHT_VISUAL = '金耀骑士团团长，身披狮徽重型骑士板甲与金白披风；狮冠头盔下是冷峻坚毅的面庞，左臂持塔盾，右手握重剑，像一道不可后退的金色城门。'
const SERVER_PROTECTED_WORLD_FIELDS = [
  { moduleName: 'realmStructure', fieldPath: 'summary' },
  { moduleName: 'realmStructure', fieldPath: 'upper.past' },
  { moduleName: 'realmStructure', fieldPath: 'upper.present' },
  { moduleName: 'realmStructure', fieldPath: 'mortal.present' },
  { moduleName: 'realmStructure', fieldPath: 'abyss.present' },
  { moduleName: 'mainStoryline', fieldPath: 'overview' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.0.resolution' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.1.resolution' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.name' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.goal' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.events' },
  { moduleName: 'mainStoryline', fieldPath: 'stages.2.resolution' },
  { moduleName: 'playerIdentity', fieldPath: 'initialPerception' },
  { moduleName: 'playerIdentity', fieldPath: 'revelationArc' },
  { moduleName: 'playerIdentity', fieldPath: 'gameplayIntegration' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.name' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.guidanceStyle' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.dialogueThemes' },
  { moduleName: 'castleGoddess', fieldPath: 'goddess.truthMatrix' },
  { moduleName: 'heroSystem', fieldPath: 'jin.name' },
  { moduleName: 'heroSystem', fieldPath: 'jin.element' },
  { moduleName: 'heroSystem', fieldPath: 'jin.continent' },
  { moduleName: 'heroSystem', fieldPath: 'jin.visual' },
  { moduleName: 'heroSystem', fieldPath: 'jin.personality' },
  { moduleName: 'heroSystem', fieldPath: 'jin.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'jin.role' },
  { moduleName: 'heroSystem', fieldPath: 'jin.joinCondition' },
  { moduleName: 'heroSystem', fieldPath: 'jin.joinStage' },
  { moduleName: 'heroSystem', fieldPath: 'jin.storyRole' },
  { moduleName: 'heroSystem', fieldPath: 'bing.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'huo.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'mu.name' },
  { moduleName: 'heroSystem', fieldPath: 'mu.element' },
  { moduleName: 'heroSystem', fieldPath: 'mu.continent' },
  { moduleName: 'heroSystem', fieldPath: 'mu.visual' },
  { moduleName: 'heroSystem', fieldPath: 'mu.personality' },
  { moduleName: 'heroSystem', fieldPath: 'mu.backstory' },
  { moduleName: 'heroSystem', fieldPath: 'mu.role' },
  { moduleName: 'heroSystem', fieldPath: 'mu.joinCondition' },
  { moduleName: 'heroSystem', fieldPath: 'mu.joinStage' },
  { moduleName: 'heroSystem', fieldPath: 'mu.storyRole' }
] as const

type ProtectedWorldField = (typeof SERVER_PROTECTED_WORLD_FIELDS)[number]

function getFieldEditedAt(data: Partial<WorldState> | null | undefined, moduleName: keyof WorldState['_meta'], fieldPath: string): number {
  const value = data?._meta?.[moduleName]?.[fieldPath]?.lastEditedAt
  return typeof value === 'number' ? value : 0
}

function getNestedString(data: WorldState | null | undefined, moduleName: string, fieldPath: string): string {
  let current: any = (data as any)?.[moduleName]
  for (const part of fieldPath.split('.')) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(part)
        ? current[Number(part)]
        : current.find(item => item?.id === part)
    } else {
      current = current?.[part]
    }
  }
  return typeof current === 'string' ? current : ''
}

function setNestedString(data: WorldState, moduleName: string, fieldPath: string, value: string) {
  let current: any = (data as any)[moduleName] ||= {}
  const parts = fieldPath.split('.')
  for (const part of parts.slice(0, -1)) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(part)
        ? (current[Number(part)] ||= {})
        : current.find(item => item?.id === part)
      if (!current) return
    } else {
      current = current[part] ||= {}
    }
  }
  current[parts[parts.length - 1]] = value
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some(term => value.includes(term))
}

function compactTextLength(value: string): number {
  return [...value.replace(/\s/g, '')].length
}

function numberedEventCount(value: string): number {
  return (value.match(/^\s*\d+\./gm) || []).length
}

function protectedFieldKey(field: ProtectedWorldField): string {
  return `${field.moduleName}.${field.fieldPath}`
}

const LEGACY_FOREST_SPEAKER = '\u68ee\u8bed\u8005'
const ROOT_SPEAKER_FULL_NAME = '根语者（The Root Speaker）'

function hasGuidingGoddessCanon(value: string): boolean {
  return value.includes('艾蕾尼娅')
    && includesAny(value, ['始终', '一直', '从未离开', '永远不会离开'])
    && includesAny(value, ['指导玩家行动', '指导关键行动', '行动建议', '行动方向', '指引'])
}

function isStaleProtectedCanon(field: ProtectedWorldField, value: string): boolean {
  if (!value) return false
  const key = protectedFieldKey(field)

  if (key.startsWith('mainStoryline.stages.0.')) {
    if (includesAny(value, ['金耀大陆', '希尔凡', '希尔瓦拉', LEGACY_FOREST_SPEAKER])) return true
    if (key.endsWith('.name')) return !value.includes('翠森大陆')
    if (key.endsWith('.goal')) return !value.includes('根语者') || !value.includes('方舟堡')
    if (key.endsWith('.events')) {
      return numberedEventCount(value) !== 3
        || compactTextLength(value) > 600
        || !value.includes('根语者')
        || !value.includes('第一波深渊怪物')
        || !value.includes('奥里克·铸金')
        || !value.includes('塞琳娜·霜誓')
        || !value.includes('伊格纳修斯·焚誓')
    }
    if (key.endsWith('.resolution')) return includesAny(value, ['金耀大陆', '希尔凡', LEGACY_FOREST_SPEAKER])
  }

  if (key.startsWith('mainStoryline.stages.1.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return !value.includes('塞琳娜·霜誓') || !includesAny(value, ['巨大环境问题', '领地', '永冻层大片融化', '冰湖倒灌'])
    }
  }

  if (key.startsWith('mainStoryline.stages.2.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return !value.includes('伊格纳修斯·焚誓')
        || !value.includes('不死鸟')
        || !value.includes('失去理智')
        || !includesAny(value, ['伤害自己', '灼伤自己', '烧伤自己'])
        || !includesAny(value, ['身边人', '盟友'])
    }
  }

  if (key.startsWith('playerIdentity.')) {
    return includesAny(value, [LEGACY_FOREST_SPEAKER, '希尔凡', '希尔瓦拉'])
  }

  if (key === 'castleGoddess.goddess.name') return value !== '艾蕾尼娅（Elennia）'
  if (key.startsWith('castleGoddess.goddess.')) {
    return !hasGuidingGoddessCanon(value)
  }

  if (key === 'heroSystem.jin.name') return !value.includes('奥里克·铸金')
  if (key === 'heroSystem.jin.element') return value !== '金'
  if (key === 'heroSystem.jin.continent') return value !== '金耀大陆'
  if (key === 'heroSystem.jin.visual') {
    return !value.includes('骑士')
      || includesAny(value, ['魁梧沉默的铸造师', '铸金铠甲', '金属脉络', '熔金般'])
  }
  if (key.startsWith('heroSystem.jin.')) {
    return includesAny(value, ['魁梧沉默的铸造师', '前锋长', '铸造师的判断'])
  }

  if (key === 'heroSystem.bing.backstory') {
    return !value.includes('叔叔') || !value.includes('弗洛斯特')
  }
  if (key === 'heroSystem.huo.backstory') {
    return !value.includes('毁灭火核') || !value.includes('族人故意')
  }

  if (key === 'heroSystem.mu.name') return value !== ROOT_SPEAKER_FULL_NAME
  if (key === 'heroSystem.mu.element') return value !== '森'
  if (key === 'heroSystem.mu.continent') return value !== '翠森大陆'
  if (key.startsWith('heroSystem.mu.')) {
    return includesAny(value, ['希尔凡', '希尔瓦拉', LEGACY_FOREST_SPEAKER, '翠棘卫队', '木元素'])
  }

  return false
}

function isCurrentProtectedCanon(field: ProtectedWorldField, value: string): boolean {
  if (!value || isStaleProtectedCanon(field, value)) return false
  const key = protectedFieldKey(field)

  if (key.startsWith('mainStoryline.stages.0.')) {
    if (key.endsWith('.name')) return value.includes('翠森大陆')
    if (key.endsWith('.goal')) return value.includes('根语者') && value.includes('方舟堡')
    if (key.endsWith('.events')) {
      return numberedEventCount(value) === 3
        && compactTextLength(value) >= 300
        && compactTextLength(value) <= 500
        && value.includes('第一波深渊怪物')
    }
    return value.includes('方舟堡') || value.includes('根语者')
  }

  if (key.startsWith('mainStoryline.stages.1.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return value.includes('塞琳娜·霜誓') && includesAny(value, ['巨大环境问题', '领地', '永冻层大片融化', '冰湖倒灌'])
    }
    return true
  }

  if (key.startsWith('mainStoryline.stages.2.')) {
    if (key.endsWith('.goal') || key.endsWith('.events')) {
      return value.includes('伊格纳修斯·焚誓')
        && value.includes('不死鸟')
        && value.includes('失去理智')
        && includesAny(value, ['伤害自己', '灼伤自己', '烧伤自己'])
        && includesAny(value, ['身边人', '盟友'])
    }
    return true
  }

  if (key.startsWith('playerIdentity.')) {
    return value.includes('方舟堡') || value.includes('玩家')
  }

  if (key === 'castleGoddess.goddess.name') return value === '艾蕾尼娅（Elennia）'
  if (key.startsWith('castleGoddess.goddess.')) {
    return hasGuidingGoddessCanon(value)
  }

  if (key === 'heroSystem.jin.name') return value.includes('奥里克·铸金')
  if (key === 'heroSystem.jin.element') return value === '金'
  if (key === 'heroSystem.jin.continent') return value === '金耀大陆'
  if (key === 'heroSystem.jin.visual') return value.includes('骑士团团长') && value.includes('骑士板甲')
  if (key.startsWith('heroSystem.jin.')) {
    return value.includes('骑士团团长') || value.includes('金耀骑士团长')
  }

  if (key === 'heroSystem.bing.backstory') {
    return value.includes('塞琳娜·霜誓') && value.includes('叔叔') && value.includes('弗洛斯特')
  }
  if (key === 'heroSystem.huo.backstory') {
    return value.includes('伊格纳修斯·焚誓') && value.includes('毁灭火核') && value.includes('族人故意')
  }

  if (key === 'heroSystem.mu.name') return value === ROOT_SPEAKER_FULL_NAME
  if (key === 'heroSystem.mu.element') return value === '森'
  if (key === 'heroSystem.mu.continent') return value === '翠森大陆'
  if (key.startsWith('heroSystem.mu.')) {
    return includesAny(value, ['根语者', '根系', '根脉', '根须', '方舟堡', '玩家意识'])
  }

  return true
}

function shouldPreferServerField(
  field: ProtectedWorldField,
  localContent: string,
  serverContent: string,
  localEditedAt: number,
  serverEditedAt: number
): boolean {
  if (!serverContent) return false
  if (serverEditedAt > localEditedAt) return true
  return isStaleProtectedCanon(field, localContent) && isCurrentProtectedCanon(field, serverContent)
}

function parseStoredWorldData(raw: string | null): WorldState | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as WorldState
  } catch {
    return null
  }
}

function mergeNewerServerFields(localData: WorldState, serverData: WorldState): string[] {
  const mergedFields: string[] = []
  const localMeta = ((localData as any)._meta ||= {})

  for (const field of SERVER_PROTECTED_WORLD_FIELDS) {
    const serverEditedAt = getFieldEditedAt(serverData, field.moduleName, field.fieldPath)
    const localEditedAt = getFieldEditedAt(localData, field.moduleName, field.fieldPath)
    const serverContent = getNestedString(serverData, field.moduleName, field.fieldPath)
    const localContent = getNestedString(localData, field.moduleName, field.fieldPath)

    if (!shouldPreferServerField(field, localContent, serverContent, localEditedAt, serverEditedAt)) continue

    setNestedString(localData, field.moduleName, field.fieldPath, serverContent)
    localMeta[field.moduleName] ||= {}
    localMeta[field.moduleName][field.fieldPath] = {
      ...localMeta[field.moduleName][field.fieldPath],
      ...serverData._meta?.[field.moduleName]?.[field.fieldPath]
    }
    mergedFields.push(`${field.moduleName}.${field.fieldPath}`)
  }

  return mergedFields
}

function normalizeGoldHeroCanon(data: WorldState) {
  const goldHero = data.heroSystem?.find(hero => hero.id === 'jin')
  if (!goldHero) return
  if (isStaleProtectedCanon({ moduleName: 'heroSystem', fieldPath: 'jin.visual' }, goldHero.visual)) {
    goldHero.visual = JIN_KNIGHT_VISUAL
  }
}

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
  // 同步中禁止自动保存（防止轮询数据触发保存循环）
  let _syncing = false
  // 字段编辑前快照（用于日志记录 oldContent）
  const _fieldSnapshots: Record<string, Record<string, string>> = {}

  // 自动保存（三写：localStorage + world服务器 + world-avatar服务器）
  const debouncedSave = useDebounceFn(() => {
    if (!_initialized) return
    if (_syncing) return
    try {
      const data = JSON.stringify(state)
      // 本地缓存（同步，快速）
      localStorage.setItem(STORAGE_KEY, data)
      localStorage.setItem(DIRTY_KEY, Date.now().toString())  // 标记本地有未同步数据
      // 服务器保存（异步，共享）
      const parsed = JSON.parse(data)
      saveData('world', parsed).then(() => {
        localStorage.removeItem(DIRTY_KEY)  // 服务器保存成功，清除脏标记
      }).catch(err => {
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
        normalizeGoldHeroCanon(data as WorldState)
        Object.assign(state, defaultWorldState(), data)
      }
    } catch (e) {
      console.error('读取失败:', e)
    }
  }

  function loadFromJSON(data: WorldState) {
    try {
      const defaults = defaultWorldState()
      normalizeGoldHeroCanon(data)
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
      // openingBattle 检查（向后兼容：旧数据可能没有此字段）
      if (!data.openingBattle || typeof data.openingBattle !== 'object') {
        ;(data as any).openingBattle = defaults.openingBattle
      }
      // moduleSummaries 检查（向后兼容：旧数据可能没有此字段）
      if (!data.moduleSummaries || typeof data.moduleSummaries !== 'object') {
        ;(data as any).moduleSummaries = defaults.moduleSummaries
      }

      // ── 关键修复：原地（in-place）更新，不替换嵌套对象引用 ──
      // 原来的 Object.assign(state, defaults, data) 会用新对象替换 state.realmStructure、
      // state.mainStoryline 等顶层属性。但组件 setup() 中已提取引用：
      //   const s = worldStore.state.realmStructure
      // 替换后 s 仍指向旧对象，Vue 感知不到变化，UI 不重新渲染。
      // 修复：对每个嵌套对象/数组做原地更新，保留组件持有的引用链仍然有效。

      // realmStructure - 逐层原地更新（保留 state.realmStructure / .upper / .mortal / .abyss 的引用）
      state.realmStructure.summary = data.realmStructure.summary ?? defaults.realmStructure.summary
      for (const rk of ['upper', 'mortal', 'abyss'] as const) {
        Object.assign(state.realmStructure[rk], defaults.realmStructure[rk], data.realmStructure[rk])
      }

      // mainStoryline - overview 直接赋值，stages 数组原地替换内容
      state.mainStoryline.overview = data.mainStoryline.overview ?? defaults.mainStoryline.overview
      state.mainStoryline.stages.splice(0, state.mainStoryline.stages.length, ...data.mainStoryline.stages)

      // playerIdentity - 原地更新（所有字段均为基本类型，Object.assign 安全）
      Object.assign(state.playerIdentity, defaults.playerIdentity, data.playerIdentity)

      // heroSystem - 数组原地替换内容
      state.heroSystem.splice(0, state.heroSystem.length, ...data.heroSystem)

      // castleGoddess - 逐层原地更新
      Object.assign(state.castleGoddess.castle, defaults.castleGoddess.castle, data.castleGoddess.castle)
      Object.assign(state.castleGoddess.goddess, defaults.castleGoddess.goddess, data.castleGoddess.goddess)

      // worldTreeSystem - 原地更新（所有字段均为基本类型）
      Object.assign(state.worldTreeSystem, defaults.worldTreeSystem, data.worldTreeSystem)

      // openingBattle - 只保留当前唯一主版本，避免旧版本字段回流
      for (const key of Object.keys(state.openingBattle)) {
        if (!(key in defaults.openingBattle)) {
          delete (state.openingBattle as any)[key]
        }
      }
      state.openingBattle.sealAbyss = data.openingBattle.sealAbyss ?? defaults.openingBattle.sealAbyss

      // _meta - 原地更新
      Object.assign(state._meta, defaults._meta, data._meta)

      // moduleSummaries - 原地更新
      Object.assign(state.moduleSummaries, defaults.moduleSummaries, data.moduleSummaries)

    } catch (e) {
      console.error('[world.loadFromJSON] 加载失败:', e)
      throw e
    }
  }

  function getExportData(): WorldState {
    return JSON.parse(JSON.stringify(state))
  }

  /** 立即保存（跳过防抖，用于页面隐藏/卸载时） */
  async function saveNow() {
    if (!_initialized) {
      console.warn('[world.saveNow] 未初始化，跳过保存')
      return
    }
    // 注意：不检查 _syncing，手动保存不应被后台同步阻止
    // _syncing 仅用于防止自动保存（debouncedSave）产生循环
    if (_syncing) {
      console.warn('[world.saveNow] 后台同步中，但仍强制执行手动保存')
    }
    try {
      const data = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, data)
      localStorage.setItem(DIRTY_KEY, Date.now().toString())  // 标记本地有未同步数据
      const parsed = JSON.parse(data)
      // 异步保存到服务器（等待完成以便后续提交日志）
      const worldSaved = await saveData('world', parsed)
      if (!worldSaved) {
        throw new Error('服务器保存 world 失败')
      }
      localStorage.removeItem(DIRTY_KEY)  // 服务器保存成功，清除脏标记
      const avatarSaved = await saveData('world-avatar', parsed)
      if (!avatarSaved) {
        console.warn('[world.saveNow] avatar 保存失败，但主数据已保存')
      }
      appStore.updateSaveTimestamp()
      
      // 保存成功后提交日志
      try {
        const editLogsStore = useEditLogsStore()
        const authStore = useAuthStore()
        let logCount = 0
        for (const [modName, fields] of Object.entries(_fieldSnapshots)) {
          for (const [fPath, oldVal] of Object.entries(fields)) {
            const newVal = getFieldContent(modName, fPath)
            if (newVal !== undefined && newVal !== oldVal) {
              await editLogsStore.addLog({
                moduleName: modName,
                fieldPath: fPath,
                fieldLabel: getFieldLabel(modName, fPath),
                oldContent: oldVal,
                newContent: newVal
              })
              logCount++
              // 更新快照为当前值，而不是清空
              _fieldSnapshots[modName][fPath] = newVal
            }
          }
        }
        if (logCount > 0) {
          console.log(`[world] 已提交 ${logCount} 条编辑日志，用户: ${authStore.username}`)
        }
      } catch (e) {
        console.warn('[world] 日志提交失败:', e)
      }
    } catch (e) {
      console.error('立即保存失败:', e)
      throw e  // 重新抛出，让调用者知道保存失败
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
      const dirtyTs = localStorage.getItem(DIRTY_KEY)
      const localRaw = localStorage.getItem(STORAGE_KEY)

      if (dirtyTs && localRaw) {
        // 本地有未同步的数据（可能是上次刷新/关闭时服务器请求未完成）
        // 优先使用本地数据，并立即重新同步到服务器
        const localData = parseStoredWorldData(localRaw)
        const mergedFields = serverData && localData ? mergeNewerServerFields(localData, serverData) : []
        if (localData && mergedFields.length > 0) {
          console.log(`[world.initializeFromServer] 检测到服务器字段更新，已合并到本地未同步数据: ${mergedFields.join(', ')}`)
          loadFromJSON(localData)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localData))
        } else {
          console.log('[world.initializeFromServer] 检测到本地未同步数据，优先使用本地缓存')
          loadFromStorage()
        }
        const exportData = getExportData()
        await saveData('world', exportData)
        await saveData('world-avatar', exportData)
        localStorage.removeItem(DIRTY_KEY)
      } else if (serverData) {
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
      // 数据加载完成后，对所有字段做全量快照（用于后续日志对比）
      snapshotAllFields()
    }
  }

  /** 从服务器同步数据（手动拉取，不触发自动保存） */
  async function syncFromServer(): Promise<boolean> {
    _syncing = true
    let loaded = false
    try {
      const serverData = await fetchData<WorldState>('world')
      if (serverData) {
        loadFromJSON(serverData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData))
        loaded = true
        console.log('[world.syncFromServer] 已从服务器加载最新数据')
      } else {
        console.warn('[world.syncFromServer] 服务器未返回数据（可能会话已过期），保持当前状态')
      }
      // 注意：此处不调用 calibrateBackstoriesFromAvatar！
      // 原因：calibrate 会用旧版 world-avatar.json 覆盖刚从服务器加载的最新数据，
      // 并将回滚后的旧数据写回服务器，导致用户A的保存被覆盖。
      // calibrate 仅在 initializeFromServer（页面初始化）时执行。
    } catch (e) {
      console.warn('[world.syncFromServer] 同步失败:', e)
    } finally {
      // 注意：不要在这里调用 snapshotAllFields！
      // 否则会覆盖用户编辑前的快照，导致保存时无法检测差异
      // 超时时间 1200ms > 防抖时间 1000ms，确保 loadFromJSON 触发的防抖保存
      // 在 _syncing 仍为 true 时执行并提前返回，避免触发不必要的服务器保存和脏标记
      setTimeout(() => { _syncing = false }, 1200)
    }
    return loaded
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
        // 同时更新 world-avatar.json，保持两个文件同步避免下次重复补丁
        await saveData('world-avatar', JSON.parse(data))
        console.log('[backstory-calibrate] 已同步修正后的背景故事到服务器（world + world-avatar）')
      }
    } catch (e) {
      console.warn('[backstory-calibrate] 从 avatar 校准背景故事失败:', e)
    }
  }

  /** 将指定字段标记为定稿 */
  function finalizeField(moduleName: keyof WorldState['_meta'], fieldPath: string) {
    const authStore = useAuthStore()
    if (!state._meta[moduleName]) state._meta[moduleName] = {}
    state._meta[moduleName][fieldPath] = {
      ...(state._meta[moduleName][fieldPath] || createDefaultFieldMeta()),
      status: 'finalized',
      finalizedAt: Date.now(),
      finalizedBy: authStore.username
    }
  }

  /** 解除定稿 */
  function unfinalizeField(moduleName: keyof WorldState['_meta'], fieldPath: string) {
    if (state._meta[moduleName]?.[fieldPath]) {
      state._meta[moduleName][fieldPath].status = 'draft'
      state._meta[moduleName][fieldPath].finalizedAt = undefined
      state._meta[moduleName][fieldPath].finalizedBy = undefined
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

  /** 根据模块名和字段路径获取字段当前值 */
  function getFieldContent(moduleName: string, fieldPath: string): string | undefined {
    try {
      const moduleData = (state as any)[moduleName]
      if (!moduleData) return undefined
      // 处理嵌套路径如 'upper.past'
      const parts = fieldPath.split('.')
      let val: any = moduleData
      for (const part of parts) {
        if (val === undefined || val === null) return undefined
        val = val[part]
      }
      return typeof val === 'string' ? val : undefined
    } catch {
      return undefined
    }
  }

  /** 递归快照对象的所有字符串字段 */
  function snapshotObject(moduleName: string, obj: any, prefix: string) {
    if (!obj || typeof obj !== 'object') return
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      const val = obj[key]
      if (typeof val === 'string') {
        if (!_fieldSnapshots[moduleName]) _fieldSnapshots[moduleName] = {}
        _fieldSnapshots[moduleName][path] = val
      } else if (val && typeof val === 'object' && !Array.isArray(val) && key !== '_meta') {
        snapshotObject(moduleName, val, path)
      } else if (Array.isArray(val)) {
        // 对于数组（如 stages, heroes），递归处理每个元素
        val.forEach((item, index) => {
          if (item && typeof item === 'object') {
            snapshotObject(moduleName, item, `${path}.${index}`)
          }
        })
      }
    }
  }

  /** 对所有字段做全量快照（在数据加载完成后调用） */
  function snapshotAllFields() {
    const modules = ['realmStructure', 'mainStoryline', 'playerIdentity', 'heroSystem', 'castleGoddess', 'worldTreeSystem', 'openingBattle'] as const
    for (const mod of modules) {
      const moduleData = (state as any)[mod]
      if (!moduleData) continue
      snapshotObject(mod, moduleData, '')
    }
    console.log('[world] 全量字段快照完成，模块数:', Object.keys(_fieldSnapshots).length)
  }

  /** 更新字段编辑元数据 */
  function updateFieldEditMeta(moduleName: keyof WorldState['_meta'], fieldPath: string, source: 'user' | 'ai') {
    const authStore = useAuthStore()
    if (!state._meta[moduleName]) state._meta[moduleName] = {}
    const existing = state._meta[moduleName][fieldPath] || createDefaultFieldMeta()

    const updates: Partial<FieldMeta> = {
      ...existing,
      lastEditedAt: Date.now(),
      lastEditSource: source,
      lastEditBy: authStore.username
    }

    // yongge编辑时：如果还没有baseContent，记录编辑前快照作为基准
    if (authStore.username === 'yongge' && !existing.baseContent) {
      const baselineContent = _fieldSnapshots[String(moduleName)]?.[fieldPath] ?? getFieldContent(moduleName, fieldPath)
      if (baselineContent !== undefined) {
        updates.baseContent = baselineContent
      }
    }

    // ouyang编辑时：清除yongge的diff标记
    if (authStore.username === 'ouyang' || authStore.username !== 'yongge') {
      updates.baseContent = undefined
      // lastEditBy 会被设为当前用户，自然覆盖
    }

    state._meta[moduleName][fieldPath] = updates as FieldMeta

    // 注意：快照不再在编辑时记录，而是在数据加载完成后通过 snapshotAllFields 统一记录
    // 这样可以确保快照记录的是旧值，而不是 v-model 更新后的新值
  }

  // ─── 模块审核摘要管理 ─────────────────────────────────────────────

  /** 设置模块审核摘要 */
  function setModuleSummary(moduleId: string, summary: string) {
    state.moduleSummaries[moduleId] = summary
    // 数据变更会自动触发 watch -> debouncedSave 进行持久化
  }

  /** 获取模块审核摘要 */
  function getModuleSummary(moduleId: string): string {
    return state.moduleSummaries[moduleId] || ''
  }

  /** 清除模块审核摘要 */
  function clearModuleSummary(moduleId: string) {
    delete state.moduleSummaries[moduleId]
  }

  /** 获取所有模块审核摘要 */
  function getAllModuleSummaries(): Record<string, string> {
    return { ...state.moduleSummaries }
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
    syncFromServer,
    finalizeField,
    unfinalizeField,
    finalizeModule,
    isFieldFinalized,
    getFieldMeta,
    getFieldContent,
    updateFieldEditMeta,
    setModuleSummary,
    getModuleSummary,
    clearModuleSummary,
    getAllModuleSummaries
  }
})
