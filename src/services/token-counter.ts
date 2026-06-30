// Token估算工具
// 中文字符 ≈ 2-3 tokens, 英文单词 ≈ 1-2 tokens
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  // 统计中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  // 统计英文单词数
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  // 统计标点和其他字符
  const others = text.length - chineseChars - (text.match(/[a-zA-Z]+/g) || []).join('').length

  return Math.ceil(chineseChars * 2.5 + englishWords * 1.5 + others * 0.5)
}

// 各模型的上下文窗口大小（tokens）
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16384,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'qwen-max': 32768,
  'qwen-plus': 131072,
  'doubao-pro': 128000,
  'kimi': 200000,
  'minimax': 245760,
  'default': 32768,
}

export function getContextLimit(model?: string): number {
  if (!model) return MODEL_CONTEXT_LIMITS['default']
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (model.toLowerCase().includes(key)) return limit
  }
  return MODEL_CONTEXT_LIMITS['default']
}

export function getTokenWarningLevel(tokenCount: number, limit: number): 'safe' | 'warning' | 'danger' {
  const ratio = tokenCount / limit
  if (ratio >= 0.95) return 'danger'
  if (ratio >= 0.80) return 'warning'
  return 'safe'
}
