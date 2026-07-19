// 阶段三：前三大陆落地 类型定义
import type { ModuleMeta } from './content-meta'

export type LandingContinentId = 'jin' | 'mu' | 'bing' | 'huo'

export type LandingAct = 1 | 2 | 3

export interface SystemDialogue {
  opening: string        // 大陆开场系统对白
  actNodes: string[]     // 三幕阶段节点系统对白
}

export interface BossDesign {
  name: string
  identity: string       // 身份
  motivation: string     // 动机
  signatureLine: string  // 一句话台词
  act: LandingAct
  areaIndex: 3 | 6 | 9
}

export interface RegionOpponent {
  name: string
  identity: string
  motivation: string
  signatureLine: string
}

export interface LevelNode {
  name: string
  act: LandingAct
  storyPurpose: string       // 内部文案设计目标
  storyContent: string       // 甲方可审阅的区域故事正文（120-180字）
  entryPrompt: string        // 玩家进入前提示（1句）
  completionFeedback: string // 玩家结束后反馈（1句）
  narrativeReward: string    // 获得的剧情信息或线索
  opponent: RegionOpponent   // 非幕末区域的关键对手；幕末区域使用正式Boss
  gameplayHandoff: string    // 外部玩法团队衔接备注，不属于文案交付
}

export interface LandingContinent {
  systemDialogue: SystemDialogue
  bosses: BossDesign[]
  levelNodes: LevelNode[]
  _meta: ModuleMeta
}

export type LandingsState = Record<LandingContinentId, LandingContinent>
