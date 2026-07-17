/**
 * 评测系统类型定义
 */

// 评测模型提供商（3个评测模型 + 1个分析模型）
export type EvalProvider = 'qwen' | 'doubao' | 'minimax'
export type AnalysisProvider = 'kimi'

// 评测模型配置
export interface EvalModelConfig {
  provider: EvalProvider | AnalysisProvider
  label: string           // 显示名称
  apiKey: string
  baseUrl: string
  model: string
  endpoint?: string       // 豆包专用 endpoint ID
  enabled: boolean        // 是否启用
}

// 评测维度ID
export type AssessmentDimensionId =
  | 'logic-consistency'      // 世界观内部逻辑一致性
  | 'fantasy-adaptation'     // 西方魔幻背景适配度
  | 'completeness'           // 设定完整性与系统性
  | 'innovation'             // 创新性与独特识别度
  | 'narrative-potential'    // 叙事潜力与故事张力
  | 'tower-defense-fit'      // 叙事落地可用性（保留ID以兼容历史报告）
  | 'deity-factions'         // 神系内部派系分化与冲突设计

// 评分等级
export type ScoreGrade = 'excellent' | 'good' | 'pass' | 'fail'
export type OverallGrade = 'S' | 'A' | 'B' | 'C' | 'D'

// 单维度评分
export interface DimensionScore {
  dimension: AssessmentDimensionId
  displayName: string
  maxScore: number         // 该维度满分（15或20）
  score: number            // 实际得分
  grade: ScoreGrade
  reasoning: string        // 评分理由
  keyIssues: string[]      // 关键问题
  suggestions: string[]    // 改进建议
}

// 单模型评测结果
export interface ModelEvalResult {
  provider: EvalProvider
  modelName: string        // 模型显示名
  dimensions: DimensionScore[]
  totalScore: number       // 百分制总分
  overallGrade: OverallGrade
  summary: string          // 综合评语
  timestamp: number
  error?: string           // 如果该模型评测失败
}

// Kimi2.5深度分析结果
export interface KimiAnalysisResult {
  analysis: string                     // 深度分析文本
  weakDimensions: AssessmentDimensionId[]  // 薄弱维度
  rootCauses: string[]                 // 根因分析
  optimizedPrompts: Record<string, string> // 优化后的提示词 (moduleId -> prompt)
  timestamp: number
}

// 提示词优化记录
export interface PromptOptimization {
  phase: 1 | 2 | 3
  originalPrompts: Record<string, string>   // moduleId -> 原始提示词
  optimizedPrompts: Record<string, string>  // moduleId -> 优化后提示词
  kimiAnalysis: KimiAnalysisResult
  userConfirmed: boolean
  appliedAt?: number
}

// 完整评测报告
export interface AssessmentReport {
  id: string
  phase: 1 | 2 | 3
  createdAt: number
  phaseCompletion: number              // 被评测阶段的完成度
  modelResults: ModelEvalResult[]      // 3个模型各自的评测结果
  averageScore: number                 // 三模型平均分
  needsOptimization: boolean           // 是否触发优化
  optimizationTriggers: string[]       // 触发原因描述列表
  kimiAnalysis?: KimiAnalysisResult    // Kimi2.5深度分析（仅低分时）
  promptOptimization?: PromptOptimization // 提示词优化记录
  status: 'running' | 'completed' | 'failed' | 'optimizing' // 评测状态
}

// 评测进度
export interface AssessmentProgress {
  currentModel: EvalProvider | ''
  currentDimension: AssessmentDimensionId | ''
  completedSteps: number
  totalSteps: number                   // 3模型 × 7维度 = 21
  modelProgress: Record<EvalProvider, {
    status: 'pending' | 'running' | 'completed' | 'error'
    completedDimensions: AssessmentDimensionId[]
  }>
}

// Phase反馈通知（用于在Phase页面顶部显示）
export interface PhaseAssessmentFeedback {
  phase: 1 | 2 | 3
  reportId: string
  averageScore: number
  overallGrade: OverallGrade
  needsOptimization: boolean
  weakDimensions: { name: string; score: number; maxScore: number }[]
  timestamp: number
  dismissed: boolean                   // 用户是否已关闭通知
}
