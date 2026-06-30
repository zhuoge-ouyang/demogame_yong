// 阶段一：世界框架与核心叙事 类型定义
import type { ModuleMeta } from './content-meta'

export interface RealmData {
  past: string
  present: string
  future: string
}

export interface ThreeRealmData {
  upper: RealmData   // 上界/神殿
  mortal: RealmData  // 凡界
  abyss: RealmData   // 深渊
  summary: string    // 整体概述
}

export interface StorylineStage {
  name: string
  goal: string
  events: string
  resolution: string
}

export interface MainStoryline {
  stages: [StorylineStage, StorylineStage, StorylineStage]
  overview: string
}

export interface PlayerIdentity {
  origin: string              // 起源概念（世界树节点）
  initialPerception: string   // 初始认知（玩家最初以为自己是什么）
  revelationArc: string       // 揭示弧线（如何发现真实身份）
  gameplayIntegration: string // 玩法整合（身份如何与机制关联）
}

export interface HeroData {
  id: string
  name: string
  element: string
  continent: string
  visual: string        // 视觉描述
  backstory: string     // 背景故事
  personality: string   // 性格特征
  role: string          // 在故事中的角色
  joinCondition: string // 加入条件
  joinStage: string      // 英雄加入玩家阵营的时机
  storyRole: string      // 英雄在整体故事中的角色定位
}

export interface CastleData {
  description: string   // 城堡描述
  role: string          // 游戏中的作用
  significance: string  // 叙事意义
}

export interface GoddessData {
  name: string
  appearance: string    // 外观
  personality: string   // 性格
  trueNature: string    // 真实身份
  guidanceStyle: string // 引导方式
  dialogueThemes: string // 对话主题
  truthMatrix: string      // 女神在不同阶段的言论真假策略
}

export interface CastleGoddessData {
  castle: CastleData
  goddess: GoddessData
}

export interface WorldTreeSystemData {
  growthMechanism: string      // 世界树的成长阶段与机制
  resourceContribution: string // 玩家如何贡献资源给世界树
  unlockedFeatures: string     // 世界树成长后解锁的功能/玩法
  fourthForce: string          // 世界树成为第四势力的条件与意义
  runeConnection: string       // 符文与世界树/元素的关联概述
}

export interface OpeningBattleData {
  sealAbyss: string         // 封渊之役（众神联合凡族打败深渊魂族）
}

export interface WorldState {
  realmStructure: ThreeRealmData
  mainStoryline: MainStoryline
  playerIdentity: PlayerIdentity
  heroSystem: HeroData[]
  castleGoddess: CastleGoddessData
  worldTreeSystem: WorldTreeSystemData
  openingBattle: OpeningBattleData
  _meta: {
    realmStructure: ModuleMeta
    mainStoryline: ModuleMeta
    playerIdentity: ModuleMeta
    heroSystem: ModuleMeta
    castleGoddess: ModuleMeta
    worldTreeSystem: ModuleMeta
    openingBattle: ModuleMeta
  }
  /** 模块审核摘要，key 为模块类别 (setting/worldview/storyline/character) */
  moduleSummaries: Record<string, string>
}
