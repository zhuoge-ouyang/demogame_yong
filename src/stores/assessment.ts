import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type {
  EvalModelConfig, AssessmentReport, AssessmentProgress,
  PhaseAssessmentFeedback, EvalProvider, AssessmentDimensionId
} from '@/types/assessment'
import {
  DEFAULT_EVAL_CONFIGS, DEFAULT_KIMI_CONFIG, TOTAL_EVAL_STEPS,
  ASSESSMENT_DIMENSIONS, getOverallGrade
} from '@/constants/assessment'
import { useAppStore } from './app'
import { encryptApiKey, decryptApiKey } from '@/services/crypto-utils'

const STORAGE_KEY = 'assessment-store'

export const useAssessmentStore = defineStore('assessment', () => {
  const appStore = useAppStore()

  // === 状态 ===

  // 评测模型配置（3个评测模型）
  const evalConfigs = ref<EvalModelConfig[]>(
    JSON.parse(JSON.stringify(DEFAULT_EVAL_CONFIGS))
  )

  // Kimi 2.5 分析模型配置
  const kimiConfig = ref<EvalModelConfig>(
    JSON.parse(JSON.stringify(DEFAULT_KIMI_CONFIG))
  )

  // 评测报告历史
  const reports = ref<AssessmentReport[]>([])

  // 当前评测报告
  const currentReport = ref<AssessmentReport | null>(null)

  // 评测进行状态
  const isAssessing = ref(false)

  // 评测进度
  const assessmentProgress = ref<AssessmentProgress>({
    currentModel: '',
    currentDimension: '',
    completedSteps: 0,
    totalSteps: TOTAL_EVAL_STEPS,
    modelProgress: {
      qwen: { status: 'pending', completedDimensions: [] },
      doubao: { status: 'pending', completedDimensions: [] },
      minimax: { status: 'pending', completedDimensions: [] }
    }
  })

  // Phase反馈通知（每个阶段最新的反馈）
  const phaseFeedbacks = ref<Record<number, PhaseAssessmentFeedback | null>>({
    1: null,
    2: null,
    3: null
  })

  // 优化后的提示词覆盖（moduleId -> optimized prompt text）
  const optimizedPrompts = ref<Record<string, string>>({})

  // 错误信息
  const currentError = ref<string | null>(null)

  // === 计算属性 ===

  // 最新报告
  const latestReport = computed(() => {
    if (reports.value.length === 0) return null
    return reports.value[reports.value.length - 1]
  })

  // 评测进度百分比
  const progressPercentage = computed(() => {
    if (assessmentProgress.value.totalSteps === 0) return 0
    return Math.round(
      (assessmentProgress.value.completedSteps / assessmentProgress.value.totalSteps) * 100
    )
  })

  // === 查询方法 ===

  // 指定阶段的报告列表
  function getReportsByPhase(phase: 1 | 2 | 3): AssessmentReport[] {
    return reports.value.filter(r => r.phase === phase)
  }

  // 获取指定模块的优化提示词（如果有）
  function getOptimizedPrompt(moduleId: string): string | null {
    return optimizedPrompts.value[moduleId] || null
  }

  // 获取指定阶段的反馈通知
  function getPhaseFeedback(phase: 1 | 2 | 3): PhaseAssessmentFeedback | null {
    return phaseFeedbacks.value[phase] || null
  }

  // === 操作方法 ===

  // 更新评测模型配置
  function updateEvalConfig(index: number, config: Partial<EvalModelConfig>) {
    if (index >= 0 && index < evalConfigs.value.length) {
      Object.assign(evalConfigs.value[index], config)
    }
  }

  // 更新Kimi配置
  function updateKimiConfig(config: Partial<EvalModelConfig>) {
    Object.assign(kimiConfig.value, config)
  }

  // 重置评测进度
  function resetProgress() {
    assessmentProgress.value = {
      currentModel: '',
      currentDimension: '',
      completedSteps: 0,
      totalSteps: TOTAL_EVAL_STEPS,
      modelProgress: {
        qwen: { status: 'pending', completedDimensions: [] },
        doubao: { status: 'pending', completedDimensions: [] },
        minimax: { status: 'pending', completedDimensions: [] }
      }
    }
    currentError.value = null
  }

  // 更新模型进度
  function updateModelProgress(
    provider: EvalProvider,
    status: 'pending' | 'running' | 'completed' | 'error',
    dimension?: string
  ) {
    const mp = assessmentProgress.value.modelProgress[provider]
    mp.status = status
    if (dimension && !mp.completedDimensions.includes(dimension as AssessmentDimensionId)) {
      mp.completedDimensions.push(dimension as AssessmentDimensionId)
    }
    assessmentProgress.value.currentModel = provider
    if (dimension) {
      assessmentProgress.value.currentDimension = dimension as AssessmentDimensionId
    }
    // 重新计算已完成步骤
    let completed = 0
    for (const p of Object.values(assessmentProgress.value.modelProgress)) {
      completed += p.completedDimensions.length
    }
    assessmentProgress.value.completedSteps = completed
  }

  // 添加评测报告
  function addReport(report: AssessmentReport) {
    reports.value.push(report)
    currentReport.value = report

    // 更新Phase反馈通知
    if (report.status === 'completed') {
      const weakDims: { name: string; score: number; maxScore: number }[] = []

      for (const mr of report.modelResults) {
        for (const d of mr.dimensions) {
          const config = ASSESSMENT_DIMENSIONS.find(c => c.id === d.dimension)
          if (config && d.score < config.weight * 0.8) {
            weakDims.push({ name: d.displayName, score: d.score, maxScore: d.maxScore })
          }
        }
      }

      // 去重
      const uniqueWeak = weakDims.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i)

      phaseFeedbacks.value[report.phase] = {
        phase: report.phase,
        reportId: report.id,
        averageScore: report.averageScore,
        overallGrade: report.modelResults.length > 0
          ? getOverallGrade(report.averageScore)
          : 'D',
        needsOptimization: report.needsOptimization,
        weakDimensions: uniqueWeak,
        timestamp: report.createdAt,
        dismissed: false
      }
    }
  }

  // 更新评测报告
  function updateReport(reportId: string, updates: Partial<AssessmentReport>) {
    const index = reports.value.findIndex(r => r.id === reportId)
    if (index !== -1) {
      Object.assign(reports.value[index], updates)
      if (currentReport.value?.id === reportId) {
        Object.assign(currentReport.value, updates)
      }
    }
  }

  // 保存优化后的提示词
  function setOptimizedPrompts(prompts: Record<string, string>) {
    Object.assign(optimizedPrompts.value, prompts)
  }

  // 清除优化后的提示词
  function clearOptimizedPrompts() {
    optimizedPrompts.value = {}
  }

  // 清除指定模块的优化提示词
  function clearOptimizedPromptForModule(moduleId: string) {
    const { [moduleId]: _, ...rest } = optimizedPrompts.value
    optimizedPrompts.value = rest
  }

  // 关闭Phase反馈通知
  function dismissPhaseFeedback(phase: 1 | 2 | 3) {
    if (phaseFeedbacks.value[phase]) {
      phaseFeedbacks.value[phase]!.dismissed = true
    }
  }

  // === 持久化 ===

  const debouncedSave = useDebounceFn(async () => {
    try {
      // 加密所有 API Key 后再持久化，localStorage 中不存明文
      const encryptedEvalConfigs = await Promise.all(
        evalConfigs.value.map(async (cfg) => ({
          ...cfg,
          apiKey: await encryptApiKey(cfg.apiKey)
        }))
      )
      const encryptedKimiConfig = {
        ...kimiConfig.value,
        apiKey: await encryptApiKey(kimiConfig.value.apiKey)
      }
      const data = {
        evalConfigs: encryptedEvalConfigs,
        kimiConfig: encryptedKimiConfig,
        reports: reports.value,
        phaseFeedbacks: phaseFeedbacks.value,
        optimizedPrompts: optimizedPrompts.value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      appStore.updateSaveTimestamp()
    } catch (e) {
      console.error('评测Store保存失败:', e)
    }
  }, 1000)

  // 监听状态变化自动保存
  watch(
    [evalConfigs, kimiConfig, reports, phaseFeedbacks, optimizedPrompts],
    () => debouncedSave(),
    { deep: true }
  )

  async function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      // 解密 evalConfigs 中的 API Key（兼容旧版明文存储）
      if (data.evalConfigs) {
        evalConfigs.value = await Promise.all(
          (data.evalConfigs as EvalModelConfig[]).map(async (cfg) => ({
            ...cfg,
            apiKey: await decryptApiKey(cfg.apiKey)
          }))
        )
      }
      // 解密 kimiConfig 中的 API Key
      if (data.kimiConfig) {
        kimiConfig.value = {
          ...data.kimiConfig,
          apiKey: await decryptApiKey(data.kimiConfig.apiKey)
        }
      }
      if (data.reports) reports.value = data.reports
      if (data.phaseFeedbacks) phaseFeedbacks.value = data.phaseFeedbacks
      if (data.optimizedPrompts) optimizedPrompts.value = data.optimizedPrompts
    } catch (e) {
      console.error('评测Store读取失败:', e)
    }
  }

  // 导出数据
  function getExportData() {
    return {
      evalConfigs: evalConfigs.value,
      kimiConfig: kimiConfig.value,
      reports: reports.value,
      phaseFeedbacks: phaseFeedbacks.value,
      optimizedPrompts: optimizedPrompts.value
    }
  }

  // 从JSON导入
  function loadFromJSON(data: any) {
    if (data.evalConfigs) evalConfigs.value = data.evalConfigs
    if (data.kimiConfig) kimiConfig.value = data.kimiConfig
    if (data.reports) reports.value = data.reports
    if (data.phaseFeedbacks) phaseFeedbacks.value = data.phaseFeedbacks
    if (data.optimizedPrompts) optimizedPrompts.value = data.optimizedPrompts
  }

  return {
    // 状态
    evalConfigs,
    kimiConfig,
    reports,
    currentReport,
    isAssessing,
    assessmentProgress,
    phaseFeedbacks,
    optimizedPrompts,
    currentError,
    // 计算属性
    latestReport,
    progressPercentage,
    // 查询方法
    getReportsByPhase,
    getOptimizedPrompt,
    getPhaseFeedback,
    // 操作方法
    updateEvalConfig,
    updateKimiConfig,
    resetProgress,
    updateModelProgress,
    addReport,
    updateReport,
    setOptimizedPrompts,
    clearOptimizedPrompts,
    clearOptimizedPromptForModule,
    dismissPhaseFeedback,
    // 持久化
    loadFromStorage,
    getExportData,
    loadFromJSON,
    debouncedSave
  }
})
