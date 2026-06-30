import { defineStore } from 'pinia'
import { reactive, computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { AIConfig, GenerationResult, AIState } from '@/types/ai'
import { defaultAIConfig } from '@/constants/defaults'

const STORAGE_KEY = 'sjg_ai_v1'
const SUPPORTED_PROVIDERS = new Set(['openai', 'claude', 'qwen', 'doubao', 'kimi', 'minimax'])

export const useAIStore = defineStore('ai', () => {
  const config = reactive<AIConfig>(defaultAIConfig())
  const generationHistory = ref<GenerationResult[]>([])
  const isGenerating = ref(false)
  const currentError = ref<string | null>(null)

  const isConfigured = computed(() => !!config.apiKey.trim())

  function updateConfig(partial: Partial<AIConfig>) {
    Object.assign(config, partial)
  }

  function addGenerationResult(result: GenerationResult) {
    generationHistory.value.push(result)
  }

  function markGenerationAccepted(timestamp: number) {
    const item = generationHistory.value.find(result => result.timestamp === timestamp)
    if (item) item.accepted = true
  }

  function historyForModule(moduleId: string): GenerationResult[] {
    return generationHistory.value.filter(r => r.moduleId === moduleId)
  }

  const debouncedSave = useDebounceFn(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, generationHistory: generationHistory.value }))
    } catch (e) {
      console.error('AI配置保存失败:', e)
    }
  }, 1000)

  watch([config, generationHistory], () => debouncedSave(), { deep: true })

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (data.config) {
          const defaults = defaultAIConfig()
          Object.assign(config, defaults, data.config)
          if (!SUPPORTED_PROVIDERS.has(config.provider)) {
            Object.assign(config, defaults)
          }
          // 确保 image 子配置完整地合并（而不是被空/缺失字段覆盖）
          config.image = { ...defaults.image!, ...(data.config.image || {}) }
        }
        if (data.generationHistory) generationHistory.value = data.generationHistory
      }
    } catch (e) {
      console.error('AI配置读取失败:', e)
    }
  }

  return {
    config,
    generationHistory,
    isGenerating,
    currentError,
    isConfigured,
    updateConfig,
    addGenerationResult,
    markGenerationAccepted,
    historyForModule,
    loadFromStorage
  }
})
