/**
 * 四大内容模块分类系统
 * 
 * 将所有 Prompt 模板按内容性质归入四大类别：
 * - setting（设定模块）：三界结构等基础设定
 * - worldview（世界观模块）：世界树、地理环境等世界观框架
 * - storyline（剧情模块）：主线剧情、大陆剧情、关卡叙事等
 * - character（人设模块）：玩家身份、英雄、Boss等角色设定
 */

// ─── 类型定义 ─────────────────────────────────────────────

/** 四大内容模块类别 */
export type ModuleCategory = 'setting' | 'worldview' | 'storyline' | 'character'

/** 类别基础配置 */
export interface CategoryConfig {
  id: ModuleCategory
  label: string                                      // 中文标签
  description: string                                // 类别描述
  systemPromptLayers: ('base' | 'setting' | 'narrative')[]  // 需要注入的系统提示层
}

/** 类别上下文需求项 */
export interface CategoryContextNeed {
  sourceCategory: ModuleCategory   // 来源类别
  maxSummaryChars: number          // 摘要最大字符数
  priority: 'critical' | 'high' | 'medium' | 'low'
}

/** 类别上下文需求配置 */
export interface CategoryContextConfig {
  category: ModuleCategory
  contextNeeds: CategoryContextNeed[]
}

// ─── Phase2 维度 → 类别映射 ───────────────────────────────

/** Phase2 剧情类维度 */
const PHASE2_STORYLINE_ASPECTS = new Set([
  'mainPlot',
  'coreConflict',
  'playerGoal',
  'experiencePositioning',
  'playerProgressionChanges'
])

/** Phase2 世界观类维度 */
const PHASE2_WORLDVIEW_ASPECTS = new Set([
  'themeExpression',
  'inGameExpression'
])

// ─── Phase3 模块 → 类别映射 ───────────────────────────────

/** Phase3 剧情类模块（对应实际 moduleId 后缀） */
const PHASE3_STORYLINE_MODULES = new Set([
  'entry-prompt',
  'completion-feedback',
  'level-nodes'
])

/** Phase3 人设类模块（对应实际 moduleId 后缀） */
const PHASE3_CHARACTER_MODULES = new Set([
  'boss-design'
])

// ─── 四大类别配置 ─────────────────────────────────────────

export const CATEGORY_CONFIGS: Record<ModuleCategory, CategoryConfig> = {
  setting: {
    id: 'setting',
    label: '设定模块',
    description: '三界结构等基础设定，是所有内容模块的源头，不依赖其他类别',
    systemPromptLayers: ['base', 'setting']
  },
  worldview: {
    id: 'worldview',
    label: '世界观模块',
    description: '世界树系统、地理环境主题与游戏内表达等世界观框架内容',
    systemPromptLayers: ['base', 'setting']
  },
  storyline: {
    id: 'storyline',
    label: '剧情模块',
    description: '主线剧情、大陆剧情线、体验定位、玩家推进变化、关卡叙事等剧情内容',
    systemPromptLayers: ['base', 'narrative']
  },
  character: {
    id: 'character',
    label: '人设模块',
    description: '玩家身份、英雄系统、城堡与女神、Boss设计等角色设定内容',
    systemPromptLayers: ['base', 'narrative']
  }
}

// ─── 上下文需求配置 ────────────────────────────────────────

export const CATEGORY_CONTEXT_CONFIGS: Record<ModuleCategory, CategoryContextConfig> = {
  setting: {
    category: 'setting',
    // 设定模块是基础源头，无上下文需求
    contextNeeds: []
  },
  worldview: {
    category: 'worldview',
    contextNeeds: [
      { sourceCategory: 'setting', maxSummaryChars: 500, priority: 'critical' }
    ]
  },
  storyline: {
    category: 'storyline',
    contextNeeds: [
      { sourceCategory: 'setting', maxSummaryChars: 500, priority: 'critical' },
      { sourceCategory: 'worldview', maxSummaryChars: 300, priority: 'high' }
    ]
  },
  character: {
    category: 'character',
    contextNeeds: [
      { sourceCategory: 'setting', maxSummaryChars: 500, priority: 'critical' },
      { sourceCategory: 'storyline', maxSummaryChars: 300, priority: 'high' }
    ]
  }
}

// ─── 映射函数 ──────────────────────────────────────────────

/** Phase1 moduleId → category 精确映射 */
const PHASE1_CATEGORY_MAP: Record<string, ModuleCategory> = {
  'realm-structure': 'setting',   // 保留兼容
  'realm-overview': 'setting',    // 新增
  'realm-upper': 'setting',       // 新增
  'realm-mortal': 'setting',      // 新增
  'realm-abyss': 'setting',       // 新增
  'main-storyline': 'storyline',
  'player-identity': 'character',
  'hero-system': 'character',
  'castle-goddess': 'character',
  'castle-goddess-outline': 'character',   // 新增：两步式 Step 1
  'castle-goddess-detail': 'character',    // 新增：两步式 Step 2
  'world-tree-system': 'worldview'
}

/**
 * 根据 moduleId 判定其所属的内容模块类别
 * 
 * - Phase1 moduleId 精确匹配
 * - Phase2 moduleId 格式 phase2-{continent}-{aspect}，按 aspect 归类
 * - Phase3 moduleId 格式 phase3-{continent}-{module}，按 module 归类
 * - 未知 moduleId 默认返回 'setting'
 */
export function getModuleCategory(moduleId: string): ModuleCategory {
  // Phase1 精确匹配
  if (moduleId in PHASE1_CATEGORY_MAP) {
    return PHASE1_CATEGORY_MAP[moduleId]
  }

  // Phase2: phase2-{continent}-{aspect}
  if (moduleId.startsWith('phase2-')) {
    const parts = moduleId.split('-')
    // phase2 + continentId + aspectKey (aspectKey 可能包含连字符，取最后一段)
    // 格式: phase2-{continentId}-{aspectKey}
    // continentId 不含连字符，aspectKey 也不含连字符
    const aspectKey = parts.length >= 3 ? parts.slice(2).join('-') : ''
    if (PHASE2_STORYLINE_ASPECTS.has(aspectKey)) return 'storyline'
    if (PHASE2_WORLDVIEW_ASPECTS.has(aspectKey)) return 'worldview'
    // 未知 aspect 默认归入 storyline（Phase2 大部分维度是剧情类）
    return 'storyline'
  }

  // Phase3: phase3-{continent}-{module}
  if (moduleId.startsWith('phase3-')) {
    const parts = moduleId.split('-')
    // 格式: phase3-{continentId}-{moduleKey}
    // moduleKey: entry-prompt / completion-feedback / boss-design / level-nodes
    const moduleKey = parts.length >= 3 ? parts.slice(2).join('-') : ''
    if (PHASE3_STORYLINE_MODULES.has(moduleKey)) return 'storyline'
    if (PHASE3_CHARACTER_MODULES.has(moduleKey)) return 'character'
    return 'storyline'
  }

  // 未知 moduleId 默认返回 setting
  return 'setting'
}

/** 获取类别配置 */
export function getCategoryConfig(category: ModuleCategory): CategoryConfig {
  return CATEGORY_CONFIGS[category]
}

/** 获取类别上下文需求配置 */
export function getCategoryContextConfig(category: ModuleCategory): CategoryContextConfig {
  return CATEGORY_CONTEXT_CONFIGS[category]
}
