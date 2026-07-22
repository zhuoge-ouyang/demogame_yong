// 阶段二：九大陆叙事设计 类型定义
import type { ModuleMeta } from './content-meta'

export type ContinentId = 'jin' | 'mu' | 'bing' | 'huo' | 'tu' | 'feng' | 'lei' | 'guang' | 'an'

export interface ContinentAspects {
  mainPlot: string              // 主线剧情
  coreConflict: string          // 核心冲突
  playerGoal: string            // 玩家目标
  storyGameplayConcept: string  // 结合剧情的玩法构想（仅风、雷大陆展示）
  experiencePositioning: string // 体验定位
  inGameExpression: string      // 剧情呈现方式
  themeExpression: string       // 主题表达
  playerProgressionChanges: string // 剧情推进变化
}

export interface ContinentData {
  id: ContinentId
  name: string
  element: string
  aspects: ContinentAspects
  _meta: ModuleMeta
}

export type ContinentsState = Record<ContinentId, ContinentData>

export const ASPECT_KEYS: (keyof ContinentAspects)[] = [
  'mainPlot',
  'coreConflict',
  'playerGoal',
  'experiencePositioning',
  'inGameExpression',
  'themeExpression',
  'playerProgressionChanges'
]

export const ASPECT_LABELS: Record<keyof ContinentAspects, string> = {
  mainPlot: '主线剧情',
  coreConflict: '核心冲突',
  playerGoal: '玩家目标',
  storyGameplayConcept: '结合剧情的玩法构想',
  experiencePositioning: '体验定位',
  inGameExpression: '剧情呈现方式',
  themeExpression: '主题表达',
  playerProgressionChanges: '剧情推进变化'
}

export const STORY_GAMEPLAY_CONTINENT_IDS: readonly ContinentId[] = ['feng', 'lei']

export function getContinentAspectKeys(continentId: ContinentId): (keyof ContinentAspects)[] {
  const keys = [...ASPECT_KEYS]
  if (STORY_GAMEPLAY_CONTINENT_IDS.includes(continentId)) {
    keys.splice(3, 0, 'storyGameplayConcept')
  }
  return keys
}
