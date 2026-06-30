// AI相关类型定义

export type AIProvider = 'openai' | 'claude' | 'qwen' | 'doubao' | 'kimi' | 'minimax'

export type GenerationMode = 'full' | 'continue' | 'expand'

export interface AdditionalRequirement {
  id: string
  content: string
  source: 'input' | 'file'
  fileName?: string
  addedAt: number
}

export interface PromptBuildOptions {
  mode: GenerationMode
  additionalRequirements?: string
  modelName?: string
  /** 额外上下文，用于替换 userPrompt 中的占位符（如 OVERVIEW_CONTEXT、PREVIOUS_CHAPTERS_CONTEXT） */
  extraContext?: Record<string, string>
}

export interface PromptBuildResult {
  system: string
  user: string
  estimatedTokens: number
  wasTrimmed: boolean
  // 分层Token统计（可选）
  systemTokens?: number     // 系统提示词 Token 数
  contextTokens?: number    // 上下文 Token 数  
  templateTokens?: number   // 模板 Token 数
  category?: string         // 当前模块类别
}

export interface ImageAIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
  temperature: number
  maxTokens: number
  /** 图像生成模型配置（可选，未填则使用默认 chatgpt-image2） */
  image?: ImageAIConfig
}

export interface PromptTemplate {
  templateId: string
  moduleLabel: string
  contextDependencies: string[]
  userPromptTemplate: string
  outputFormatInstructions: string
  /** 参考文档列表，作为额外的上下文素材注入 prompt */
  referenceDocuments?: { label: string; content: string }[]
  /** 每个上下文依赖模块的最大字符数（超出时按段落裁剪） */
  contextMaxChars?: number
  /** 静态规则注入声明（如 'core-gameplay-rules'），由模板自主声明是否需要注入静态规则块 */
  staticInjections?: string[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens?: number
}

export interface AIGenerateResult {
  text: string
  usage?: TokenUsage
}

export interface GenerationResult {
  moduleId: string
  timestamp: number
  prompt: string
  response: string
  accepted: boolean
}

export interface AIState {
  config: AIConfig
  generationHistory: GenerationResult[]
  isGenerating: boolean
  currentError: string | null
}
