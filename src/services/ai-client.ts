import type { AIConfig, TokenUsage, AIGenerateResult } from '@/types/ai'

export async function generateWithAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void
): Promise<AIGenerateResult> {
  if (config.provider === 'claude') {
    return generateWithClaude(config, systemPrompt, userPrompt, onChunk)
  }
  // openai, qwen, doubao, kimi, minimax all use OpenAI-compatible API
  return generateWithOpenAICompatible(config, systemPrompt, userPrompt, onChunk)
}

// 将外部 API 地址映射为同源代理路径，绕过浏览器 CORS 限制。
// Vite dev server 和 server.js 生产服务都维护了对应的 /proxy/* 路由。
const PROXY_MAP: [RegExp, string][] = [
  [/^https?:\/\/api\.moonshot\.cn/, '/proxy/moonshot'],
  [/^https?:\/\/api\.openai\.com/, '/proxy/openai'],
  [/^https?:\/\/api\.anthropic\.com/, '/proxy/anthropic'],
  [/^https?:\/\/dashscope\.aliyuncs\.com/, '/proxy/dashscope'],
  [/^https?:\/\/ark\.cn-beijing\.volces\.com/, '/proxy/volces'],
  [/^https?:\/\/api\.minimax\.chat/, '/proxy/minimax'],
]

export function proxyBaseUrl(baseUrl: string): string {
  const cleaned = baseUrl.replace(/\/+$/, '')
  for (const [pattern, proxyPath] of PROXY_MAP) {
    if (pattern.test(cleaned)) {
      return cleaned.replace(pattern, proxyPath)
    }
  }
  return cleaned
}

function resolveEndpoint(config: AIConfig): string {
  const base = proxyBaseUrl(config.baseUrl.replace(/\/+$/, ''))
  if (config.provider === 'claude') {
    return `${base}/v1/messages`
  }
  // All OpenAI-compatible providers
  return `${base}/chat/completions`
}

function extractUsage(data: any): TokenUsage | undefined {
  const u = data?.usage
  if (!u) return undefined
  return {
    promptTokens: u.prompt_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    totalTokens: u.total_tokens ?? 0,
    cachedTokens: u.cached_tokens
  }
}

async function generateWithOpenAICompatible(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void
): Promise<AIGenerateResult> {
  const endpoint = resolveEndpoint(config)
  const isKimi = config.provider === 'kimi'
  const isStreaming = !!onChunk

  const requestBody: Record<string, any> = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: isStreaming
  }

  // Kimi 2.5 models only allow temperature = 1
  if (isKimi && config.model.includes('2.5')) {
    requestBody.temperature = 1
  }

  // Kimi streaming: request usage in final chunk
  if (isKimi && isStreaming) {
    requestBody.stream_options = { include_usage: true }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const providerName = config.provider.charAt(0).toUpperCase() + config.provider.slice(1)
    throw new Error(err.error?.message || `${providerName} API 错误: ${response.status}`)
  }

  if (isStreaming && response.body) {
    let usage: TokenUsage | undefined
    const text = await readStream(response.body, (data) => {
      // Capture usage from Kimi's final chunk
      if (isKimi && data.usage) {
        usage = extractUsage(data)
      }
      const content = data.choices?.[0]?.delta?.content
      if (content) onChunk!(content)
      return content || ''
    })
    return { text, usage }
  }

  const data = await response.json()
  const usage = isKimi ? extractUsage(data) : undefined
  return { text: data.choices[0].message.content, usage }
}

async function generateWithClaude(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void
): Promise<AIGenerateResult> {
  const base = proxyBaseUrl(config.baseUrl.replace(/\/+$/, ''))
  const endpoint = `${base}/v1/messages`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      stream: !!onChunk
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude API 错误: ${response.status}`)
  }

  if (onChunk && response.body) {
    const text = await readStream(response.body, (data) => {
      if (data.type === 'content_block_delta' && data.delta?.text) {
        onChunk(data.delta.text)
        return data.delta.text
      }
      return ''
    })
    return { text }
  }

  const data = await response.json()
  return { text: data.content[0].text }
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  processLine: (data: any) => string
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]' || trimmed === 'event: message_stop') continue
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6))
          fullText += processLine(json)
        } catch {
          // skip invalid JSON
        }
      }
    }
  }

  return fullText
}

export interface TestConnectionResult {
  success: boolean
  message: string
  type: 'success' | 'error' | 'warning'
}

export async function testAIConnection(config: AIConfig): Promise<TestConnectionResult> {
  const base = proxyBaseUrl(config.baseUrl.replace(/\/+$/, ''))

  let endpoint: string
  let headers: Record<string, string>
  let body: Record<string, any>

  if (config.provider === 'claude') {
    endpoint = `${base}/v1/messages`
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
    body = {
      model: config.model,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }]
    }
  } else {
    endpoint = `${base}/chat/completions`
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    }
    body = {
      model: config.model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      return { success: true, message: '连接成功！模型可用', type: 'success' }
    }

    const errData = await response.json().catch(() => ({}))
    const errMsg = errData.error?.message || ''

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'API Key 无效或已过期', type: 'error' }
    }

    if (response.status === 400 && errMsg.includes('budget_exceeded')) {
      return { success: false, message: '连接成功，但账户余额不足', type: 'warning' }
    }

    if (response.status === 404) {
      return { success: false, message: 'API 地址无效，请检查 Base URL', type: 'error' }
    }

    return { success: false, message: `API 错误: ${response.status} ${errMsg}`, type: 'error' }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, message: '请求超时，请检查网络或 Base URL', type: 'error' }
    }
    return { success: false, message: '无法连接到 API 服务器，请检查网络或 Base URL', type: 'error' }
  }
}
