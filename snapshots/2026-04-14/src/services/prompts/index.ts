import { getSystemPrompt } from './system-prompt'
import { phase1Prompts } from './phase1-prompts'
import { getPhase2Prompt } from './phase2-prompts'
import { getPhase3Prompt } from './phase3-prompts'
import type { PromptTemplate, PromptBuildOptions, PromptBuildResult } from '@/types/ai'
import type { ContinentId, ContinentAspects } from '@/types/continent'
import type { LandingContinentId } from '@/types/landing'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { getOptimizedPromptOrNull } from '../prompt-optimizer'
import { estimateTokenCount, getContextLimit } from '../token-counter'

export function getPromptTemplate(moduleId: string): PromptTemplate | null {
  // Phase 1
  if (phase1Prompts[moduleId]) return phase1Prompts[moduleId]
  // Phase 2: format "phase2-{continentId}-{aspectKey}"
  const p2Match = moduleId.match(/^phase2-(\w+)-(\w+)$/)
  if (p2Match) {
    return getPhase2Prompt(p2Match[1] as ContinentId, p2Match[2] as keyof ContinentAspects)
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

  const system = getSystemPrompt()
  const { finalizedParts, draftParts } = collectContext(template)

  let wasTrimmed = false

  // --- 上下文智能裁剪 ---
  const contextLimit = getContextLimit(modelName)
  // 将token限制的60%分配给上下文（其余留给模板/指令/输出）
  const maxContextChars = Math.floor(contextLimit * 0.6 / 2.5) // 粗略: 1 char ≈ 2.5 tokens for zh
  const allContextParts = [...finalizedParts, ...draftParts]
  const { trimmed: trimmedParts, wasTrimmed: didTrim } = trimContextParts(allContextParts, maxContextChars)
  wasTrimmed = didTrim

  // 重新拆分为定稿/草稿
  const trimmedFinalized = trimmedParts.slice(0, finalizedParts.length)
  const trimmedDraft = trimmedParts.slice(finalizedParts.length)

  let user = ''

  if (mode === 'continue') {
    // --- 续写模式 ---
    user = buildContinuePromptText(template, trimmedFinalized, trimmedDraft, additionalRequirements)
  } else if (mode === 'expand') {
    // --- 扩展模式 ---
    user = buildExpandPromptText(template, trimmedFinalized, trimmedDraft, additionalRequirements)
  } else {
    // --- 全新生成（原逻辑）---
    let contextBlock = ''
    const assembled: string[] = []
    if (trimmedFinalized.length > 0) {
      assembled.push('--- 以下为已确认的设定（请严格遵循，不可修改）---\n\n' + trimmedFinalized.join('\n\n'))
    }
    if (trimmedDraft.length > 0) {
      assembled.push('--- 以下为参考内容（可在此基础上优化）---\n\n' + trimmedDraft.join('\n\n'))
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

  const estimatedTokens = estimateTokenCount(system) + estimateTokenCount(user)

  return { system, user, estimatedTokens, wasTrimmed }
}

/** 续写模式Prompt构建 */
function buildContinuePromptText(
  template: PromptTemplate,
  finalizedParts: string[],
  draftParts: string[],
  additionalRequirements: string
): string {
  const parts: string[] = []
  parts.push(`你是世界观续写助手。请在已确认内容的基础上继续创作「${template.moduleLabel}」模块。`)

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

  if (additionalRequirements) {
    parts.push(`\n\n--- 甲方新增要求 ---\n${additionalRequirements}`)
  }

  parts.push('\n\n请仅输出待续写部分的内容，确保与已确认内容逻辑连贯、风格一致。')
  parts.push('\n\n' + template.outputFormatInstructions)

  return parts.join('')
}

/** 扩展模式Prompt构建 */
function buildExpandPromptText(
  template: PromptTemplate,
  finalizedParts: string[],
  draftParts: string[],
  additionalRequirements: string
): string {
  const parts: string[] = []
  parts.push(`你是世界观扩展助手。请在现有内容基础上对「${template.moduleLabel}」模块进行扩展。`)

  const allContent = [...finalizedParts, ...draftParts]
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

  parts.push('\n\n请在保留所有现有内容的基础上，针对扩展要求生成新增内容。使用与原有内容一致的标记格式输出新增部分。')
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
