<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NProgress, NButton, NTag, NSpace } from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import { ASSESSMENT_DIMENSIONS } from '@/constants/assessment'
import type { EvalProvider, AssessmentDimensionId } from '@/types/assessment'

const router = useRouter()
const assessmentStore = useAssessmentStore()

// 总进度
const totalProgress = computed(() => assessmentStore.progressPercentage)

// 模型列表
const models: { provider: EvalProvider; name: string }[] = [
  { provider: 'qwen', name: 'Qwen3.6-Plus' },
  { provider: 'doubao', name: '豆包' },
  { provider: 'minimax', name: 'Minimax' }
]

// 获取模型状态标签类型
function getStatusType(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'info'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
}

// 获取模型状态文本
function getStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return '已完成'
    case 'running':
      return '评测中'
    case 'error':
      return '出错'
    default:
      return '待评测'
  }
}

// 获取维度状态
function getDimensionStatus(provider: EvalProvider, dimensionId: AssessmentDimensionId): 'pending' | 'running' | 'completed' {
  const progress = assessmentStore.assessmentProgress.modelProgress[provider]
  if (progress.completedDimensions.includes(dimensionId)) {
    return 'completed'
  }
  if (progress.status === 'running' && assessmentStore.assessmentProgress.currentModel === provider) {
    return 'running'
  }
  return 'pending'
}

// 取消评测
function cancelAssessment() {
  assessmentStore.isAssessing = false
  assessmentStore.resetProgress()
  router.push('/assessment/start')
}
</script>

<template>
  <div class="content-section">
    <h2>评测进行中</h2>
    <p class="section-desc">
      多模型并行评测世界观设计质量
    </p>

    <!-- 总进度 -->
    <NCard style="margin-bottom: 20px;">
      <div style="margin-bottom: 12px;">
        <span style="font-size: 14px; font-weight: 500;">总体进度</span>
        <span style="float: right; font-size: 14px; color: var(--color-text-secondary);">
          {{ assessmentStore.assessmentProgress.completedSteps }} / {{ assessmentStore.assessmentProgress.totalSteps }}
        </span>
      </div>
      <NProgress
        type="line"
        :percentage="totalProgress"
        :height="12"
        :border-radius="6"
        :indicator-placement="'inside'"
        :processing="true"
      />
    </NCard>

    <!-- 三列模型进度 -->
    <div class="model-progress-grid">
      <NCard
        v-for="model in models"
        :key="model.provider"
        :title="model.name"
        size="small"
      >
        <div style="margin-bottom: 16px;">
          <NTag
            :type="getStatusType(assessmentStore.assessmentProgress.modelProgress[model.provider].status)"
            size="small"
          >
            {{ getStatusText(assessmentStore.assessmentProgress.modelProgress[model.provider].status) }}
          </NTag>
        </div>

        <div class="dimension-list">
          <div
            v-for="dim in ASSESSMENT_DIMENSIONS"
            :key="dim.id"
            class="dimension-item"
          >
            <span class="dimension-status">
              <span
                v-if="getDimensionStatus(model.provider, dim.id) === 'completed'"
                class="status-icon completed"
              >✓</span>
              <span
                v-else-if="getDimensionStatus(model.provider, dim.id) === 'running'"
                class="status-icon running"
              >⟳</span>
              <span
                v-else
                class="status-icon pending"
              >○</span>
            </span>
            <span class="dimension-name">{{ dim.displayName }}</span>
            <span class="dimension-weight">{{ dim.weight }}分</span>
          </div>
        </div>
      </NCard>
    </div>

    <!-- 底部操作 -->
    <div style="margin-top: 24px; text-align: center;">
      <NButton @click="cancelAssessment">
        取消评测
      </NButton>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="assessmentStore.currentError"
      style="margin-top: 20px; padding: 12px; background: rgba(212, 90, 58, 0.1); border: 1px solid rgba(212, 90, 58, 0.25); border-radius: var(--radius-md); color: var(--color-error);"
    >
      {{ assessmentStore.currentError }}
    </div>
  </div>
</template>

<style scoped>
.model-progress-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 900px) {
  .model-progress-grid {
    grid-template-columns: 1fr;
  }
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dimension-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.dimension-status {
  flex-shrink: 0;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon {
  font-size: 13px;
  font-weight: bold;
}

.status-icon.completed {
  color: var(--color-success);
}

.status-icon.running {
  color: var(--color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-icon.pending {
  color: var(--color-text-tertiary);
}

.dimension-name {
  flex: 1;
  color: var(--color-text);
}

.dimension-weight {
  color: var(--color-text-tertiary);
  font-size: 13px;
}
</style>
