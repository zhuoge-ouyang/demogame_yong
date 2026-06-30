<script setup lang="ts">
import { computed } from 'vue'
import { NCollapse, NCollapseItem, NInput, NButton, NSpace } from 'naive-ui'
import { useWorldStore } from '@/stores/world'

const props = defineProps<{
  moduleId: string
}>()

const worldStore = useWorldStore()

// 当前模块的摘要
const summary = computed({
  get: () => worldStore.getModuleSummary(props.moduleId),
  set: (val: string) => worldStore.setModuleSummary(props.moduleId, val)
})

// 字数统计
const charCount = computed(() => summary.value.length)

// 建议字数范围
const MIN_CHARS = 300
const MAX_CHARS = 500

// 字数状态提示
const countStatus = computed(() => {
  if (charCount.value === 0) return 'normal'
  if (charCount.value < MIN_CHARS) return 'warning'
  if (charCount.value > MAX_CHARS) return 'error'
  return 'success'
})

// 字数状态文本
const countStatusText = computed(() => {
  if (charCount.value === 0) return ''
  if (charCount.value < MIN_CHARS) return `（建议至少 ${MIN_CHARS} 字）`
  if (charCount.value > MAX_CHARS) return `（建议不超过 ${MAX_CHARS} 字）`
  return '（符合建议范围）'
})

// 清除摘要
function clearSummary() {
  worldStore.clearModuleSummary(props.moduleId)
}
</script>

<template>
  <div class="module-summary-editor">
    <NCollapse>
      <NCollapseItem title="模块审核摘要（可选）">
        <div class="summary-content">
          <NInput
            v-model:value="summary"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            :maxlength="1000"
            placeholder="请输入该模块的审核摘要，供其他模块生成时引用..."
          />
          
          <div class="summary-footer">
            <NSpace align="center" justify="space-between" style="width: 100%">
              <div class="char-count" :class="countStatus">
                <span class="count-number">{{ charCount }}</span>
                <span class="count-label">字</span>
                <span v-if="countStatusText" class="count-hint">{{ countStatusText }}</span>
              </div>
              <NButton
                size="small"
                quaternary
                :disabled="!summary"
                @click="clearSummary"
              >
                清除
              </NButton>
            </NSpace>
          </div>
          
          <div class="summary-tip">
            <span class="tip-icon">💡</span>
            <span class="tip-text">
              设定审核摘要后，其他模块在生成时将引用此摘要作为上下文，而非全文内容。留空则自动提取。
            </span>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.module-summary-editor {
  margin-top: 16px;
}

.summary-content {
  padding: 12px 0;
}

.summary-footer {
  margin-top: 8px;
}

.char-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.char-count .count-number {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.char-count .count-label {
  margin-left: 2px;
}

.char-count .count-hint {
  margin-left: 8px;
  font-size: 12px;
}

.char-count.warning .count-hint {
  color: #e8b33a;
}

.char-count.error .count-hint {
  color: #e84a3a;
}

.char-count.success .count-hint {
  color: #3ae894;
}

.summary-tip {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 3px solid rgba(232, 148, 58, 0.6);
  border-radius: 0 4px 4px 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.tip-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tip-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}

/* 覆盖 Naive UI Collapse 样式以匹配项目风格 */
:deep(.n-collapse-item__header) {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 14px;
}

:deep(.n-collapse-item__header--active) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.n-collapse-item__content-wrapper) {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
