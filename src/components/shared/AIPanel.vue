<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NSpace, NSpin, NModal, NTag, NInput, NCollapse, NCollapseItem, NProgress, NTooltip, useMessage, useDialog } from 'naive-ui'
import { useClipboard } from '@vueuse/core'
import { parseSections } from '@/services/ai-content-parser'
import { useAIStore } from '@/stores/ai'
import { useAssessmentStore } from '@/stores/assessment'
import { useHistoryStore } from '@/stores/history'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { buildFullPrompt, getPromptTemplate } from '@/services/prompts'
import { getCategoryContextConfig, CATEGORY_CONFIGS } from '@/services/prompts/module-categories'
import type { ModuleCategory } from '@/services/prompts/module-categories'
import { generateWithAI } from '@/services/ai-client'
import { formatCanonViolationSummary, getFatalCanonViolations } from '@/services/canon-guard'
import { estimateTokenCount, getContextLimit, getTokenWarningLevel } from '@/services/token-counter'
import type { TokenUsage, GenerationMode, AdditionalRequirement, PromptBuildOptions } from '@/types/ai'
import type { FieldMeta } from '@/types/content-meta'
import { useLocalAccess } from '@/composables/useLocalAccess'

export interface ConflictField {
  fieldPath: string
  label: string
  meta: FieldMeta
}

const props = defineProps<{
  moduleId: string
  contextLabels?: string[]
  /** 父组件提供的字段元数据检查函数，返回有冲突的字段列表 */
  checkFieldConflicts?: () => ConflictField[]
  /** 仅生成模式：隐藏编辑Prompt、模式选择等编辑功能，仅保留AI生成和查看 */
  generateOnly?: boolean
  /** 额外上下文，用于替换 userPrompt 中的占位符 */
  extraContext?: Record<string, string>
}>()

const emit = defineEmits<{
  accept: [content: string]
  'accept-partial': [content: string, skippedFields: string[]]
}>()

const aiStore = useAIStore()
const assessmentStore = useAssessmentStore()
const historyStore = useHistoryStore()
const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()
const message = useMessage()
const dialog = useDialog()
const { copy, copied } = useClipboard()
const { isLocalUser } = useLocalAccess()

const showPromptModal = ref(false)
const showEditModal = ref(false)
const showConflictModal = ref(false)
const result = ref('')
const isStreaming = ref(false)
const error = ref('')
const tokenUsage = ref<TokenUsage | undefined>()
const autoFilled = ref(false)
const conflictFields = ref<ConflictField[]>([])
const pendingContent = ref('')
const skippedFinalizedFields = ref<string[]>([])
const generationHistoryId = ref<number | null>(null)

// === 续写模式相关 ===
const generationMode = ref<GenerationMode>('full')
const isForgeOpen = ref(false)

const generationModeLabel = computed(() => {
  if (generationMode.value === 'continue') return '续写补完'
  if (generationMode.value === 'expand') return '扩展深化'
  return '全新生成'
})

const forgeStateLabel = computed(() => {
  if (isStreaming.value) return '生成中'
  if (result.value) return '已有结果'
  if (autoFilled.value) return '已填充'
  return '待命'
})

function toggleForgePanel() {
  isForgeOpen.value = !isForgeOpen.value
}

watch(isStreaming, (streaming) => {
  if (streaming) isForgeOpen.value = true
})

watch(showConflictModal, (showing) => {
  if (showing) isForgeOpen.value = true
})

// === 附加需求相关 ===
const additionalInput = ref('')
const showRequirements = ref(false)
const REQUIREMENTS_STORAGE_KEY = 'sjg_requirements_history'

// 加载需求历史
function loadRequirementsHistory(): AdditionalRequirement[] {
  try {
    const raw = localStorage.getItem(REQUIREMENTS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function saveRequirementsHistory(list: AdditionalRequirement[]) {
  localStorage.setItem(REQUIREMENTS_STORAGE_KEY, JSON.stringify(list.slice(0, 5)))
}
const requirementsHistory = ref<AdditionalRequirement[]>(loadRequirementsHistory())

function addRequirementFromInput() {
  const text = additionalInput.value.trim()
  if (!text) return
  const req: AdditionalRequirement = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    content: text,
    source: 'input',
    addedAt: Date.now()
  }
  requirementsHistory.value = [req, ...requirementsHistory.value].slice(0, 5)
  saveRequirementsHistory(requirementsHistory.value)
  additionalInput.value = ''
  message.success('需求已添加')
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    if (!text.trim()) { message.warning('文件内容为空'); return }
    const req: AdditionalRequirement = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      content: text.trim(),
      source: 'file',
      fileName: file.name,
      addedAt: Date.now()
    }
    requirementsHistory.value = [req, ...requirementsHistory.value].slice(0, 5)
    saveRequirementsHistory(requirementsHistory.value)
    message.success(`已导入文件: ${file.name}`)
  }
  reader.readAsText(file)
  input.value = '' // reset
}

function useRequirement(req: AdditionalRequirement) {
  additionalInput.value = req.content
}

function removeRequirement(id: string) {
  requirementsHistory.value = requirementsHistory.value.filter(r => r.id !== id)
  saveRequirementsHistory(requirementsHistory.value)
}

// === Token计数与预警 ===
const currentPromptOptions = computed<PromptBuildOptions>(() => ({
  mode: generationMode.value,
  additionalRequirements: additionalInput.value.trim() || undefined,
  modelName: aiStore.config.model || undefined,
  extraContext: props.extraContext
}))

const promptBuildResult = computed(() => buildFullPrompt(props.moduleId, currentPromptOptions.value))
const estimatedTokens = computed(() => promptBuildResult.value?.estimatedTokens ?? 0)
const contextLimit = computed(() => getContextLimit(aiStore.config.model))
const tokenWarningLevel = computed(() => getTokenWarningLevel(estimatedTokens.value, contextLimit.value))
const tokenPercentage = computed(() => Math.min(100, Math.round(estimatedTokens.value / contextLimit.value * 100)))
const wasTrimmed = computed(() => promptBuildResult.value?.wasTrimmed ?? false)

// === 分层Token与上下文管理 ===
const categoryLabel = computed(() => {
  const labels: Record<string, string> = {
    'setting': '设定模块',
    'worldview': '世界观模块',
    'storyline': '剧情模块',
    'character': '人设模块'
  }
  return labels[promptBuildResult.value?.category || ''] || ''
})

const recommendedModel = computed(() => {
  const tokens = promptBuildResult.value?.estimatedTokens || 0
  if (tokens > 100000) return 'kimi (200K上下文)'
  if (tokens > 30000) return 'qwen-plus (131K上下文)'
  if (tokens > 16000) return 'gpt-4o (128K上下文)'
  return ''
})

const contextSources = computed(() => {
  const category = promptBuildResult.value?.category as ModuleCategory | undefined
  if (!category) return []
  const config = getCategoryContextConfig(category)
  return config.contextNeeds.map(need => ({
    label: CATEGORY_CONFIGS[need.sourceCategory]?.label || need.sourceCategory,
    priority: need.priority,
    tokens: need.maxSummaryChars,
    enabled: true
  }))
})

// Prompt编辑相关
const editedPrompt = ref('')
const originalTemplate = computed(() => getPromptTemplate(props.moduleId))

// 是否有自定义prompt
const hasCustomPrompt = computed(() => {
  return assessmentStore.getOptimizedPrompt(props.moduleId) !== null
})

// 获取当前使用的userPromptTemplate（自定义或默认）
const currentUserPrompt = computed(() => {
  const customPrompt = assessmentStore.getOptimizedPrompt(props.moduleId)
  if (customPrompt) {
    // 自定义prompt存储的是完整prompt，需要提取userPromptTemplate部分
    return extractUserPromptFromCustom(customPrompt)
  }
  return originalTemplate.value?.userPromptTemplate || ''
})

const promptData = computed(() => promptBuildResult.value)
const fullPromptText = computed(() => {
  if (!promptData.value) return ''
  return `【系统提示】\n${promptData.value.system}\n\n【用户提示】\n${promptData.value.user}`
})

const editablePromptPreview = computed(() => currentUserPrompt.value || '（当前模块没有可编辑的用户 Prompt 模板）')

// 从自定义prompt中提取userPromptTemplate部分
function extractUserPromptFromCustom(customPrompt: string): string {
  // 自定义prompt格式: 【任务】xxx\n\n{userPromptTemplate}\n\n【输出格式要求】xxx
  const taskEnd = customPrompt.indexOf('\n\n')
  if (taskEnd === -1) return customPrompt
  const formatStart = customPrompt.indexOf('\n\n【输出格式要求】')
  if (formatStart === -1) return customPrompt.slice(taskEnd + 2)
  return customPrompt.slice(taskEnd + 2, formatStart)
}

// 打开编辑弹窗
function openEditModal() {
  editedPrompt.value = currentUserPrompt.value
  showEditModal.value = true
}

// 保存自定义prompt
function saveCustomPrompt() {
  if (!originalTemplate.value) return
  
  // 构建完整的自定义prompt（包含任务标记和输出格式要求）
  const customPrompt = `【任务】${originalTemplate.value.moduleLabel}

${editedPrompt.value}

【输出格式要求】
${originalTemplate.value.outputFormatInstructions}`
  
  assessmentStore.setOptimizedPrompts({
    [props.moduleId]: customPrompt
  })
  message.success('Prompt已保存')
  showEditModal.value = false
}

// 恢复默认prompt
function restoreDefaultPrompt() {
  dialog.warning({
    title: '确认恢复默认',
    content: '确定要恢复为默认Prompt吗？自定义的修改将丢失。',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      assessmentStore.clearOptimizedPromptForModule(props.moduleId)
      message.success('已恢复为默认Prompt')
    }
  })
}

// 关闭编辑弹窗
function closeEditModal() {
  showEditModal.value = false
}

function saveAcceptedSnapshot() {
  const firstSentence = worldStore.state.realmStructure.summary
    || worldStore.state.mainStoryline.overview
    || ''
  historyStore.saveSnapshot(
    worldStore.getExportData(),
    continentsStore.getExportData(),
    landingStore.getExportData(),
    firstSentence
  )
}

function markGenerationAccepted() {
  if (generationHistoryId.value === null) return
  aiStore.markGenerationAccepted(generationHistoryId.value)
  generationHistoryId.value = null
  saveAcceptedSnapshot()
}

async function handleGenerate() {
  if (!promptData.value) return
  if (!aiStore.isConfigured) {
    error.value = '请先在“AI设置”中配置API Key'
    return
  }

  // Token超限检查
  if (tokenWarningLevel.value === 'danger') {
    const confirmed = await new Promise<boolean>(resolve => {
      dialog.warning({
        title: 'Token超限警告',
        content: `当前Prompt预估约 ${estimatedTokens.value} tokens，已达模型上限的 ${tokenPercentage.value}%。可能导致生成失败或内容被截断。确定要继续吗？`,
        positiveText: '继续生成',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false)
      })
    })
    if (!confirmed) return
  }

  error.value = ''
  result.value = ''
  tokenUsage.value = undefined
  autoFilled.value = false
  isStreaming.value = true
  aiStore.isGenerating = true

  // 如果有附加需求，保存到历史
  if (additionalInput.value.trim()) {
    addRequirementFromInput()
  }

  try {
    const generateResult = await generateWithAI(
      aiStore.config,
      promptData.value.system,
      promptData.value.user,
      (chunk) => { result.value += chunk }
    )
    if (!result.value) result.value = generateResult.text
    tokenUsage.value = generateResult.usage

    const historyTimestamp = Date.now()
    generationHistoryId.value = historyTimestamp
    aiStore.addGenerationResult({
      moduleId: props.moduleId,
      timestamp: historyTimestamp,
      prompt: fullPromptText.value,
      response: result.value,
      accepted: false
    })

    // 生成完成后检查冲突后自动填充
    handleAutoFill(result.value)
  } catch (e: any) {
    error.value = e.message || 'AI生成失败'
  } finally {
    isStreaming.value = false
    aiStore.isGenerating = false
  }
}

function handleAccept() {
  if (result.value) {
    handleAutoFill(result.value)
  }
}

function blockAutoFillIfCanonViolates(content: string): boolean {
  const violations = getFatalCanonViolations(content)
  if (violations.length === 0) return false

  const summary = formatCanonViolationSummary(violations)
  error.value = `Canon 门禁阻止自动填充：${summary}`
  message.error(`生成内容命中 Canon 门禁，已阻止自动填充：${summary}`, { duration: 8000 })
  isForgeOpen.value = true
  return true
}

/** 检查 canon 门禁和字段冲突后执行自动填充 */
function handleAutoFill(content: string) {
  if (blockAutoFillIfCanonViolates(content)) {
    autoFilled.value = false
    return
  }

  if (!props.checkFieldConflicts) {
    // 没有冲突检测函数，直接填充
    emit('accept', content)
    markGenerationAccepted()
    autoFilled.value = true
    return
  }

  const conflicts = props.checkFieldConflicts()
  const finalized = conflicts.filter(c => c.meta.status === 'finalized')
  const userEdited = conflicts.filter(c => c.meta.status === 'draft' && c.meta.lastEditSource === 'user')

  // 记录被跳过的定稿字段
  skippedFinalizedFields.value = finalized.map(f => f.fieldPath)

  if (finalized.length > 0) {
    message.info(`已定稿字段已跳过：${finalized.map(f => f.label).join('、')}`)
  }

  if (userEdited.length > 0) {
    // 有用户编辑过但未定稿的字段，弹出冲突对话框
    conflictFields.value = userEdited
    pendingContent.value = content
    showConflictModal.value = true
    return
  }

  // 通知父组件跳过定稿字段
  if (finalized.length > 0) {
    emit('accept-partial', content, finalized.map(f => f.fieldPath))
  } else {
    emit('accept', content)
    markGenerationAccepted()
  }
  autoFilled.value = true
}

/** 冲突对话框：采用AI内容 */
function conflictUseAI() {
  if (skippedFinalizedFields.value.length > 0) {
    emit('accept-partial', pendingContent.value, skippedFinalizedFields.value)
  } else {
    emit('accept', pendingContent.value)
  }
  markGenerationAccepted()
  autoFilled.value = true
  showConflictModal.value = false
}

/** 冲突对话框：保留原内容 */
function conflictKeepOriginal() {
  // 保留原内容，不填充
  const allSkipped = [
    ...skippedFinalizedFields.value,
    ...conflictFields.value.map(f => f.fieldPath)
  ]
  if (allSkipped.length > 0) {
    emit('accept-partial', pendingContent.value, allSkipped)
  }
  autoFilled.value = true
  showConflictModal.value = false
  message.info('已保留原有内容')
}

function copyPrompt() {
  copy(fullPromptText.value)
}

function copyEditablePrompt() {
  copy(currentUserPrompt.value)
  message.success('已复制可编辑模板')
}

/** 从 worldStore 中获取指定字段的当前内容
 * fieldPath 格式如 'mortal.present'、'upper.past' 等
 * 对应 worldStore.state.realmStructure 下的嵌套路径
 */
function getFieldCurrentContent(fieldPath: string): string | undefined {
  // 根据 moduleId 确定模块名称
  const moduleMap: Record<string, string> = {
    'realm-structure': 'realmStructure',
    'main-storyline': 'mainStoryline',
    'player-identity': 'playerIdentity',
    'hero-system': 'heroSystem',
    'castle-goddess': 'castleGoddess',
    'world-tree': 'worldTreeSystem'
  }
  const moduleName = moduleMap[props.moduleId]
  if (!moduleName) return undefined
  
  // 使用 worldStore.getFieldContent 获取字段值
  return worldStore.getFieldContent(moduleName, fieldPath)
}

/** 从 AI 生成的完整文本中解析出指定字段的内容
 * AI 输出通常使用 Markdown 格式，字段间用 ## 标题分隔
 */
function getFieldAIContent(fieldPath: string): string | undefined {
  const content = pendingContent.value
  if (!content) return undefined
  
  // 构建字段对应的中文标题映射
  const fieldToLabel: Record<string, string> = {
    'summary': '三界概述',
    'upper.past': '上界-过去',
    'upper.present': '上界-现状',
    'upper.future': '上界-未来',
    'mortal.past': '凡界-过去',
    'mortal.present': '凡界-现状',
    'mortal.future': '凡界-未来',
    'abyss.past': '深渊-过去',
    'abyss.present': '深渊-现状',
    'abyss.future': '深渊-未来',
    // main-storyline 字段映射
    'overview': '整体概述',
    'stages.0.name': '第一章节·名称',
    'stages.0.goal': '第一章节·时代背景',  // goal 对应时代背景（合并多段）
    'stages.0.events': '第一章节·核心事件',
    'stages.0.resolution': '第一章节·结局',
    'stages.1.name': '第二章节·名称',
    'stages.1.goal': '第二章节·时代背景',
    'stages.1.events': '第二章节·核心事件',
    'stages.1.resolution': '第二章节·结局',
    'stages.2.name': '第三章节·名称',
    'stages.2.goal': '第三章节·时代背景',
    'stages.2.events': '第三章节·核心事件',
    'stages.2.resolution': '第三章节·结局'
  }
  
  const label = fieldToLabel[fieldPath]
  if (!label) {
    // 如果找不到对应标签，返回完整内容（用于调试）
    return content.slice(0, 500) + (content.length > 500 ? '...' : '')
  }

  // main-storyline 模块：使用 parseSections 精确解析，支持多段合并
  if (props.moduleId === 'main-storyline' || props.moduleId.startsWith('main-storyline-')) {
    const sections = parseSections(content)
    if (fieldPath === 'overview') {
      return sections['整体概述']?.trim() || undefined
    }
    const stageMatch = fieldPath.match(/^stages\.(\d+)\.(\w+)$/)
    if (stageMatch) {
      const stageIdx = parseInt(stageMatch[1])
      const field = stageMatch[2]
      const stageLabels = ['第一', '第二', '第三']
      const prefix = stageLabels[stageIdx]
      if (!prefix) return undefined
      if (field === 'name') {
        return sections[`${prefix}章节·名称`] || sections[`${prefix}阶段-名称`] || undefined
      }
      if (field === 'goal') {
        const bg = sections[`${prefix}章节·时代背景`] || ''
        const chars = sections[`${prefix}章节·关键角色`] || ''
        const player = sections[`${prefix}章节·玩家参与`] || ''
        if (bg || chars || player) {
          return [bg, chars, player].filter(Boolean).join('\n\n').trim()
        }
        return sections[`${prefix}阶段-目标`]?.trim() || undefined
      }
      if (field === 'events') {
        return sections[`${prefix}章节·核心事件`] || sections[`${prefix}阶段-事件`] || undefined
      }
      if (field === 'resolution') {
        return sections[`${prefix}章节·结局`] || sections[`${prefix}章节·现状结局`] || sections[`${prefix}阶段-结局`] || undefined
      }
    }
    return undefined
  }

  // realm-overview 子模块
  if (props.moduleId === 'realm-overview') {
    const sections = parseSections(content)
    if (fieldPath === 'summary') {
      return sections['三界概述']?.trim() || undefined
    }
    return undefined
  }

  // realm-upper 子模块
  if (props.moduleId === 'realm-upper') {
    const sections = parseSections(content)
    if (fieldPath === 'upper.past') return sections['上界-过去']?.trim() || undefined
    if (fieldPath === 'upper.present') return sections['上界-现状']?.trim() || undefined
    if (fieldPath === 'upper.future') return sections['上界-未来']?.trim() || undefined
    return undefined
  }

  // realm-mortal 子模块
  if (props.moduleId === 'realm-mortal') {
    const sections = parseSections(content)
    if (fieldPath === 'mortal.past') return sections['凡界-过去']?.trim() || undefined
    if (fieldPath === 'mortal.present') return sections['凡界-现状']?.trim() || undefined
    if (fieldPath === 'mortal.future') return sections['凡界-未来']?.trim() || undefined
    return undefined
  }

  // realm-abyss 子模块
  if (props.moduleId === 'realm-abyss') {
    const sections = parseSections(content)
    if (fieldPath === 'abyss.past') return sections['深渊-过去']?.trim() || undefined
    if (fieldPath === 'abyss.present') return sections['深渊-现状']?.trim() || undefined
    if (fieldPath === 'abyss.future') return sections['深渊-未来']?.trim() || undefined
    return undefined
  }

  // 其他模块：使用正则匹配

  // 尝试从 AI 输出中解析对应字段的内容
  // 匹配模式：## 上界-过去 或 ##上界-过去 后的内容，直到下一个 ## 或文件结束
  const patterns = [
    new RegExp(`##\\s*${label}\\s*\\n+([\\s\\S]*?)(?=##|$)`, 'i'),
    new RegExp(`【${label}】\\s*\\n+([\\s\\S]*?)(?=【|$)`, 'i'),
    new RegExp(`${label}[：:]\\s*\\n*([\\s\\S]*?)(?=\\n##|\\n【|$)`, 'i')
  ]
  
  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // 如果精确匹配失败，返回完整内容并提示用户
  return content.slice(0, 500) + (content.length > 500 ? '... (内容较长，请查看完整输出)' : '')
}
</script>

<template>
  <div class="ai-section" :class="{ 'is-collapsed': !isForgeOpen }">
    <button
      type="button"
      class="ai-forge-toggle"
      :aria-expanded="isForgeOpen"
      @click="toggleForgePanel"
    >
      <span class="ai-forge-toggle__main">
        <span class="ai-forge-toggle__title">生成舱</span>
        <span class="ai-forge-toggle__meta">
          {{ forgeStateLabel }} · {{ generationModeLabel }} · {{ estimatedTokens.toLocaleString() }} tokens
        </span>
      </span>
      <span class="ai-forge-toggle__action">{{ isForgeOpen ? '收起' : '展开' }}</span>
    </button>

    <div v-show="isForgeOpen" class="ai-section-body">
    <div class="ai-section-header">
      <h4>AI Forge · 生成舱</h4>
      <NSpace :size="6" align="center">
        <template v-if="!generateOnly">
          <NTag v-if="hasCustomPrompt" type="success" size="small" style="font-size: 11px;">
            自定义
          </NTag>
          <NTag v-else type="default" size="small" style="font-size: 11px;">
            默认
          </NTag>
          <NButton v-if="isLocalUser" size="tiny" quaternary @click="openEditModal">
            编辑Prompt
          </NButton>
        </template>
        <NButton v-if="isLocalUser" size="tiny" quaternary @click="showPromptModal = true">
          查看Prompt
        </NButton>
        <NButton v-if="isLocalUser" size="tiny" quaternary @click="copyPrompt">
          {{ copied ? '已复制!' : '复制Prompt' }}
        </NButton>
      </NSpace>
    </div>

    <div class="ai-status-rail">
      <div>
        <span>当前模式</span>
        <strong>{{ generationMode === 'full' ? '全新生成' : generationMode === 'continue' ? '续写补完' : '扩展深化' }}</strong>
      </div>
      <div>
        <span>Prompt 预算</span>
        <strong>{{ estimatedTokens.toLocaleString() }} / {{ contextLimit.toLocaleString() }}</strong>
      </div>
      <div>
        <span>上下文类型</span>
        <strong>{{ categoryLabel || '基础模块' }}</strong>
      </div>
    </div>

    <!-- 生成模式切换 -->
    <div v-if="!generateOnly" class="generation-mode-section">
      <div class="mode-switch" role="group" aria-label="生成模式">
        <button type="button" :class="{ active: generationMode === 'full' }" @click="generationMode = 'full'">
          <span>全新</span>
          <em>重铸本段</em>
        </button>
        <button type="button" :class="{ active: generationMode === 'continue' }" @click="generationMode = 'continue'">
          <span>续写</span>
          <em>补空保留</em>
        </button>
        <button type="button" :class="{ active: generationMode === 'expand' }" @click="generationMode = 'expand'">
          <span>扩展</span>
          <em>深化追加</em>
        </button>
      </div>
      <div class="mode-hint">
        <span v-if="generationMode === 'full'">重新生成全部内容（定稿字段仍受保护）</span>
        <span v-else-if="generationMode === 'continue'">保留已确认内容，输出可直接覆盖草稿/空白字段的完整稿</span>
        <span v-else>整合现有内容并深化，输出可直接覆盖字段的完整稿</span>
      </div>
    </div>

    <!-- 附加需求区域 -->
    <NCollapse :default-expanded-names="showRequirements ? ['req'] : []" style="margin-bottom: 8px;">
      <NCollapseItem title="附加需求（可选）" name="req">
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <NInput
            v-model:value="additionalInput"
            type="textarea"
            placeholder="输入甲方需求或特殊要求..."
            :autosize="{ minRows: 2, maxRows: 5 }"
            style="flex: 1;"
          />
        </div>
        <NSpace :size="6" style="margin-bottom: 8px;">
          <NButton size="tiny" @click="addRequirementFromInput" :disabled="!additionalInput.trim()">保存到历史</NButton>
          <label style="display: inline-block;">
            <NButton size="tiny" tag="div">导入.txt文件</NButton>
            <input type="file" accept=".txt" style="display:none;" @change="handleFileUpload" />
          </label>
        </NSpace>
        <!-- 需求历史 -->
        <div v-if="requirementsHistory.length > 0" style="font-size: 12px;">
          <div style="color: var(--color-text-secondary); margin-bottom: 4px;">最近需求历史：</div>
          <div
            v-for="req in requirementsHistory"
            :key="req.id"
            style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); margin-bottom: 4px;"
          >
            <NTag v-if="req.source === 'file'" size="small" type="info">{{ req.fileName }}</NTag>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ req.content.slice(0, 60) }}{{ req.content.length > 60 ? '...' : '' }}</span>
            <NButton size="tiny" quaternary @click="useRequirement(req)">使用</NButton>
            <NButton size="tiny" quaternary type="error" @click="removeRequirement(req.id)">删除</NButton>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>

    <!-- 上下文管理（高级） -->
    <NCollapse style="margin-bottom: 8px;">
      <NCollapseItem title="上下文管理（高级）" name="context-mgmt">
        <div style="font-size: 12px; color: var(--text-color-3, var(--color-text-tertiary)); margin-bottom: 8px;">
          当前模块类别：<NTag size="tiny" :bordered="false">{{ categoryLabel }}</NTag>。以下为自动注入的上下文来源及 Token 消耗。
        </div>
        <div v-if="contextSources.length === 0" style="font-size: 12px; color: var(--text-color-3, var(--color-text-tertiary));">
          当前模块为基础设定模块，无外部上下文依赖。
        </div>
        <div v-for="(item, index) in contextSources" :key="index"
             style="display: flex; align-items: center; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-color, var(--color-border));">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>{{ item.label }}</span>
            <NTag size="tiny" :type="item.priority === 'critical' ? 'error' : item.priority === 'high' ? 'warning' : 'default'" :bordered="false">
              {{ item.priority }}
            </NTag>
          </div>
          <span style="font-size: 11px; color: var(--text-color-3, var(--color-text-tertiary));">~{{ item.tokens }} chars</span>
        </div>
      </NCollapseItem>
    </NCollapse>

    <!-- Token计数预警 -->
    <div class="token-warning-bar">
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
        <span>预估Token: <strong>{{ estimatedTokens.toLocaleString() }}</strong> / {{ contextLimit.toLocaleString() }}</span>
        <NTag v-if="wasTrimmed" size="small" type="warning">已裁剪</NTag>
        <NTag v-if="tokenWarningLevel === 'danger'" size="small" type="error">超限风险</NTag>
        <NTag v-else-if="tokenWarningLevel === 'warning'" size="small" type="warning">接近上限</NTag>
      </div>
      <!-- Token 分层明细 -->
      <div v-if="promptBuildResult?.systemTokens" style="font-size: 11px; color: var(--text-color-3, var(--color-text-tertiary)); margin-top: 2px;">
        系统提示 {{ promptBuildResult.systemTokens.toLocaleString() }} + 上下文 {{ (promptBuildResult.contextTokens || 0).toLocaleString() }} + 模板 {{ (promptBuildResult.templateTokens || 0).toLocaleString() }} tokens
        <NTag v-if="promptBuildResult.category" size="tiny" :bordered="false" style="margin-left: 6px;">{{ categoryLabel }}</NTag>
      </div>
      <NProgress
        :percentage="tokenPercentage"
        :status="tokenWarningLevel === 'danger' ? 'error' : tokenWarningLevel === 'warning' ? 'warning' : 'success'"
        :show-indicator="false"
        :height="6"
      />
      <div v-if="tokenWarningLevel === 'danger'" style="font-size: 11px; color: var(--color-error); margin-top: 2px;">
        Prompt已超过模型上限的95%，建议：
        <ul style="margin: 4px 0; padding-left: 16px;">
          <li v-if="recommendedModel">切换到 {{ recommendedModel }}（上下文窗口更大）</li>
          <li>精简附加需求内容</li>
          <li v-if="(promptBuildResult?.contextTokens || 0) > 3000">当前上下文占用 {{ promptBuildResult?.contextTokens?.toLocaleString() }} tokens，可在上下文管理中排除非必要来源</li>
        </ul>
      </div>
      <div v-else-if="tokenWarningLevel === 'warning'" style="font-size: 11px; color: var(--color-warning); margin-top: 2px;">
        接近模型上限，已自动裁剪部分上下文
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="generate-action-row">
      <NButton
        size="large"
        type="primary"
        :loading="isStreaming"
        :disabled="!aiStore.isConfigured"
        @click="handleGenerate"
      >
        {{ generationMode === 'full' ? 'AI 生成' : generationMode === 'continue' ? 'AI 续写' : 'AI 扩展' }}
      </NButton>
    </div>

    <!-- 上下文标签 -->
    <div v-if="contextLabels?.length" class="context-tags">
      <span v-for="label in contextLabels" :key="label" class="context-tag">引用: {{ label }}</span>
    </div>

    <!-- 提示词不可用提示 -->
    <div v-if="!aiStore.isConfigured && isLocalUser" class="ai-config-hint">
      未配置API Key，可点击“复制Prompt”到外部AI工具使用
    </div>

    <!-- Prompt 预览弹窗 -->
    <NModal
      v-model:show="showPromptModal"
      preset="card"
      title="Prompt 预览"
      style="width: 900px; max-width: 90vw;"
      :mask-closable="false"
    >
      <div style="max-height: 60vh; overflow-y: auto;">
        <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 10px;">
          “可编辑模板”与“编辑Prompt”弹窗内容一致；“完整发送Prompt”是 AI 生成时实际使用的系统提示、上下文、模板与输出格式的组合。
        </div>
        <div style="font-size: 12px; color: var(--color-text-tertiary); margin: 0 0 6px;">
          可编辑模板（与“编辑Prompt”一致）
        </div>
        <div style="white-space: pre-wrap; font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.6; max-height: 220px; overflow-y: auto; padding: 12px; background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-bottom: 14px;">
          {{ editablePromptPreview }}
        </div>
        <div style="font-size: 12px; color: var(--color-text-tertiary); margin: 0 0 6px;">
          完整发送Prompt（AI生成实际使用）
        </div>
        <div style="white-space: pre-wrap; font-family: var(--font-mono, monospace); font-size: 13px; line-height: 1.6; max-height: 45vh; overflow-y: auto; padding: 12px; background: var(--color-bg-secondary); border-radius: var(--radius-md);">
          {{ fullPromptText }}
        </div>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showPromptModal = false">关闭</NButton>
          <NButton @click="copyEditablePrompt">
            复制可编辑模板
          </NButton>
          <NButton type="primary" @click="copyPrompt">
            {{ copied ? '已复制!' : '复制完整Prompt' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 错误 -->
    <div v-if="error" class="ai-error">{{ error }}</div>

    <!-- 自动填充提示 -->
    <div v-if="autoFilled && !isStreaming && !generateOnly" class="auto-fill-notice">
      已自动填充到上方编辑框，数据已自动保存
    </div>

    <!-- 结果 -->
    <div v-if="result || isStreaming" class="ai-result">
      <NSpin v-if="isStreaming && !result" size="small" />
      <div style="white-space:pre-wrap;">{{ result }}</div>
    </div>

    <!-- Token 消耗 (Kimi) -->
    <div v-if="tokenUsage && !isStreaming" class="token-usage-info">
      Token 消耗：提示 {{ tokenUsage.promptTokens }} + 生成 {{ tokenUsage.completionTokens }} = 共 {{ tokenUsage.totalTokens }}
      <span v-if="tokenUsage.cachedTokens">（缓存 {{ tokenUsage.cachedTokens }}）</span>
    </div>

    <!-- 操作按钮 -->
    <div v-if="result && !isStreaming" class="ai-result-actions">
      <NSpace :size="8" justify="end">
        <NButton size="small" @click="result = ''; autoFilled = false">清除</NButton>
        <NButton v-if="!generateOnly" size="small" type="primary" @click="handleAccept">重新填充到编辑器</NButton>
      </NSpace>
    </div>
    </div>

    <!-- Prompt编辑弹窗 -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      :title="`编辑Prompt - ${originalTemplate?.moduleLabel || props.moduleId}`"
      style="width: 1100px; max-width: 90vw; max-height: 85vh;"
      :mask-closable="false"
    >
      <div style="margin-bottom: 16px; max-height: calc(85vh - 180px); overflow-y: auto;">
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px;">
          编辑以下用户Prompt模板，保存后将用于该模块的AI生成；查看Prompt中的“可编辑模板”会显示同一段内容。系统提示、上下文和输出格式会在生成时自动组装。
        </div>
        <textarea
          v-model="editedPrompt"
          style="width: 100%; min-height: 500px; padding: 12px; font-size: 14px; line-height: 1.6; border: 1px solid var(--color-border); border-radius: var(--radius-md); resize: vertical; font-family: var(--font-sans);"
          placeholder="请输入Prompt内容..."
        />
      </div>

      <div v-if="hasCustomPrompt" style="margin-bottom: 16px; padding: 12px; background: var(--color-bg-secondary); border-radius: var(--radius-md);">
        <div style="font-size: 12px; color: var(--color-text-secondary);">
          <span style="color: var(--color-success);">●</span> 当前使用的是自定义Prompt
        </div>
      </div>

      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <NButton
            v-if="hasCustomPrompt"
            size="small"
            type="error"
            ghost
            @click="restoreDefaultPrompt"
          >
            恢复默认
          </NButton>
          <div v-else></div>
          <NSpace>
            <NButton @click="closeEditModal">取消</NButton>
            <NButton type="primary" @click="saveCustomPrompt">保存</NButton>
          </NSpace>
        </div>
      </template>
    </NModal>

    <!-- 冲突检测对话框 -->
    <NModal
      v-model:show="showConflictModal"
      preset="card"
      title="内容冲突检测"
      style="width: 900px; max-width: 90vw; max-height: 85vh;"
      :mask-closable="false"
    >
      <div style="margin-bottom: 16px; max-height: calc(85vh - 140px); overflow-y: auto;">
        <p style="font-size: 14px; margin-bottom: 12px;">以下字段已被用户编辑过，AI生成的内容可能与其冲突：</p>
        <NCollapse>
          <NCollapseItem
            v-for="field in conflictFields"
            :key="field.fieldPath"
            :title="field.label"
          >
            <template #header-extra>
              <NTag size="small" type="warning">{{ field.meta.lastEditSource === 'user' ? '用户编辑' : 'AI生成' }}</NTag>
            </template>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <!-- 当前内容 -->
              <div>
                <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 500;">当前内容</div>
                <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.5; max-height: 200px; overflow-y: auto; padding: 10px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
                  {{ getFieldCurrentContent(field.fieldPath) || '(空)' }}
                </div>
              </div>
              <!-- AI生成内容 -->
              <div>
                <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; font-weight: 500;">AI 生成内容</div>
                <div style="white-space: pre-wrap; font-size: 13px; line-height: 1.5; max-height: 200px; overflow-y: auto; padding: 10px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); border-left: 3px solid var(--color-success);">
                  {{ getFieldAIContent(field.fieldPath) || '(空)' }}
                </div>
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </div>

      <template #footer>
        <NSpace justify="end">
          <NButton @click="conflictKeepOriginal">保留原内容</NButton>
          <NButton type="primary" @click="conflictUseAI">采用AI内容</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.ai-forge-toggle {
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(236, 204, 142, 0.13);
  background:
    linear-gradient(90deg, rgba(248, 207, 122, 0.14), rgba(90, 132, 114, 0.08), transparent),
    rgba(255, 240, 200, 0.028);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 54px;
  padding: 12px 18px;
  cursor: pointer;
  text-align: left;
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
}

.ai-forge-toggle:hover,
.ai-forge-toggle:focus-visible {
  background:
    linear-gradient(90deg, rgba(248, 207, 122, 0.2), rgba(90, 132, 114, 0.1), transparent),
    rgba(255, 240, 200, 0.045);
  border-bottom-color: rgba(248, 207, 122, 0.28);
  color: var(--epic-halo);
  outline: none;
}

.ai-forge-toggle__main {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.ai-forge-toggle__title {
  flex: 0 0 auto;
  color: var(--epic-halo);
  font-family: var(--font-display-epic);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

.ai-forge-toggle__meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-tertiary);
  font-size: 12px;
  letter-spacing: 0.06em;
}

.ai-forge-toggle__action {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 3px 9px;
  border: 1px solid rgba(248, 207, 122, 0.32);
  background: rgba(248, 207, 122, 0.08);
  color: var(--color-accent-gold-light);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
}

.ai-section.is-collapsed .ai-forge-toggle {
  border-bottom-color: transparent;
}

.ai-section-body {
  padding-bottom: 18px;
}

.ai-status-rail {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 0 18px 14px;
  border: 1px solid rgba(236, 204, 142, 0.13);
  background: rgba(255, 240, 200, 0.04);
}

.ai-status-rail > div {
  min-width: 0;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.18);
}

.ai-status-rail span {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  letter-spacing: 0.14em;
}

.ai-status-rail strong {
  display: block;
  margin-top: 3px;
  color: var(--epic-halo);
  font-family: var(--font-display-epic);
  font-size: 13px;
  letter-spacing: 0.08em;
}

.generation-mode-section {
  margin: 0 18px 12px;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.mode-switch button {
  min-height: 58px;
  border: 1px solid rgba(236, 204, 142, 0.16);
  background: rgba(255, 240, 200, 0.035);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
  padding: 9px 12px;
  transition: 180ms ease;
}

.mode-switch button:hover,
.mode-switch button.active {
  border-color: rgba(248, 207, 122, 0.55);
  background: linear-gradient(180deg, rgba(248, 207, 122, 0.15), rgba(255, 240, 200, 0.04));
  color: var(--epic-halo);
  box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.08), 0 0 18px -12px rgba(248, 207, 122, 0.9);
}

.mode-switch span {
  display: block;
  font-family: var(--font-display-epic);
  font-size: 13px;
  letter-spacing: 0.18em;
}

.mode-switch em {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-style: normal;
}

.mode-hint {
  margin-top: 7px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.token-warning-bar {
  margin: 0 18px 12px;
  padding: 12px;
  border: 1px solid rgba(236, 204, 142, 0.12);
  background: rgba(0, 0, 0, 0.16);
}

.generate-action-row {
  margin: 0 18px 14px;
  text-align: right;
}

.ai-config-hint,
.ai-error,
.ai-result-actions {
  margin: 0 18px 8px;
}

.ai-config-hint {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.ai-error {
  color: var(--color-error);
  font-size: 13px;
}

.ai-result-actions {
  text-align: right;
}

.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 11px;
  color: var(--color-warning, #d4a853);
  cursor: help;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.info-icon:hover {
  opacity: 1;
}

@media (max-width: 820px) {
  .ai-status-rail,
  .mode-switch {
    grid-template-columns: 1fr;
  }

  .ai-forge-toggle,
  .ai-forge-toggle__main {
    align-items: flex-start;
  }

  .ai-forge-toggle__main {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
