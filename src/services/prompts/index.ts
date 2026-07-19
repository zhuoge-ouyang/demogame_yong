import { getSystemPrompt, getLayeredSystemPrompt } from './system-prompt'
import { phase1Prompts } from './phase1-prompts'
import { getPhase2Prompt } from './phase2-prompts'
import { getPhase3Prompt } from './phase3-prompts'
import { getOpeningBattlePrompt } from './opening-battle-prompts'
import type { PromptTemplate, PromptBuildOptions, PromptBuildResult } from '@/types/ai'
import { ASPECT_KEYS, ASPECT_LABELS, type ContinentId, type ContinentAspects } from '@/types/continent'
import type { LandingContinentId } from '@/types/landing'
import { CONTINENT_MAP } from '@/constants/continents'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { getOptimizedPromptOrNull } from '../prompt-optimizer'
import { estimateTokenCount, getContextLimit } from '../token-counter'
import { getModuleCategory, getCategoryContextConfig, type ModuleCategory } from './module-categories'
import { getStaticInjectionContent, getStaticInjectionLabel } from './core-gameplay-rules'

/**
 * 根据 template.staticInjections 构造静态规则注入块数组
 * 返回每个块为 `=== <label> ===\n<content>` 格式
 */
function buildStaticInjectionBlocks(template: PromptTemplate): string[] {
  const blocks: string[] = []
  if (!template.staticInjections || template.staticInjections.length === 0) {
    return blocks
  }
  for (const key of template.staticInjections) {
    const content = getStaticInjectionContent(key)
    if (content) {
      const label = getStaticInjectionLabel(key)
      blocks.push(`=== ${label} ===\n${content}`)
    }
  }
  return blocks
}

export function getPromptTemplate(moduleId: string): PromptTemplate | null {
  // Phase 1
  if (phase1Prompts[moduleId]) return phase1Prompts[moduleId]
  // Phase 2: format "phase2-{continentId}-{aspectKey}"
  const p2Match = moduleId.match(/^phase2-(\w+)-(\w+)$/)
  if (p2Match) {
    return getPhase2Prompt(p2Match[1] as ContinentId, p2Match[2] as keyof ContinentAspects)
  }
  // Opening Battle: format "opening-battle-{versionId}"
  const obMatch = moduleId.match(/^opening-battle-(.+)$/)
  if (obMatch) {
    return getOpeningBattlePrompt(moduleId)
  }
  // Phase 3: format "phase3-{continentId}-{moduleKey}"
  const p3Match = moduleId.match(/^phase3-(\w+)-(.+)$/)
  if (p3Match) {
    return getPhase3Prompt(p3Match[1] as LandingContinentId, p3Match[2] as any)
  }
  return null
}

/**
 * 从自定义/优化后的完整prompt中提取userPromptTemplate部分
 * 存储格式: 【任务】xxx

{userPromptTemplate}

【输出格式要求】xxx
 */
function extractUserPromptFromStored(storedPrompt: string): string {
  const taskEnd = storedPrompt.indexOf('\n\n')
  if (taskEnd === -1) return storedPrompt
  const formatStart = storedPrompt.indexOf('\n\n【输出格式要求】')
  if (formatStart === -1) return storedPrompt.slice(taskEnd + 2)
  return storedPrompt.slice(taskEnd + 2, formatStart)
}

/**
 * 获取带有优化覆盖的提示词模板
 * 如果存在优化后的提示词，则使用优化版本
 */
function getPromptTemplateWithOptimization(moduleId: string): PromptTemplate | null {
  const originalTemplate = getPromptTemplate(moduleId)
  if (!originalTemplate) return null

  // 检查是否有优化后的提示词
  const optimizedPrompt = getOptimizedPromptOrNull(moduleId)
  if (optimizedPrompt) {
    // 如果有优化提示词，提取userPromptTemplate部分并替换
    return {
      ...originalTemplate,
      userPromptTemplate: extractUserPromptFromStored(optimizedPrompt)
    }
  }

  return originalTemplate
}

/**
 * 收集上下文数据，返回定稿和草稿部分
 * @deprecated 请使用 collectSummaryContext() 替代，此函数保留以备回退
 */
function collectContext(template: PromptTemplate): { finalizedParts: string[]; draftParts: string[] } {
  const finalizedParts: string[] = []
  const draftParts: string[] = []

  try {
    const worldStore = useWorldStore()
    const continentsStore = useContinentsStore()

    function pushContextByMeta(label: string, content: string, isFinalized: boolean) {
      const block = `=== 已有设定：${label} ===\n${content}`
      if (isFinalized) {
        finalizedParts.push(block)
      } else {
        draftParts.push(block)
      }
    }

    function hasAnyFinalized(moduleName: string, fieldPaths: string[]): boolean {
      for (const fp of fieldPaths) {
        if (worldStore.isFieldFinalized(moduleName as any, fp)) return true
      }
      return false
    }

    for (const dep of template.contextDependencies) {
      if (dep === 'realm-structure' && worldStore.state.realmStructure.summary) {
        const content = worldStore.realmSummaryText
        const finalized = hasAnyFinalized('realmStructure', ['summary', 'upper.past', 'upper.present', 'upper.future', 'mortal.past', 'mortal.present', 'mortal.future', 'abyss.past', 'abyss.present', 'abyss.future'])
        pushContextByMeta('三界结构', content, finalized)
      }
      if (dep === 'main-storyline' && worldStore.state.mainStoryline.overview) {
        const finalized = worldStore.isFieldFinalized('mainStoryline', 'overview')
        pushContextByMeta('主线剧情', worldStore.state.mainStoryline.overview, finalized)
      }
      if (dep === 'player-identity' && worldStore.state.playerIdentity.origin) {
        const finalized = worldStore.isFieldFinalized('playerIdentity', 'origin')
        pushContextByMeta('玩家身份', worldStore.state.playerIdentity.origin, finalized)
      }
      if (dep === 'hero-system') {
        const heroes = worldStore.state.heroSystem.filter(h => h.name.trim())
        if (heroes.length > 0) {
          const heroText = heroes.map(h => `- ${h.name}（${h.element}·${h.continent}）：${h.backstory}`).join('\n')
          const finalized = hasAnyFinalized('heroSystem', heroes.map(h => `${h.id}.name`))
          pushContextByMeta('英雄', heroText, finalized)
        }
      }
      if (dep === 'world-tree-system') {
        const wt = worldStore.state.worldTreeSystem
        const wtParts: string[] = []
        if (wt.growthMechanism) wtParts.push(`成长机制：${wt.growthMechanism}`)
        if (wt.resourceContribution) wtParts.push(`资源贡献：${wt.resourceContribution}`)
        if (wt.unlockedFeatures) wtParts.push(`解锁功能：${wt.unlockedFeatures}`)
        if (wt.fourthForce) wtParts.push(`第四势力：${wt.fourthForce}`)
        if (wt.runeConnection) wtParts.push(`符文关联：${wt.runeConnection}`)
        if (wtParts.length > 0) {
          const finalized = hasAnyFinalized('worldTreeSystem', ['growthMechanism', 'resourceContribution', 'unlockedFeatures', 'fourthForce', 'runeConnection'])
          pushContextByMeta('世界树系统', wtParts.join('\n'), finalized)
        }
      }
      if (dep === 'phase1-summary') {
        if (worldStore.realmSummaryText) {
          const finalized = hasAnyFinalized('realmStructure', ['summary'])
          pushContextByMeta('世界观基础（阶段一摘要）', worldStore.realmSummaryText, finalized)
        }
      }
      // 大陆相关上下文
      const continentMatch = dep.match(/^phase2-(\w+)-(prior|all)$/)
      if (continentMatch) {
        const cId = continentMatch[1] as ContinentId
        const summary = continentsStore.getContinentSummary(cId)
        if (summary) {
          const aspectKeys = ['mainPlot', 'coreConflict', 'playerGoal', 'experiencePositioning', 'inGameExpression', 'themeExpression', 'playerProgressionChanges']
          let finalized = false
          for (const ak of aspectKeys) {
            if (continentsStore.isFieldFinalized(cId, ak)) { finalized = true; break }
          }
          pushContextByMeta(`${cId}大陆`, summary, finalized)
        }
      }
    }
  } catch {
    // stores may not be available in some contexts
  }

  return { finalizedParts, draftParts }
}

/**
 * 智能裁剪上下文：当Token超过限制的80%时触发
 * 策略：对非核心上下文截断保留前500字
 * @deprecated 新流程使用摘要模式，此函数保留以备回退
 */
function trimContextParts(parts: string[], maxTotalChars: number): { trimmed: string[]; wasTrimmed: boolean } {
  let totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  if (totalLen <= maxTotalChars) return { trimmed: parts, wasTrimmed: false }

  const trimmed = parts.map((part, i) => {
    // 优先保留第一个（通常是最核心的上下文）
    if (i === 0) return part
    if (part.length > 500 && totalLen > maxTotalChars) {
      const cut = part.slice(0, 500) + '\n...（已省略详细内容）'
      totalLen -= (part.length - cut.length)
      return cut
    }
    return part
  })
  return { trimmed, wasTrimmed: true }
}

// ─── 结构化裁剪上下文（新实现）─────────────────────────────────────────────

/** 上下文部分结构 */
export interface ContextPart {
  content: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  label: string        // 上下文来源标签
  tokens: number       // 预估 Token 数
}

/**
 * 按 Markdown 段落结构裁剪文本
 * 优先保留标题行和首段，删除后续段落
 * @param text - 要裁剪的文本
 * @param maxChars - 最大字符数
 * @returns 裁剪后的文本
 */
export function trimByParagraphs(text: string, maxChars: number): string {
  // 如果文本已经在限制内，直接返回
  if (text.length <= maxChars) {
    return text
  }

  // 按段落分割（支持 \n\n 或 \n# 开头的标题）
  const paragraphs = text.split(/\n\n|\n(?=#)/)
  
  if (paragraphs.length === 0) {
    // 无法分割，直接截断
    return text.slice(0, maxChars) + '...'
  }

  // 保留第一个段落（通常是标题/概述）
  const result: string[] = [paragraphs[0]]
  let currentLength = paragraphs[0].length
  let omittedCount = 0

  // 逐步添加后续段落
  for (let i = 1; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    // 预留空间给省略提示
    const reserveSpace = 30
    
    if (currentLength + para.length + 2 + reserveSpace <= maxChars) {
      result.push(para)
      currentLength += para.length + 2 // +2 for \n\n
    } else {
      // 无法完整添加此段落，检查是否可以部分添加
      const remainingSpace = maxChars - currentLength - reserveSpace
      if (remainingSpace > 50 && !para.startsWith('#')) {
        // 对于非标题段落，可以尝试部分添加
        result.push(para.slice(0, remainingSpace) + '...')
        currentLength += remainingSpace + 2
      }
      omittedCount = paragraphs.length - i
      break
    }
  }

  // 如果有被省略的段落，添加提示
  if (omittedCount > 0) {
    result.push(`\n...（已省略 ${omittedCount} 个段落的详细内容）`)
  }

  return result.join('\n\n')
}

/**
 * 结构化裁剪上下文
 * 按优先级从低到高裁剪，每个部分按 Markdown 段落裁剪而非字符截断
 * @param parts - 上下文部分数组
 * @param maxTotalTokens - 最大总 Token 数
 * @returns 裁剪后的结果
 */
export function trimContextStructured(
  parts: ContextPart[],
  maxTotalTokens: number
): { trimmed: ContextPart[]; wasTrimmed: boolean } {
  // 计算总 Token 数
  const totalTokens = parts.reduce((sum, p) => sum + p.tokens, 0)
  
  // 如果总 Token 数在限制内，直接返回
  if (totalTokens <= maxTotalTokens) {
    return { trimmed: parts, wasTrimmed: false }
  }

  // 按优先级排序：low -> medium -> high -> critical
  const priorityOrder: Record<ContextPart['priority'], number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3
  }

  // 创建副本以避免修改原始数组
  const trimmed: ContextPart[] = parts.map(p => ({ ...p }))
  let currentTotalTokens = totalTokens

  // 按优先级从低到高裁剪
  for (const priority of ['low', 'medium', 'high'] as const) {
    if (currentTotalTokens <= maxTotalTokens) {
      break
    }

    for (const part of trimmed) {
      if (part.priority !== priority) continue
      if (currentTotalTokens <= maxTotalTokens) break

      let maxChars: number
      switch (priority) {
        case 'low':
          // low 优先级：完全移除
          currentTotalTokens -= part.tokens
          part.content = `=== ${part.label} ===\n（已省略低优先级上下文）`
          part.tokens = estimateTokenCount(part.content)
          currentTotalTokens += part.tokens
          continue
        case 'medium':
          maxChars = 200
          break
        case 'high':
          maxChars = 400
          break
        default:
          continue
      }

      // 按段落裁剪
      const originalContent = part.content
      const trimmedContent = trimByParagraphs(originalContent, maxChars)
      
      if (trimmedContent !== originalContent) {
        part.content = trimmedContent
        const newTokens = estimateTokenCount(trimmedContent)
        currentTotalTokens = currentTotalTokens - part.tokens + newTokens
        part.tokens = newTokens
      }
    }
  }

  return { trimmed, wasTrimmed: true }
}

// ─── 摘要模式上下文收集（新实现）─────────────────────────────────────────────

/**
 * 类别标签映射
 */
const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  setting: '三界结构',
  worldview: '世界树系统',
  storyline: '主线剧情',
  character: '角色设定'
}

/** 子模块ID → store数据字段映射（用于子模块级上下文提取） */
const SUB_MODULE_FIELD_MAP: Record<string, { storeKey: string; fields: string[]; label: string }> = {
  'realm-overview': { storeKey: 'realmStructure', fields: ['summary'], label: '三界概述' },
  'realm-upper': { storeKey: 'realmStructure', fields: ['upper.past', 'upper.present', 'upper.future'], label: '上界·神殿' },
  'realm-mortal': { storeKey: 'realmStructure', fields: ['mortal.past', 'mortal.present', 'mortal.future'], label: '凡界' },
  'realm-abyss': { storeKey: 'realmStructure', fields: ['abyss.past', 'abyss.present', 'abyss.future'], label: '深渊' }
}

/**
 * 从 store 中提取指定模块类别的精简摘要
 * @param sourceCategory - 来源模块类别
 * @param maxChars - 最大字符数
 * @returns 精简摘要文本
 */
function extractModuleSummary(sourceCategory: ModuleCategory, maxChars: number): string {
  const worldStore = useWorldStore()
  const continentsStore = useContinentsStore()

  let summary = ''
  let label = CATEGORY_LABELS[sourceCategory]

  // 1. 检查是否有该类别的 approvedSummary（moduleSummaries[category]）
  // 注意：当前 store 中可能没有 moduleSummaries，预留扩展
  const approvedSummary = (worldStore.state as any).moduleSummaries?.[sourceCategory]
  if (approvedSummary) {
    summary = approvedSummary
  } else {
    // 2. 根据类别从原始数据中自动提取
    switch (sourceCategory) {
      case 'setting': {
        // 从 realmStructure 提取三界结构摘要
        const rs = worldStore.state.realmStructure
        const parts: string[] = []
        if (rs.summary) {
          parts.push(rs.summary)
        } else {
          // 从各子字段提取要点
          const realmNames = { upper: '上界/神殿', mortal: '凡界', abyss: '深渊' } as const
          for (const [key, name] of Object.entries(realmNames)) {
            const r = rs[key as keyof typeof realmNames]
            if (r.present) parts.push(`【${name}·现状】${r.present}`)
          }
        }
        summary = parts.join('\n')
        break
      }

      case 'worldview': {
        // 从 worldTreeSystem 提取世界树系统要点
        const wt = worldStore.state.worldTreeSystem
        const parts: string[] = []
        if (wt.growthMechanism) parts.push(`成长机制：${wt.growthMechanism}`)
        if (wt.resourceContribution) parts.push(`资源贡献：${wt.resourceContribution}`)
        if (wt.unlockedFeatures) parts.push(`解锁功能：${wt.unlockedFeatures}`)
        if (wt.fourthForce) parts.push(`第四势力：${wt.fourthForce}`)
        if (wt.runeConnection) parts.push(`符文关联：${wt.runeConnection}`)
        summary = parts.join('\n')
        break
      }

      case 'storyline': {
        // 从 mainStoryline 提取剧情主线要点
        const ms = worldStore.state.mainStoryline
        if (ms.overview) {
          summary = ms.overview
        } else {
          // 从 stages 提取
          const parts = ms.stages
            .filter(s => s.goal || s.events)
            .map(s => `【${s.name}】${s.goal}${s.events ? '；' + s.events : ''}`)
          summary = parts.join('\n')
        }
        break
      }

      case 'character': {
        // 从 playerIdentity 和 heroSystem 提取角色要点
        const parts: string[] = []
        const pi = worldStore.state.playerIdentity
        if (pi.origin) parts.push(`【玩家身份】${pi.origin}`)
        
        const heroes = worldStore.state.heroSystem.filter(h => h.name.trim())
        if (heroes.length > 0) {
          parts.push('【英雄】' + heroes.map(h => `${h.name}（${h.element}）`).join('、'))
        }
        summary = parts.join('\n')
        break
      }
    }
  }

  // 3. 截断到 maxChars
  if (summary.length > maxChars) {
    summary = summary.slice(0, maxChars) + '...'
  }

  // 4. 返回格式化结果
  return `=== 已有设定：${label} ===\n${summary}`
}

/**
 * 根据模块类别收集精简摘要上下文
 * @param template - 当前模块的 Prompt 模板
 * @returns 与原 collectContext 相同格式的结果
 */
function collectSummaryContext(template: PromptTemplate): { finalizedParts: string[]; draftParts: string[] } {
  const finalizedParts: string[] = []
  const draftParts: string[] = []

  try {
    const worldStore = useWorldStore()
    const category = getModuleCategory(template.templateId)
    const config = getCategoryContextConfig(category)
    const contextNeeds = template.templateId.startsWith('phase2-')
      ? config.contextNeeds.filter(need => need.sourceCategory !== 'worldview')
      : config.contextNeeds

    // 遍历该类别的上下文需求
    for (const need of contextNeeds) {
      const { sourceCategory, maxSummaryChars } = need
      
      // 提取摘要
      const summary = extractModuleSummary(sourceCategory, maxSummaryChars)
      
      // 判断来源数据的定稿状态
      const isFinalized = checkCategoryFinalized(sourceCategory, worldStore)
      
      if (isFinalized) {
        finalizedParts.push(summary)
      } else {
        draftParts.push(summary)
      }
    }
  } catch {
    // stores may not be available in some contexts
  }

  return { finalizedParts, draftParts }
}

/**
 * 检查某个类别的数据是否已定稿
 */
function checkCategoryFinalized(category: ModuleCategory, worldStore: ReturnType<typeof useWorldStore>): boolean {
  switch (category) {
    case 'setting': {
      // 检查 realmStructure 的关键字段是否定稿
      return worldStore.isFieldFinalized('realmStructure', 'summary') ||
             worldStore.isFieldFinalized('realmStructure', 'upper.present') ||
             worldStore.isFieldFinalized('realmStructure', 'mortal.present') ||
             worldStore.isFieldFinalized('realmStructure', 'abyss.present')
    }
    case 'worldview': {
      return worldStore.isFieldFinalized('worldTreeSystem', 'growthMechanism') ||
             worldStore.isFieldFinalized('worldTreeSystem', 'resourceContribution')
    }
    case 'storyline': {
      return worldStore.isFieldFinalized('mainStoryline', 'overview')
    }
    case 'character': {
      return worldStore.isFieldFinalized('playerIdentity', 'origin') ||
             worldStore.isFieldFinalized('heroSystem', '0.name')
    }
    default:
      return false
  }
}

function pushResolvedContext(
  finalizedParts: string[],
  draftParts: string[],
  label: string,
  content: string,
  finalized: boolean
) {
  const trimmedContent = content.trim()
  if (!trimmedContent) return

  const block = `=== ${label}（已有内容） ===\n${trimmedContent}`
  if (finalized) finalizedParts.push(block)
  else draftParts.push(block)
}

function collectPhase1SummaryContext(): { label: string; content: string; finalized: boolean } | null {
  const worldStore = useWorldStore()
  const parts: string[] = []

  if (worldStore.realmSummaryText?.trim()) {
    parts.push(`【三界结构】\n${worldStore.realmSummaryText.trim()}`)
  }

  const storyline = worldStore.state.mainStoryline
  if (storyline.overview?.trim()) {
    parts.push(`【前三章主线】\n${storyline.overview.trim()}`)
  } else {
    const stageText = storyline.stages
      .filter(stage => stage.name?.trim() || stage.goal?.trim() || stage.events?.trim())
      .map(stage => `【${stage.name || '未命名章节'}】\n${[stage.goal, stage.events, stage.resolution].filter(Boolean).join('\n')}`)
      .join('\n\n')
    if (stageText.trim()) parts.push(`【前三章主线】\n${stageText}`)
  }

  const identity = worldStore.state.playerIdentity
  if (identity.initialPerception?.trim()) {
    parts.push(`【玩家身份】\n${identity.initialPerception.trim()}`)
  }

  const heroes = worldStore.state.heroSystem.filter(hero => hero.name?.trim())
  if (heroes.length > 0) {
    parts.push('【英雄设定】\n' + heroes
      .map(hero => `- ${hero.name}（${hero.element}·${hero.continent}）：${hero.backstory || hero.role || ''}`)
      .join('\n'))
  }

  const content = parts.join('\n\n')
  if (!content.trim()) return null

  const finalized = worldStore.isFieldFinalized('mainStoryline', 'overview')
    || worldStore.isFieldFinalized('playerIdentity', 'initialPerception')
    || worldStore.isFieldFinalized('realmStructure', 'summary')

  return { label: '阶段一摘要', content, finalized }
}

function getPhase2AspectFromTemplate(template: PromptTemplate): keyof ContinentAspects | undefined {
  const match = template.templateId.match(/^phase2-\w+-(\w+)$/)
  return match?.[1] as keyof ContinentAspects | undefined
}

function collectPhase2PriorContext(continentId: ContinentId, template: PromptTemplate): { label: string; content: string; finalized: boolean } | null {
  const continentsStore = useContinentsStore()
  const continent = continentsStore.state[continentId]
  if (!continent?.aspects) return null

  const currentAspect = getPhase2AspectFromTemplate(template)
  const currentIndex = currentAspect ? ASPECT_KEYS.indexOf(currentAspect) : -1
  const priorKeys = currentIndex > 0 ? ASPECT_KEYS.slice(0, currentIndex) : []
  const keysToRead = priorKeys.length > 0 ? priorKeys : ASPECT_KEYS.filter(key => continent.aspects[key]?.trim())

  const content = keysToRead
    .filter(key => continent.aspects[key]?.trim())
    .map(key => `【${ASPECT_LABELS[key]}】\n${continent.aspects[key].trim()}`)
    .join('\n\n')

  if (!content.trim()) return null

  const finalized = keysToRead.length > 0 && keysToRead.every(key => continentsStore.isFieldFinalized(continentId, key))
  return { label: `${continent.name || CONTINENT_MAP[continentId]?.name || continentId} · 前序内容`, content, finalized }
}

function collectPhase2AllContext(continentId: ContinentId): { label: string; content: string; finalized: boolean } | null {
  const continentsStore = useContinentsStore()
  const continent = continentsStore.state[continentId]
  if (!continent?.aspects) return null

  const filledKeys = ASPECT_KEYS.filter(key => continent.aspects[key]?.trim())
  const content = filledKeys
    .map(key => `【${ASPECT_LABELS[key]}】\n${continent.aspects[key].trim()}`)
    .join('\n\n')

  if (!content.trim()) return null

  const finalized = filledKeys.length > 0 && filledKeys.every(key => continentsStore.isFieldFinalized(continentId, key))
  return { label: `${continent.name || CONTINENT_MAP[continentId]?.name || continentId} · 阶段二完整设计`, content, finalized }
}

function collectPhase3ModuleContext(continentId: LandingContinentId, moduleKey: string): { label: string; content: string; finalized: boolean } | null {
  const landingStore = useLandingStore()
  const data = landingStore.state[continentId]
  if (!data) return null

  let label = `${CONTINENT_MAP[continentId]?.name || continentId} · 阶段三内容`
  let content = ''
  let fieldPaths: string[] = []

  if (moduleKey === 'system-dialogue') {
    label = `${CONTINENT_MAP[continentId]?.name || continentId} · 系统对白`
    content = [
      `【开场对白】\n${data.systemDialogue.opening || ''}`,
      ...data.systemDialogue.actNodes.map((dialogue, index) => `【第${index + 1}幕节点】\n${dialogue || ''}`)
    ].filter(block => block.replace(/【.*?】/g, '').trim()).join('\n\n')
    fieldPaths = ['systemDialogue.opening', ...data.systemDialogue.actNodes.map((_, index) => `systemDialogue.actNodes.${index}`)]
  } else if (moduleKey === 'boss-design') {
    label = `${CONTINENT_MAP[continentId]?.name || continentId} · Boss设计`
    content = data.bosses
      .filter(boss => [boss.name, boss.identity, boss.motivation, boss.signatureLine].some(value => value.trim()))
      .map((boss, index) => [
        `【Boss${index + 1}·第${boss.areaIndex}区域】`,
        `名字：${boss.name || ''}`,
        `身份：${boss.identity || ''}`,
        `动机：${boss.motivation || ''}`,
        `一句话台词：${boss.signatureLine || ''}`
      ].join('\n'))
      .join('\n\n')
  } else if (moduleKey === 'region-copy') {
    label = `${CONTINENT_MAP[continentId]?.name || continentId} · 九区域文案`
    content = data.levelNodes
      .filter(node => [
        node.storyPurpose,
        node.storyContent,
        node.entryPrompt,
        node.completionFeedback,
        node.narrativeReward,
        node.opponent.name,
        node.opponent.identity,
        node.opponent.motivation,
        node.opponent.signatureLine
      ].some(value => value.trim()))
      .map((node, index) => {
        const lines = [
          `【区域${index + 1}】`,
          `名称：${node.name || ''}`,
          `叙事任务：${node.storyPurpose || ''}`,
          `区域故事：${node.storyContent || ''}`,
          `进入前提示：${node.entryPrompt || ''}`,
          `结束后反馈：${node.completionFeedback || ''}`,
          `叙事线索：${node.narrativeReward || ''}`
        ]
        if ((index + 1) % 3 !== 0) {
          lines.push(
            `区域对手名字：${node.opponent.name || ''}`,
            `区域对手身份：${node.opponent.identity || ''}`,
            `区域对手动机：${node.opponent.motivation || ''}`,
            `区域对手台词：${node.opponent.signatureLine || ''}`
          )
        }
        return lines.join('\n')
      })
      .join('\n\n')
    fieldPaths = data.levelNodes.flatMap((_, index) => [
      `levelNodes.${index}.storyPurpose`,
      `levelNodes.${index}.storyContent`,
      `levelNodes.${index}.entryPrompt`,
      `levelNodes.${index}.completionFeedback`,
      `levelNodes.${index}.narrativeReward`,
      ...((index + 1) % 3 !== 0
        ? [
            `levelNodes.${index}.opponent.name`,
            `levelNodes.${index}.opponent.identity`,
            `levelNodes.${index}.opponent.motivation`,
            `levelNodes.${index}.opponent.signatureLine`
          ]
        : [])
    ])
  }

  if (!content.trim()) return null

  const finalized = fieldPaths.length > 0 && fieldPaths.every(fieldPath => landingStore.isFieldFinalized(continentId, fieldPath))
  return { label, content, finalized }
}

function resolvePromptDependencyContext(depModuleId: string, template: PromptTemplate): { label: string; content: string; finalized: boolean } | null {
  if (depModuleId === 'phase1-summary') {
    return collectPhase1SummaryContext()
  }

  const phase2Match = depModuleId.match(/^phase2-(\w+)-(prior|all)$/)
  if (phase2Match) {
    const continentId = phase2Match[1] as ContinentId
    return phase2Match[2] === 'prior'
      ? collectPhase2PriorContext(continentId, template)
      : collectPhase2AllContext(continentId)
  }

  const phase3Match = depModuleId.match(/^phase3-(\w+)-(.+)$/)
  if (phase3Match) {
    return collectPhase3ModuleContext(phase3Match[1] as LandingContinentId, phase3Match[2])
  }

  return null
}

/**
 * 子模块级上下文收集
 * 根据 template.contextDependencies 中的子模块ID，从 store 提取对应数据
 * 区分定稿/草稿内容，并注入参考文档
 */
function collectModuleContext(template: PromptTemplate): {
  finalizedParts: string[]
  draftParts: string[]
  referenceParts: string[]
} {
  const finalizedParts: string[] = []
  const draftParts: string[] = []
  const referenceParts: string[] = []

  try {
    const worldStore = useWorldStore()

    // 1. 遍历 contextDependencies 中的子模块ID
    for (const depModuleId of template.contextDependencies) {
      const mapping = SUB_MODULE_FIELD_MAP[depModuleId]
      if (!mapping) {
        const resolved = resolvePromptDependencyContext(depModuleId, template)
        if (resolved) {
          pushResolvedContext(finalizedParts, draftParts, resolved.label, resolved.content, resolved.finalized)
          continue
        }

        // 非子模块依赖：使用回退逻辑提取对应 store 数据
        switch (depModuleId) {
          case 'main-storyline': {
            const overview = worldStore.state.mainStoryline.overview
            if (overview) {
              const finalized = worldStore.isFieldFinalized('mainStoryline', 'overview')
              const block = `=== 主线剧情（已有内容） ===\n${overview}`
              if (finalized) finalizedParts.push(block)
              else draftParts.push(block)
            }
            break
          }
          case 'player-identity': {
            const origin = worldStore.state.playerIdentity.origin
            if (origin) {
              const finalized = worldStore.isFieldFinalized('playerIdentity', 'origin')
              const block = `=== 玩家身份（已有内容） ===\n${origin}`
              if (finalized) finalizedParts.push(block)
              else draftParts.push(block)
            }
            break
          }
          case 'hero-system': {
            const heroes = worldStore.state.heroSystem.filter((h: any) => h.name.trim())
            if (heroes.length > 0) {
              const heroText = heroes.map((h: any) => `- ${h.name}（${h.element}·${h.continent}）：${h.backstory}`).join('\n')
              const finalized = heroes.some((h: any) => worldStore.isFieldFinalized('heroSystem', `${h.id}.name`))
              const block = `=== 英雄（已有内容） ===\n${heroText}`
              if (finalized) finalizedParts.push(block)
              else draftParts.push(block)
            }
            break
          }
          case 'world-tree-system': {
            const wt = worldStore.state.worldTreeSystem
            const wtParts: string[] = []
            if (wt.growthMechanism) wtParts.push(`成长机制：${wt.growthMechanism}`)
            if (wt.resourceContribution) wtParts.push(`资源贡献：${wt.resourceContribution}`)
            if (wt.unlockedFeatures) wtParts.push(`解锁功能：${wt.unlockedFeatures}`)
            if (wt.fourthForce) wtParts.push(`第四势力：${wt.fourthForce}`)
            if (wt.runeConnection) wtParts.push(`符文关联：${wt.runeConnection}`)
            if (wtParts.length > 0) {
              const finalized = ['growthMechanism', 'resourceContribution', 'unlockedFeatures', 'fourthForce', 'runeConnection']
                .some(f => worldStore.isFieldFinalized('worldTreeSystem', f))
              const block = `=== 世界树系统（已有内容） ===\n${wtParts.join('\n')}`
              if (finalized) finalizedParts.push(block)
              else draftParts.push(block)
            }
            break
          }
        }
        continue
      }

      // 2. 提取该子模块对应的字段内容
      const storeData = (worldStore.state as any)[mapping.storeKey]
      if (!storeData) continue

      const contents: string[] = []
      let allFinalized = true

      for (const fieldPath of mapping.fields) {
        // 支持嵌套路径如 'upper.past'
        const parts = fieldPath.split('.')
        let value = storeData
        for (const part of parts) {
          value = value?.[part]
        }
        if (value && typeof value === 'string' && value.trim()) {
          contents.push(value)
        }

        // 检查字段是否定稿
        if (!worldStore.isFieldFinalized(mapping.storeKey as any, fieldPath)) {
          allFinalized = false
        }
      }

      if (contents.length === 0) continue

      // 3. 格式化为上下文块
      const contextBlock = `=== ${mapping.label}（已有内容） ===\n${contents.join('\n\n')}`

      if (allFinalized) {
        finalizedParts.push(contextBlock)
      } else {
        draftParts.push(contextBlock)
      }
    }

    // 4. 注入参考文档
    if (template.referenceDocuments && template.referenceDocuments.length > 0) {
      for (const doc of template.referenceDocuments) {
        referenceParts.push(`=== ${doc.label} ===\n${doc.content}`)
      }
    }
  } catch {
    // stores may not be available in some contexts
  }

  return { finalizedParts, draftParts, referenceParts }
}

/**
 * 构建完整Prompt（支持全新/续写/扩展三种模式）
 * 兼容旧签名：不传 options 时行为与原先一致
 */
export function buildFullPrompt(
  moduleId: string,
  options?: PromptBuildOptions
): PromptBuildResult | null {
  const template = getPromptTemplateWithOptimization(moduleId)
  if (!template) return null

  const mode = options?.mode ?? 'full'
  const additionalRequirements = options?.additionalRequirements ?? ''
  const modelName = options?.modelName
  const extraContext = options?.extraContext ?? {}

  // 1. 获取模块类别
  const category = getModuleCategory(moduleId)

  // 2. 使用分层系统提示词
  const system = getLayeredSystemPrompt(category, {
    excludeTempleFactions: moduleId.startsWith('phase2-')
  })

  // 3. 判断是否需要按模板声明读取 live store 上下文
  const hasModuleDeps = template.contextDependencies.length > 0

  let finalizedParts: string[]
  let draftParts: string[]
  let referenceParts: string[] = []

  if (hasModuleDeps) {
    // 按模板依赖收集 live store 上下文
    const moduleContext = collectModuleContext(template)
    finalizedParts = moduleContext.finalizedParts
    draftParts = moduleContext.draftParts
    referenceParts = moduleContext.referenceParts

    // 如果配置了 contextMaxChars，对每个上下文部分进行按段落裁剪
    if (template.contextMaxChars) {
      const maxChars = template.contextMaxChars
      finalizedParts = finalizedParts.map(part => trimByParagraphs(part, maxChars))
      draftParts = draftParts.map(part => trimByParagraphs(part, maxChars))
    }
  } else {
    // 原有类别级上下文收集（兼容）
    const summaryContext = collectSummaryContext(template)
    finalizedParts = summaryContext.finalizedParts
    draftParts = summaryContext.draftParts
    referenceParts = (template.referenceDocuments || [])
      .filter(doc => doc.content.trim().length > 0)
      .map(doc => `=== ${doc.label} ===\n${doc.content}`)
  }

  let wasTrimmed = false

  // --- 上下文智能裁剪（结构化裁剪，按优先级和Markdown段落）---
  const contextLimit = getContextLimit(modelName)
  // 将token限制的60%分配给上下文（其余留给模板/指令/输出）
  const contextBudget = Math.floor(contextLimit * 0.6)

  // 获取当前模块类别的上下文需求配置（用于优先级）
  const config = getCategoryContextConfig(category)
  const contextNeeds = config.contextNeeds

  // 将摘要部分转为带优先级的 ContextPart
  const allParts = [...finalizedParts, ...draftParts, ...referenceParts]
  const contextParts: ContextPart[] = [
    ...finalizedParts.map((content, i) => ({
      content,
      priority: (contextNeeds[i]?.priority || 'medium') as ContextPart['priority'],
      label: contextNeeds[i]?.sourceCategory || `finalized-${i}`,
      tokens: estimateTokenCount(content)
    })),
    ...draftParts.map((content, i) => ({
      content,
      priority: (contextNeeds[finalizedParts.length + i]?.priority || 'medium') as ContextPart['priority'],
      label: contextNeeds[finalizedParts.length + i]?.sourceCategory || `draft-${i}`,
      tokens: estimateTokenCount(content)
    })),
    ...referenceParts.map((content, i) => ({
      content,
      priority: 'medium' as ContextPart['priority'],
      label: `reference-${i}`,
      tokens: estimateTokenCount(content)
    }))
  ]

  // 计算总上下文 Token 数
  const totalContextTokens = contextParts.reduce((sum, p) => sum + p.tokens, 0)

  // 如果超过预算，使用结构化裁剪
  let trimmedFinalized = finalizedParts
  let trimmedDraft = draftParts
  let trimmedReference = referenceParts

  if (totalContextTokens > contextBudget) {
    const { trimmed, wasTrimmed: didTrim } = trimContextStructured(contextParts, contextBudget)
    wasTrimmed = didTrim

    // 将裁剪后的内容转回字符串数组
    const trimmedContents = trimmed.map(p => p.content)
    trimmedFinalized = trimmedContents.slice(0, finalizedParts.length)
    trimmedDraft = trimmedContents.slice(finalizedParts.length, finalizedParts.length + draftParts.length)
    trimmedReference = trimmedContents.slice(finalizedParts.length + draftParts.length)
  }

  let user = ''

  if (mode === 'continue') {
    // --- 续写模式 ---
    user = buildContinuePromptText(template, trimmedFinalized, trimmedDraft, trimmedReference, additionalRequirements)
  } else if (mode === 'expand') {
    // --- 扩展模式 ---
    user = buildExpandPromptText(template, trimmedFinalized, trimmedDraft, trimmedReference, additionalRequirements)
  } else {
    // --- 全新生成（原逻辑）---
    let contextBlock = ''
    const assembled: string[] = []
    // 静态规则注入（最高优先级，置于已确认设定之前，不参与裁剪）
    const staticBlocks = buildStaticInjectionBlocks(template)
    if (staticBlocks.length > 0) {
      assembled.push('--- 以下为游戏核心玩法规则（剧情必须围绕这些机制展开，不可违反）---\n\n' + staticBlocks.join('\n\n'))
    }
    if (trimmedFinalized.length > 0) {
      assembled.push('--- 以下为已确认的设定（请严格遵循，不可修改）---\n\n' + trimmedFinalized.join('\n\n'))
    }
    if (trimmedDraft.length > 0) {
      assembled.push('--- 以下为参考内容（可在此基础上优化）---\n\n' + trimmedDraft.join('\n\n'))
    }
    if (trimmedReference.length > 0) {
      assembled.push('--- 以下为参考素材（可借鉴风格和设定方向，但以已确认设定为准）---\n\n' + trimmedReference.join('\n\n'))
    }
    if (assembled.length > 0) {
      contextBlock = '\n\n' + assembled.join('\n\n')
    }

    const finalizeInstruction = '\n\n【重要约束】对于已确认的设定，请严格保持一致，不要修改或矛盾。'
    user = template.userPromptTemplate + contextBlock + finalizeInstruction

    if (additionalRequirements) {
      user += `\n\n--- 甲方新增要求 ---\n${additionalRequirements}`
    }

    user += '\n\n' + template.outputFormatInstructions
  }

  // 5. 替换占位符（extraContext）
  if (Object.keys(extraContext).length > 0) {
    for (const [placeholder, value] of Object.entries(extraContext)) {
      if (value) {
        user = user.replace(placeholder, `\n\n--- 已有内容：${placeholder} ---\n${value}\n`)
      } else {
        user = user.replace(placeholder, '')
      }
    }
  }
  // 清理未被替换的占位符（当 extraContext 中没有对应值时）
  user = user.replace(/OVERVIEW_CONTEXT/g, '')
  user = user.replace(/OUTLINE_CONTEXT/g, '')
  user = user.replace(/PREVIOUS_CHAPTERS_CONTEXT/g, '')
  user = user.replace(/HERO_CURRENT_DATA/g, '')
  user = user.replace(/CLIENT_OPINIONS/g, '')

  // 6. 计算 Token 数
  const systemTokens = estimateTokenCount(system)
  const contextTokens = estimateTokenCount(allParts.join('\n\n'))
  const templateTokens = estimateTokenCount(template.userPromptTemplate)
  const estimatedTokens = systemTokens + estimateTokenCount(user)

  return {
    system,
    user,
    estimatedTokens,
    wasTrimmed,
    systemTokens,
    contextTokens,
    templateTokens,
    category
  }
}

/** 续写模式Prompt构建 */
function buildContinuePromptText(
  template: PromptTemplate,
  finalizedParts: string[],
  draftParts: string[],
  referenceParts: string[],
  additionalRequirements: string
): string {
  const parts: string[] = []
  parts.push(`你是世界观续写助手。请在已确认内容的基础上继续创作「${template.moduleLabel}」模块。`)

  // 静态规则注入（优先于已确认内容出现）
  const staticBlocks = buildStaticInjectionBlocks(template)
  if (staticBlocks.length > 0) {
    parts.push('\n\n--- 游戏核心玩法规则（剧情必须围绕这些机制展开，不可违反）---')
    parts.push(staticBlocks.join('\n\n'))
  }

  if (finalizedParts.length > 0) {
    parts.push('\n\n--- 已确认内容（不可修改）---')
    parts.push(finalizedParts.join('\n\n'))
  }

  if (draftParts.length > 0) {
    parts.push('\n\n--- 待续写部分（草稿参考）---')
    parts.push(draftParts.join('\n\n'))
  } else {
    parts.push('\n\n--- 待续写部分 ---')
    parts.push('以下字段为空或仅有草稿，请补充完整内容。')
  }

  if (referenceParts.length > 0) {
    parts.push('\n\n--- 参考素材 ---')
    parts.push(referenceParts.join('\n\n'))
  }

  if (additionalRequirements) {
    parts.push(`\n\n--- 甲方新增要求 ---\n${additionalRequirements}`)
  }

  parts.push('\n\n请输出「完整可覆盖」稿件：已确认内容不得改写；草稿/空白字段需要补完为可直接写回字段的完整正文，不能只给新增片段或续写片段。确保与已确认内容逻辑连贯、风格一致。')
  parts.push('\n\n' + template.outputFormatInstructions)

  return parts.join('')
}

/** 扩展模式Prompt构建 */
function buildExpandPromptText(
  template: PromptTemplate,
  finalizedParts: string[],
  draftParts: string[],
  referenceParts: string[],
  additionalRequirements: string
): string {
  const parts: string[] = []
  parts.push(`你是世界观扩展助手。请在现有内容基础上对「${template.moduleLabel}」模块进行扩展。`)

  // 静态规则注入（优先于现有内容出现）
  const staticBlocks = buildStaticInjectionBlocks(template)
  if (staticBlocks.length > 0) {
    parts.push('\n\n--- 游戏核心玩法规则（剧情必须围绕这些机制展开，不可违反）---')
    parts.push(staticBlocks.join('\n\n'))
  }

  const allContent = [...finalizedParts, ...draftParts, ...referenceParts]
  if (allContent.length > 0) {
    parts.push('\n\n--- 现有完整内容 ---')
    parts.push(allContent.join('\n\n'))
  }

  if (additionalRequirements) {
    parts.push(`\n\n--- 扩展要求 ---\n${additionalRequirements}`)
  } else {
    parts.push('\n\n--- 扩展要求 ---')
    parts.push('请在保留所有现有内容的基础上，对薄弱部分进行深化和补充。')
  }

  parts.push('\n\n请输出「完整可覆盖」稿件：在保留并整合所有现有内容的基础上完成深化，最终结果必须可直接写回对应字段，不能只输出新增片段。使用与原有内容一致的标记格式。')
  parts.push('\n\n' + template.outputFormatInstructions)

  return parts.join('')
}

export { getSystemPrompt }

export {
  getAssessmentSystemPrompt,
  buildDimensionEvalPrompt,
  buildKimiAnalysisPrompt,
  buildKimiOptimizePrompt
} from './assessment-prompts'
