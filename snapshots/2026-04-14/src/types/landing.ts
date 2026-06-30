// 阶段三：前三大陆落地 类型定义
import type { ModuleMeta } from './content-meta'

export type LandingContinentId = 'jin' | 'bing' | 'huo'

export interface EntryPrompt {
  narrative: string      // 进入叙事
  npcDialogue: string    // NPC对话
  atmosphere: string     // 氛围描述
}

export interface CompletionFeedback {
  narrative: string      // 通关叙事
  rewardStory: string    // 奖励故事
  transitionText: string // 过渡文本（到下一大陆）
}

export interface BossDesign {
  name: string
  identity: string       // 身份背景
  motivation: string     // 动机
  signatureLine: string  // 标志性台词
  openingScene: string   // 开场设计
  storyConnection: string // 与大陆核心冲突的关系
}

export interface LevelNode {
  name: string
  storyBeat: string      // 故事节拍
  keyEncounter: string   // 关键遭遇
  narrativeReward: string // 叙事奖励
}

export interface LandingContinent {
  entryPrompt: EntryPrompt
  completionFeedback: CompletionFeedback
  bosses: BossDesign[]
  levelNodes: LevelNode[]
  _meta: ModuleMeta
}

export type LandingsState = Record<LandingContinentId, LandingContinent>
