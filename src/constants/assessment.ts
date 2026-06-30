import type { AssessmentDimensionId, EvalModelConfig, EvalProvider, ScoreGrade, OverallGrade } from '@/types/assessment'

/**
 * 评测维度配置
 */
export interface DimensionConfig {
  id: AssessmentDimensionId
  displayName: string
  weight: number          // 满分分值
  description: string     // 维度说明
  checkPoints: string[]   // 关键检查点
  gradeThresholds: {      // 各等级分数范围 [min, max]
    excellent: [number, number]
    good: [number, number]
    pass: [number, number]
    fail: [number, number]
  }
}

export const ASSESSMENT_DIMENSIONS: DimensionConfig[] = [
  {
    id: 'logic-consistency',
    displayName: '世界观内部逻辑一致性',
    weight: 18,
    description: '评估设定自洽性、因果链和规则普适性',
    checkPoints: [
      '三界边界定义与交互规则是否明确',
      '九大陆地理分布合理性',
      '封魂令的获取/使用/限制条件规则闭环',
      '世界观核心法则是否前后一致'
    ],
    gradeThresholds: {
      excellent: [16, 18],
      good: [13, 15],
      pass: [9, 12],
      fail: [0, 8]
    }
  },
  {
    id: 'fantasy-adaptation',
    displayName: '西方魔幻背景适配度',
    weight: 13,
    description: '评估文化符号、传统与创新、审美协调',
    checkPoints: [
      '文化符号使用的准确性与深度',
      '传统西方魔幻元素与创新的平衡',
      '视觉审美与魔幻氛围的协调性',
      '是否存在文化混搭或错位'
    ],
    gradeThresholds: {
      excellent: [12, 13],
      good: [10, 11],
      pass: [7, 9],
      fail: [0, 6]
    }
  },
  {
    id: 'completeness',
    displayName: '设定完整性与系统性',
    weight: 18,
    description: '评估三界/九大陆/封魂令覆盖度、层级清晰度',
    checkPoints: [
      '九大陆每一块是否具有地理特征+主导势力+资源特产+关联性',
      '封魂令是否形成完整社会技术体系',
      '三界是否具备差异化的物理法则/时间流速/居民形态',
      '世界观层级结构是否清晰完整'
    ],
    gradeThresholds: {
      excellent: [16, 18],
      good: [13, 15],
      pass: [9, 12],
      fail: [0, 8]
    }
  },
  {
    id: 'innovation',
    displayName: '创新性与独特识别度',
    weight: 13,
    description: '评估差异化、记忆点、IP识别度',
    checkPoints: [
      '与市面同类作品的差异化程度',
      '核心创新点是否具有记忆性',
      'IP识别度和品牌潜力',
      '创新元素是否有机融入世界观'
    ],
    gradeThresholds: {
      excellent: [12, 13],
      good: [10, 11],
      pass: [7, 9],
      fail: [0, 6]
    }
  },
  {
    id: 'narrative-potential',
    displayName: '叙事潜力与故事张力',
    weight: 13,
    description: '评估剧情延展性、冲突丰富度、角色成长',
    checkPoints: [
      '主线剧情的延展性和分支可能',
      '核心冲突的丰富度和层次感',
      '角色成长弧线的设计质量',
      '支线故事的潜在空间'
    ],
    gradeThresholds: {
      excellent: [12, 13],
      good: [10, 11],
      pass: [7, 9],
      fail: [0, 6]
    }
  },
  {
    id: 'tower-defense-fit',
    displayName: '与塔防游戏机制协调性',
    weight: 13,
    description: '评估玩法-设定契合、设计接口完整性',
    checkPoints: [
      '封魂令能否自然转化为核心玩法机制',
      '三界差异能否体现为不同塔类型或敌人',
      '九大陆地形能否转化为独特关卡机制',
      '世界观元素与塔防核心循环的融合度'
    ],
    gradeThresholds: {
      excellent: [12, 13],
      good: [10, 11],
      pass: [7, 9],
      fail: [0, 6]
    }
  },
  {
    id: 'deity-factions',
    displayName: '神系内部派系分化与冲突设计',
    weight: 12,
    description: '评估神殿众神是否合理分化为多个派系，各派系间利益冲突、价值观差异、行为目的分歧是否清晰明确',
    checkPoints: [
      '神殿众神是否明确划分为多个派系（至少2-3个）',
      '各派系的利益诉求和核心目标是否有明确差异',
      '派系间的价值观冲突是否有内在逻辑和说服力',
      '神系派系分化对凡界格局和主线剧情的影响是否体现',
      '派系冲突是否能转化为游戏叙事和玩法素材'
    ],
    gradeThresholds: {
      excellent: [11, 12],
      good: [9, 10],
      pass: [6, 8],
      fail: [0, 5]
    }
  }
]

/**
 * 优化触发阈值：各维度得分低于满分的80%时触发
 */
export const OPTIMIZATION_SCORE_RATIO = 0.8

/**
 * 整体分数触发阈值：总分低于90时触发
 */
export const OPTIMIZATION_TOTAL_THRESHOLD = 90

/**
 * 质量定级标准
 */
export const GRADE_THRESHOLDS: { min: number; grade: OverallGrade; label: string; suggestion: string }[] = [
  { min: 90, grade: 'S', label: 'S级（卓越）', suggestion: '可直接进入美术与系统设计' },
  { min: 80, grade: 'A', label: 'A级（优秀）', suggestion: '针对弱项进行补强' },
  { min: 70, grade: 'B', label: 'B级（良好）', suggestion: '对薄弱环节进行修订' },
  { min: 60, grade: 'C', label: 'C级（合格）', suggestion: '重构至少2个核心维度' },
  { min: 0, grade: 'D', label: 'D级（不合格）', suggestion: '重新梳理基础架构' }
]

/**
 * 一票否决项
 */
export const VETO_CONDITIONS = [
  '封魂令与三界设定存在无法调和的逻辑冲突',
  '九大陆中超过3块仅为名称无实质描述',
  '塔防核心玩法在世界观中完全无解释',
  '神殿众神完全为统一派别，无任何派系分化或内部冲突描述'
]

/**
 * 评测模型默认配置
 */
export const DEFAULT_EVAL_CONFIGS: EvalModelConfig[] = [
  {
    provider: 'qwen',
    label: 'Qwen3.6-Plus',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-plus',
    enabled: true
  },
  {
    provider: 'doubao',
    label: '豆包',
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro',
    endpoint: '',
    enabled: true
  },
  {
    provider: 'minimax',
    label: 'Minimax',
    apiKey: '',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'MiniMax-Text-01',
    enabled: true
  }
]

/**
 * Kimi 2.5 分析模型默认配置
 */
export const DEFAULT_KIMI_CONFIG: EvalModelConfig = {
  provider: 'kimi',
  label: 'Kimi 2.5',
  apiKey: '',
  baseUrl: 'https://api.moonshot.cn/v1',
  model: 'kimi-k2.5',
  enabled: true
}

/**
 * 评测总步骤数：3模型 × 7维度
 */
export const TOTAL_EVAL_STEPS = 21

/**
 * 根据总分获取等级
 */
export function getOverallGrade(score: number): OverallGrade {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.grade
  }
  return 'D'
}

/**
 * 根据维度分数获取评分等级
 */
export function getScoreGrade(dimensionId: AssessmentDimensionId, score: number): ScoreGrade {
  const dim = ASSESSMENT_DIMENSIONS.find(d => d.id === dimensionId)
  if (!dim) return 'fail'
  const t = dim.gradeThresholds
  if (score >= t.excellent[0]) return 'excellent'
  if (score >= t.good[0]) return 'good'
  if (score >= t.pass[0]) return 'pass'
  return 'fail'
}

/**
 * 检查是否需要触发优化
 * 条件：任一模型总分 < 90 或 任一维度分数 < 满分的80%
 */
export function checkNeedsOptimization(
  modelResults: { totalScore: number; dimensions: { dimension: AssessmentDimensionId; score: number }[] }[]
): { needed: boolean; triggers: string[] } {
  const triggers: string[] = []

  for (const result of modelResults) {
    // 检查总分
    if (result.totalScore < OPTIMIZATION_TOTAL_THRESHOLD) {
      triggers.push(`模型总分 ${result.totalScore} 低于 ${OPTIMIZATION_TOTAL_THRESHOLD} 分`)
    }
    // 检查各维度
    for (const dim of result.dimensions) {
      const config = ASSESSMENT_DIMENSIONS.find(d => d.id === dim.dimension)
      if (config) {
        const threshold = config.weight * OPTIMIZATION_SCORE_RATIO
        if (dim.score < threshold) {
          triggers.push(`"${config.displayName}" 得分 ${dim.score}/${config.weight}，低于阈值 ${threshold}`)
        }
      }
    }
  }

  return { needed: triggers.length > 0, triggers: [...new Set(triggers)] }
}
