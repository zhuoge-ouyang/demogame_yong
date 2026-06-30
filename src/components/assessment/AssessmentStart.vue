<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NRadioGroup, NRadioButton, NButton, NTag, NSpace, NAlert, NProgress, useMessage } from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import { useWorldStore } from '@/stores/world'
import { useContinentsStore } from '@/stores/continents'
import { useLandingStore } from '@/stores/landing'
import { runFullAssessment, collectPhaseData } from '@/services/assessment-evaluator'
import { checkNeedsOptimization } from '@/constants/assessment'
import type { AssessmentReport } from '@/types/assessment'
import EvalConfigModal from '@/components/shared/EvalConfigModal.vue'
import { useLocalAccess } from '@/composables/useLocalAccess'

const router = useRouter()
const message = useMessage()
const { isLocalUser } = useLocalAccess()
const assessmentStore = useAssessmentStore()
const worldStore = useWorldStore()
const continentsStore = useContinentsStore()
const landingStore = useLandingStore()

const selectedPhase = ref<1 | 2 | 3>(1)

function handlePhaseChange(val: 1 | 2 | 3) {
  if (val === 2 || val === 3) {
    message.warning(`Phase ${val} 内容暂不开放`, { duration: 2500 })
    return
  }
  selectedPhase.value = val
}
const showConfigModal = ref(false)
const isStarting = ref(false)
const startError = ref('')

// 阶段选项
const phaseOptions = [
  { label: 'Phase 1 - 世界框架', value: 1 },
  { label: 'Phase 2 - 九大陆', value: 2 },
  { label: 'Phase 3 - 前三大陆落地', value: 3 }
]

// 获取阶段完成度
const phaseCompletion = computed(() => {
  switch (selectedPhase.value) {
    case 1:
      return worldStore.completionPercentage
    case 2:
      return continentsStore.overallCompletion
    case 3:
      return landingStore.overallCompletion
    default:
      return 0
  }
})

// 模型配置状态
const modelStatuses = computed(() => {
  return assessmentStore.evalConfigs.map(config => ({
    provider: config.provider,
    label: config.label,
    configured: !!config.apiKey
  }))
})

// Kimi配置状态
const kimiConfigured = computed(() => !!assessmentStore.kimiConfig.apiKey)

// 是否至少有一个评测模型已配置
const hasAnyModelConfigured = computed(() => {
  return assessmentStore.evalConfigs.some(c => !!c.apiKey)
})

// 是否可以开始评测
const canStart = computed(() => {
  return hasAnyModelConfigured.value && phaseCompletion.value > 0
})

// 获取阶段数据快照
function getPhaseDataSnapshot(phase: 1 | 2 | 3): string {
  return collectPhaseData(
    phase,
    worldStore.state,
    continentsStore.state,
    landingStore.state
  )
}

// 开始评测
async function startAssessment() {
  if (!canStart.value) return

  isStarting.value = true
  startError.value = ''

  try {
    // 重置进度
    assessmentStore.isAssessing = true
    assessmentStore.resetProgress()

    // 收集数据
    const dataSnapshot = getPhaseDataSnapshot(selectedPhase.value)

    // 创建报告
    const report: AssessmentReport = {
      id: Date.now().toString(),
      phase: selectedPhase.value,
      createdAt: Date.now(),
      phaseCompletion: phaseCompletion.value,
      modelResults: [],
      averageScore: 0,
      needsOptimization: false,
      optimizationTriggers: [],
      status: 'running'
    }
    assessmentStore.addReport(report)

    // 跳转到进度页
    router.push('/assessment/progress')

    // 执行评测
    const configs = assessmentStore.evalConfigs.filter(c => c.apiKey)
    const results = await runFullAssessment(
      configs,
      dataSnapshot,
      (provider, dimId) => assessmentStore.updateModelProgress(provider, 'running', dimId)
    )

    // 更新模型状态为完成
    for (const provider of ['qwen', 'doubao', 'minimax'] as const) {
      if (configs.find(c => c.provider === provider)) {
        assessmentStore.updateModelProgress(provider, 'completed')
      }
    }

    // 计算结果
    const totalScore = results.length > 0
      ? results.reduce((s, r) => s + r.totalScore, 0) / results.length
      : 0
    const { needed, triggers } = checkNeedsOptimization(results)

    // 更新报告
    assessmentStore.updateReport(report.id, {
      modelResults: results,
      averageScore: Math.round(totalScore),
      needsOptimization: needed,
      optimizationTriggers: triggers,
      status: needed && assessmentStore.kimiConfig.apiKey ? 'optimizing' : 'completed'
    })

    // 跳转到结果页
    router.push(`/assessment/result/${report.id}`)
  } catch (e: any) {
    startError.value = e.message || '评测启动失败'
    assessmentStore.currentError = e.message
    assessmentStore.isAssessing = false
  } finally {
    isStarting.value = false
  }
}
</script>

<template>
  <div class="content-section">
    <h2>世界观质量评测</h2>
    <p class="section-desc">
      使用多模型交叉评测，从7个维度评估世界观设计质量
    </p>

    <!-- 阶段选择 -->
    <NCard title="选择评测阶段" style="margin-bottom: 20px;">
      <NRadioGroup :value="selectedPhase" size="large" @update:value="handlePhaseChange">
        <NRadioButton
          v-for="opt in phaseOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </NRadioButton>
      </NRadioGroup>

      <div style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 13px; color: var(--color-text-secondary);">
            当前阶段完成度
          </span>
          <span style="font-size: 13px; font-weight: 500;">{{ phaseCompletion }}%</span>
        </div>
        <NProgress
          type="line"
          :percentage="phaseCompletion"
          :height="8"
          :border-radius="4"
          :show-indicator="false"
        />
        <NAlert
          v-if="phaseCompletion === 0"
          type="warning"
          size="small"
          style="margin-top: 12px;"
        >
          当前阶段暂无内容，请先完成阶段内容填写
        </NAlert>
      </div>
    </NCard>

    <!-- API配置状态 -->
    <NCard v-if="isLocalUser" title="模型配置状态" style="margin-bottom: 20px;">
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
          评测模型（至少配置一个）
        </div>
        <NSpace>
          <NTag
            v-for="model in modelStatuses"
            :key="model.provider"
            :type="model.configured ? 'success' : 'error'"
            size="large"
          >
            {{ model.label }}
            <template #icon>
              <span style="margin-right: 4px;">{{ model.configured ? '✓' : '✗' }}</span>
            </template>
          </NTag>
        </NSpace>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
          分析模型（可选，用于低分深度分析）
        </div>
        <NTag :type="kimiConfigured ? 'success' : 'warning'" size="large">
          Kimi 2.5
          <template #icon>
            <span style="margin-right: 4px;">{{ kimiConfigured ? '✓' : '○' }}</span>
          </template>
        </NTag>
      </div>

      <NButton @click="showConfigModal = true">
        配置API
      </NButton>
    </NCard>

    <!-- 开始评测 -->
    <NCard>
      <NAlert
        v-if="startError"
        type="error"
        style="margin-bottom: 16px;"
      >
        {{ startError }}
      </NAlert>

      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">
            开始评测
          </div>
          <div style="font-size: 13px; color: var(--color-text-secondary);">
            预计耗时 1-3 分钟，将消耗约 50K Token
          </div>
        </div>
        <NButton
          type="primary"
          size="large"
          :loading="isStarting"
          :disabled="!canStart"
          @click="startAssessment"
        >
          开始评测
        </NButton>
      </div>

      <NAlert
        v-if="!hasAnyModelConfigured && isLocalUser"
        type="warning"
        size="small"
        style="margin-top: 16px;"
      >
        请至少配置一个评测模型的API Key
      </NAlert>
    </NCard>

    <!-- 配置弹窗 -->
    <EvalConfigModal
      v-if="isLocalUser"
      :show="showConfigModal"
      @update:show="showConfigModal = $event"
    />
  </div>
</template>
