import type { PromptTemplate } from '@/types/ai'
import { useAssessmentStore } from '@/stores/assessment'
import { phase1Prompts } from './prompts/phase1-prompts'
import { getPhase2Prompt } from './prompts/phase2-prompts'
import { getPhase3Prompt } from './prompts/phase3-prompts'
import type { ContinentId, ContinentAspects } from '@/types/continent'
import type { LandingContinentId } from '@/types/landing'
import { CONTINENTS, LANDING_CONTINENT_IDS } from '@/constants/continents'
import { ASPECT_LABELS } from '@/types/continent'

/**
 * 获取指定Phase当前使用的提示词
 * 优先返回优化后的提示词，否则返回原始模板
 */
export function getCurrentPhasePrompts(phase: 1 | 2 | 3): Record<string, string> {
  const prompts: Record<string, string> = {}

  if (phase === 1) {
    // Phase 1: realm-structure, main-storyline, player-identity, hero-system, castle-goddess
    const moduleIds = ['realm-structure', 'main-storyline', 'player-identity', 'hero-system', 'castle-goddess']
    for (const moduleId of moduleIds) {
      const template = phase1Prompts[moduleId]
      if (template) {
        prompts[moduleId] = combinePromptParts(template)
      }
    }
  } else if (phase === 2) {
    // Phase 2: continent-{id}-{aspect} (各大陆各维度)
    const aspectKeys = Object.keys(ASPECT_LABELS) as Array<keyof ContinentAspects>
    for (const continent of CONTINENTS) {
      for (const aspectKey of aspectKeys) {
        const templateId = `phase2-${continent.id}-${aspectKey}`
        const template = getPhase2Prompt(continent.id as ContinentId, aspectKey)
        if (template) {
          prompts[templateId] = combinePromptParts(template)
        }
      }
    }
  } else if (phase === 3) {
    // Phase 3: landing-{id}-{module} (前三大陆各模块)
    const moduleKeys: Array<'entry-prompt' | 'completion-feedback' | 'boss-design' | 'level-nodes'> = [
      'entry-prompt', 'completion-feedback', 'boss-design', 'level-nodes'
    ]
    for (const continentId of LANDING_CONTINENT_IDS) {
      for (const moduleKey of moduleKeys) {
        const templateId = `phase3-${continentId}-${moduleKey}`
        const template = getPhase3Prompt(continentId as LandingContinentId, moduleKey)
        if (template) {
          prompts[templateId] = combinePromptParts(template)
        }
      }
    }
  }

  return prompts
}

/**
 * 将PromptTemplate的各个部分组合成完整提示词
 */
function combinePromptParts(template: PromptTemplate): string {
  return `【任务】${template.moduleLabel}

${template.userPromptTemplate}

【输出格式要求】
${template.outputFormatInstructions}`
}

/**
 * 应用优化后的提示词
 * 将Kimi2.5返回的优化提示词保存到Store
 */
export function applyOptimizedPrompts(
  phase: 1 | 2 | 3,
  optimizedPrompts: Record<string, string>
): void {
  const store = useAssessmentStore()
  store.setOptimizedPrompts(optimizedPrompts)
}

/**
 * 清除优化提示词（恢复为原始模板）
 */
export function clearOptimizedPrompts(): void {
  const store = useAssessmentStore()
  store.clearOptimizedPrompts()
}

/**
 * 检查指定模块是否有优化后的提示词
 */
export function hasOptimizedPrompt(moduleId: string): boolean {
  const store = useAssessmentStore()
  return store.getOptimizedPrompt(moduleId) !== null
}

/**
 * 获取指定模块的提示词（优先返回优化版本）
 * 这是供 prompts/index.ts 使用的核心函数
 */
export function getOptimizedPromptOrNull(moduleId: string): string | null {
  try {
    const assessmentStore = useAssessmentStore()
    return assessmentStore.getOptimizedPrompt(moduleId)
  } catch (e) {
    // Store可能尚未初始化，忽略
    return null
  }
}
