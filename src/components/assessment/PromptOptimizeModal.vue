<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NCard, NButton, NSpace, NAlert } from 'naive-ui'
import { useAssessmentStore } from '@/stores/assessment'
import type { AssessmentReport } from '@/types/assessment'

const props = defineProps<{
  show: boolean
  report: AssessmentReport
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'regenerate'): void
}>()

const assessmentStore = useAssessmentStore()

// Kimi分析结果
const kimiAnalysis = computed(() => props.report.kimiAnalysis)

// 优化后的提示词
const optimizedPrompts = computed(() => {
  return kimiAnalysis.value?.optimizedPrompts || {}
})

// 是否有优化提示词
const hasOptimizedPrompts = computed(() => {
  return Object.keys(optimizedPrompts.value).length > 0
})

// 获取原始提示词（简化实现）
function getOriginalPrompt(moduleId: string): string {
  // 这里应该从prompts服务获取原始提示词
  return `// 原始提示词: ${moduleId}\n// 请在实际实现中从prompts服务获取`
}

// 使用新提示词重新生成
function useNewPromptsAndRegenerate() {
  if (kimiAnalysis.value) {
    assessmentStore.setOptimizedPrompts(kimiAnalysis.value.optimizedPrompts)
  }
  emit('update:show', false)
  emit('regenerate')
}

// 仅保存提示词
function savePromptsOnly() {
  if (kimiAnalysis.value) {
    assessmentStore.setOptimizedPrompts(kimiAnalysis.value.optimizedPrompts)
  }
  emit('update:show', false)
}

// 关闭弹窗
function closeModal() {
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="$event => emit('update:show', $event)"
    preset="card"
    title="提示词优化建议"
    style="width: 800px; max-width: 90vw; max-height: 80vh;"
  >
    <!-- 分析摘要 -->
    <div v-if="kimiAnalysis" style="margin-bottom: 20px;">
      <NAlert type="info" style="margin-bottom: 16px;">
        <div style="font-size: 13px; line-height: 1.6;">
          <strong>根因分析：</strong>{{ kimiAnalysis.rootCauses.join('；') }}
        </div>
      </NAlert>

      <div v-if="kimiAnalysis.weakDimensions.length > 0" style="margin-bottom: 16px;">
        <strong style="font-size: 13px;">薄弱维度：</strong>
        <NSpace style="margin-top: 8px;">
          <NTag
            v-for="dimId in kimiAnalysis.weakDimensions"
            :key="dimId"
            type="warning"
            size="small"
          >
            {{ dimId }}
          </NTag>
        </NSpace>
      </div>
    </div>

    <!-- 提示词对比 -->
    <div v-if="hasOptimizedPrompts" style="margin-bottom: 20px;">
      <div
        v-for="(prompt, moduleId) in optimizedPrompts"
        :key="moduleId"
        style="margin-bottom: 20px;"
      >
        <h4 style="margin-bottom: 12px; font-size: 14px;">{{ moduleId }}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- 原始提示词 -->
          <NCard title="原始提示词" size="small" style="background: var(--color-bg-secondary);">
            <pre style="margin: 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto;">{{ getOriginalPrompt(moduleId) }}</pre>
          </NCard>

          <!-- 优化后提示词 -->
          <NCard title="优化后提示词" size="small" style="background: rgba(58, 158, 92, 0.08);">
            <pre style="margin: 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto;">{{ prompt }}</pre>
          </NCard>
        </div>
      </div>
    </div>

    <div v-else style="text-align: center; padding: 40px; color: var(--color-text-secondary);">
      暂无优化后的提示词
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div style="display: flex; justify-content: flex-end; gap: 12px;">
        <NButton text @click="closeModal">
          暂不修改
        </NButton>
        <NButton @click="savePromptsOnly">
          仅保存提示词
        </NButton>
        <NButton type="primary" @click="useNewPromptsAndRegenerate">
          使用新提示词重新生成
        </NButton>
      </div>
    </template>
  </NModal>
</template>
