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
}

export interface PromptBuildResult {
  system: string
  user: string
  estimatedTokens: number
  wasTrimmed: boolean
}

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
  temperature: number
  maxTokens: number
}

export interface PromptTemplate {
  templateId: string
  moduleLabel: string
  contextDependencies: string[]
  userPromptTemplate: string
  outputFormatInstructions: string
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
